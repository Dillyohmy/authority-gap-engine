import "../lib/env.js";
import { Worker, type Job } from "bullmq";
import Anthropic from "@anthropic-ai/sdk";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { db } from "../lib/db.js";
import { runCompetitiveComparison, type CompetitorWithCrawl, type TargetContext } from "../services/competitiveComparisonEngine.js";
import type { SiteExtraction } from "../services/extractService.js";
import type { CompetitiveGapAnalysis } from "../types/competitor.js";

interface CompetitorAnalysisJobData {
  jobId: string;
  projectId: string;
  userId: string;
  analysisId: string;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateCompetitiveSummary(analysis: CompetitiveGapAnalysis, targetUrl: string): Promise<string> {
  const competitorNames = "competitors in the area";
  const prompt = `You are an expert in local search and healthcare marketing.

You have just completed a structured competitive analysis comparing a target business against its real competitors.
Below are the deterministic findings. Do NOT invent data not shown here.

Target website: ${targetUrl}
Competitive Strength Score: ${analysis.competitive_strength_score}/100 (${analysis.gap_label})
Competitors analyzed: ${analysis.analyzed_competitors}
Data completeness: ${analysis.data_completeness}

Major gaps (where competitors are significantly stronger):
${analysis.major_gaps.length > 0 ? analysis.major_gaps.map(g => `- ${g}`).join("\n") : "- None identified"}

Moderate gaps:
${analysis.moderate_gaps.length > 0 ? analysis.moderate_gaps.map(g => `- ${g}`).join("\n") : "- None identified"}

Target advantages:
${analysis.target_advantages.length > 0 ? analysis.target_advantages.map(a => `- ${a}`).join("\n") : "- None identified"}

Top priority actions:
${analysis.recommended_priority_actions.slice(0, 3).map(a => `- ${a.title}: ${a.description}`).join("\n")}

${analysis.data_completeness === "minimal" ? "NOTE: No competitor websites were crawled. This summary is based on manually entered data only. State this limitation clearly." : ""}
${analysis.data_completeness === "partial" ? "NOTE: Not all competitor websites were crawled. Some findings are based on partial data." : ""}

Write a 3-4 sentence executive summary of the competitive landscape. Be specific about what the data shows.
Do not use generic filler. Do not invent competitor review counts, rankings, or services not shown above.
Acknowledge data limitations if present. Focus on the most actionable insight.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    return (response.content[0] as { type: string; text: string }).text.trim();
  } catch (err) {
    logger.warn({ err }, "AI summary generation failed — using fallback");
    const score = analysis.competitive_strength_score;
    const label = analysis.gap_label;
    return `Competitive analysis returned a strength score of ${score}/100 (${label}) based on ${analysis.analyzed_competitors} competitor${analysis.analyzed_competitors !== 1 ? "s" : ""}. ${analysis.major_gaps.length > 0 ? `Major gaps identified in: ${analysis.major_gaps.join(", ")}.` : "No major gaps were identified."} ${analysis.target_advantages.length > 0 ? `Target shows advantages in: ${analysis.target_advantages.join(", ")}.` : ""} Priority actions are ranked by estimated impact.`;
  }
}

async function processCompetitorAnalysis(job: Job<CompetitorAnalysisJobData>) {
  const { jobId, projectId, userId, analysisId } = job.data;
  logger.info({ jobId, projectId }, "Starting competitive gap analysis");

  await db.from("competitive_gap_analysis").update({
    status: "processing",
    updated_at: new Date().toISOString(),
  }).eq("id", analysisId);

  try {
    // 1. Load all competitors for the project
    const { data: competitors, error: compError } = await db
      .from("competitors")
      .select("*")
      .eq("project_id", projectId);

    if (compError || !competitors || competitors.length === 0) {
      throw new Error("No competitors found for this project");
    }

    // 2. Load crawl results for each competitor
    const competitorsWithCrawl: CompetitorWithCrawl[] = await Promise.all(
      competitors.map(async (comp) => {
        const { data: crawlResult } = await db
          .from("competitor_crawl_results")
          .select("summary_json")
          .eq("competitor_id", comp.id)
          .eq("crawl_status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          ...comp,
          crawlSummary: crawlResult?.summary_json ?? null,
        } as CompetitorWithCrawl;
      })
    );

    // 3. Load target site scan data for this project
    const { data: project } = await db
      .from("projects")
      .select("website_url, business_name, intake_answers")
      .eq("id", projectId)
      .single();

    let targetExtraction: SiteExtraction | null = null;
    if (project?.website_url) {
      // Try to find the most recent completed scan for this website
      const { data: scan } = await db
        .from("scans")
        .select("report_json")
        .eq("website_url", project.website_url)
        .not("report_json", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (scan?.report_json) {
        // Extract site signals embedded in the scan report if available
        const report = scan.report_json as Record<string, unknown>;
        // The scan worker stores the full report; we can reconstruct approximate signals
        // from scores if the raw extraction isn't stored separately
        const scores = report.scores as Record<string, number> | undefined;
        if (scores) {
          // Build a minimal SiteExtraction proxy from report data so comparison engine works
          targetExtraction = {
            homepage: {
              url: project.website_url,
              headings: [],
              metaTitle: "",
              metaDescription: "",
              wordCount: (report.avg_word_count as number) ?? 0,
              ctaCount: 0,
              formCount: 0,
              hasSchema: false,
              schemaTypes: [],
              imageCount: 0,
              imagesWithAlt: 0,
              hasPhoneLink: false,
              hasTestimonials: false,
              hasReviews: false,
              hasProviderBios: false,
              hasFaqSection: false,
              internalLinks: 0,
              externalLinks: 0,
            },
            pages: [],
            sitewide: {
              totalPages: 1,
              avgWordCount: 0,
              totalCtas: 0,
              hasLocalSchema: scores.visibility_score > 25,
              hasMedicalSchema: false,
              hasFaqSchema: false,
            },
          };
        }
      }
    }

    const targetContext: TargetContext = {
      siteExtraction: targetExtraction,
      intakeAnswers: (project?.intake_answers as Record<string, unknown>) ?? {},
      websiteUrl: project?.website_url ?? "",
      businessName: project?.business_name ?? undefined,
    };

    // 4. Run deterministic comparison
    const analysis = runCompetitiveComparison(targetContext, competitorsWithCrawl);

    // 5. Generate AI summary
    const summary = await generateCompetitiveSummary(analysis, targetContext.websiteUrl);
    analysis.overall_competitive_summary = summary;

    // 6. Save analysis
    await db.from("competitive_gap_analysis").update({
      status: "completed",
      analysis_json: analysis,
      updated_at: new Date().toISOString(),
    }).eq("id", analysisId);

    // 7. Mark all analyzed competitors
    await db.from("competitors").update({
      analysis_status: "completed",
      last_analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("project_id", projectId);

    logger.info({ jobId, projectId, score: analysis.competitive_strength_score }, "Competitive gap analysis complete");
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ jobId, projectId, err: msg }, "Competitive gap analysis failed");

    await db.from("competitive_gap_analysis").update({
      status: "failed",
      error_message: msg,
      updated_at: new Date().toISOString(),
    }).eq("id", analysisId);

    throw err;
  }
}

const worker = new Worker("competitor-analysis-jobs", processCompetitorAnalysis, {
  connection: redis,
  concurrency: 1,
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Competitor analysis worker: job completed");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Competitor analysis worker: job failed");
});

logger.info("Competitor analysis worker started");
