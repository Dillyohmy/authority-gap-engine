/**
 * Report Context Aggregator
 * Pulls all available project data into a single normalized context object
 * before scoring and AI interpretation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportContext } from "../types/fullReport.js";
import { logger } from "../lib/logger.js";
import { loadGscSummary } from "./searchConsoleService.js";
import { loadGa4Summary } from "./googleAnalyticsService.js";

export async function aggregateReportContext(
  db: SupabaseClient,
  projectId: string,
  userId: string
): Promise<ReportContext> {
  // 1. Project record
  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project) throw new Error("Project not found");

  // 2. Intake answers
  const { data: answerRows } = await db
    .from("intake_answers")
    .select("question_id, value")
    .eq("project_id", projectId);

  const intakeAnswers: Record<string, unknown> = {};
  for (const row of answerRows ?? []) {
    intakeAnswers[row.question_id] = row.value;
  }

  // 3. Latest completed scan for this project's website
  let scanReport: Record<string, unknown> | null = null;
  let siteExtraction: Record<string, unknown> | null = null;

  const websiteUrl = (intakeAnswers["website_url"] as string) || project.website_url;
  if (websiteUrl) {
    const { data: scan } = await db
      .from("scans")
      .select("report_json, findings_json, authority_gap_score, visibility_score, conversion_score, opportunity_score")
      .eq("website_url", websiteUrl)
      .not("report_json", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (scan?.report_json) {
      scanReport = scan.report_json as Record<string, unknown>;
    }
  }

  // 4. Uploaded files + parsed summaries
  const { data: uploadRows } = await db
    .from("uploaded_files")
    .select("file_category, original_filename, upload_status, parse_status")
    .eq("project_id", projectId)
    .neq("upload_status", "deleted");

  const uploadedFiles = (uploadRows ?? []).map(r => ({
    file_category: r.file_category,
    file_label: r.original_filename,
    parse_status: r.parse_status,
  }));

  // Fetch parsed summaries for parseable files
  const parsedSummaries: Record<string, unknown> = {};
  const parseableCategories = (uploadRows ?? [])
    .filter(r => r.parse_status === "parsed")
    .map(r => r.file_category);

  if (parseableCategories.length > 0) {
    const { data: parsedRows } = await db
      .from("parsed_file_data")
      .select("file_category, summary_json")
      .eq("project_id", projectId);

    for (const row of parsedRows ?? []) {
      if (row.summary_json) {
        parsedSummaries[row.file_category] = row.summary_json;
      }
    }
  }

  // 5. Competitors + crawl summaries
  const { data: competitorRows } = await db
    .from("competitors")
    .select("*")
    .eq("project_id", projectId);

  const competitors = (competitorRows ?? []) as Record<string, unknown>[];

  const competitorCrawlSummaries: Record<string, unknown> = {};
  for (const comp of competitors) {
    const compId = comp.id as string;
    const { data: crawlResult } = await db
      .from("competitor_crawl_results")
      .select("summary_json")
      .eq("competitor_id", compId)
      .eq("crawl_status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (crawlResult?.summary_json) {
      competitorCrawlSummaries[compId] = crawlResult.summary_json;
    }
  }

  // 6. Connected Google integration data (prefer over CSV when available)
  const gscApiSummary = await loadGscSummary(db, projectId).catch(() => null);
  const ga4ApiSummary = await loadGa4Summary(db, projectId).catch(() => null);

  // Merge API data into parsedSummaries if newer/available
  if (gscApiSummary) {
    parsedSummaries["gsc_api_summary"] = gscApiSummary;
    // Also populate standard keys so existing report logic picks them up
    if (!parsedSummaries["gsc_queries"]) parsedSummaries["gsc_queries"] = gscApiSummary;
    if (!parsedSummaries["gsc_pages"]) parsedSummaries["gsc_pages"] = gscApiSummary;
  }
  if (ga4ApiSummary) {
    parsedSummaries["ga_api_summary"] = ga4ApiSummary;
    if (!parsedSummaries["ga_traffic"]) parsedSummaries["ga_traffic"] = ga4ApiSummary;
    if (!parsedSummaries["ga_landing_pages"]) parsedSummaries["ga_landing_pages"] = ga4ApiSummary;
  }

  // 7 (was 6). Competitive gap analysis
  const { data: gapRow } = await db
    .from("competitive_gap_analysis")
    .select("analysis_json, status")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const gapAnalysis = gapRow?.analysis_json as Record<string, unknown> | null ?? null;

  logger.info({
    projectId,
    hasScan: !!scanReport,
    intakeAnswerCount: Object.keys(intakeAnswers).length,
    uploadedFileCount: uploadedFiles.length,
    parsedSummaryCount: Object.keys(parsedSummaries).length,
    competitorCount: competitors.length,
    hasGapAnalysis: !!gapAnalysis,
  }, "Report context aggregated");

  const businessName =
    (intakeAnswers["practice_name"] as string) ||
    (intakeAnswers["business_name"] as string) ||
    project.name ||
    "";

  return {
    project: {
      id: project.id,
      name: project.name,
      website_url: websiteUrl || "",
      clinic_type: (intakeAnswers["clinic_type"] as string) || project.clinic_type || "",
      location: (intakeAnswers["location"] as string) || project.location || "",
      business_name: businessName,
    },
    intakeAnswers,
    scanReport,
    siteExtraction,
    uploadedFiles,
    parsedSummaries,
    competitors,
    competitorCrawlSummaries,
    gapAnalysis,
  };
}

export function assessDataCompleteness(ctx: ReportContext): {
  level: "low" | "medium" | "high";
  score: number;
  available: string[];
  missing: string[];
} {
  const available: string[] = [];
  const missing: string[] = [];

  if (ctx.scanReport) available.push("Website scan");
  else missing.push("Website scan");

  const intakeCount = Object.keys(ctx.intakeAnswers).length;
  if (intakeCount >= 10) available.push("Intake answers (full)");
  else if (intakeCount >= 4) available.push("Intake answers (partial)");
  else missing.push("Guided intake answers");

  if (ctx.parsedSummaries["gsc_api_summary"]) available.push("Google Search Console (live API)");
  else if (ctx.parsedSummaries["gsc_queries"] || ctx.parsedSummaries["gsc_pages"]) available.push("Google Search Console (CSV)");
  else missing.push("Google Search Console data");

  if (ctx.parsedSummaries["ga_api_summary"]) available.push("Google Analytics (live API)");
  else if (ctx.parsedSummaries["ga_traffic"] || ctx.parsedSummaries["ga_landing_pages"]) available.push("Google Analytics (CSV)");
  else missing.push("Google Analytics data");

  if (ctx.intakeAnswers["gbp_url"]) available.push("Google Business Profile URL");
  else missing.push("Google Business Profile URL");

  if (ctx.competitors.length >= 1) available.push(`Competitor data (${ctx.competitors.length})`);
  else missing.push("Competitor information");

  if (Object.keys(ctx.competitorCrawlSummaries).length >= 1) available.push("Competitor crawl results");
  else missing.push("Competitor website crawls");

  if (ctx.gapAnalysis) available.push("Competitive gap analysis");
  else missing.push("Competitive gap analysis");

  if (ctx.uploadedFiles.length >= 3) available.push("Uploaded supporting files");
  else if (ctx.uploadedFiles.length >= 1) available.push("Some uploaded files");

  const score = Math.round((available.length / (available.length + missing.length)) * 100);
  const level: "low" | "medium" | "high" = score >= 65 ? "high" : score >= 35 ? "medium" : "low";

  return { level, score, available, missing };
}
