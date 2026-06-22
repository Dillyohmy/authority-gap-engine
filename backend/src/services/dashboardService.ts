/**
 * Dashboard Service — Priority 6
 * Assembles the full DashboardViewModel from all available project data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateReportContext, assessDataCompleteness } from "./reportContextAggregator.js";
import { ALL_QUESTIONS, REQUIRED_QUESTION_IDS } from "../config/intakeQuestions.js";
import type {
  DashboardViewModel,
  DashboardState,
  DashboardScores,
  DashboardPhaseData,
  DashboardMissingInput,
  DashboardPriorityFix,
  DashboardTask,
  NextBestAction,
  BiggestGap,
  DashboardRecentActivity,
  DashboardAvailableAction,
} from "../types/dashboard.js";
import type { FullReport } from "../types/fullReport.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreStatus(score: number | null): "strong" | "good" | "needs_work" | "critical" | "unknown" {
  if (score === null) return "unknown";
  if (score >= 80) return "strong";
  if (score >= 65) return "good";
  if (score >= 45) return "needs_work";
  return "critical";
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    foundation: "Foundation",
    local_authority: "Local Authority",
    service_authority: "Service Authority",
    trust_conversion: "Trust & Conversion",
    competitive_ai_visibility: "Competitive & AI Visibility",
  };
  return labels[phase] ?? phase;
}

function phaseWhyItMatters(phase: string): string {
  const reasons: Record<string, string> = {
    foundation:
      "Google, AI search systems, and users must clearly understand who your business is, where you're located, and what you do. Weak foundations hurt every other phase.",
    local_authority:
      "Local search and map pack visibility depend on location clarity, GBP strength, review volume, and citation consistency. This is where most local competitors are won or lost.",
    service_authority:
      "Your website must clearly explain every service you offer with enough depth to rank, convert, and be recommended by AI systems. Thin content loses to competitors with detailed pages.",
    trust_conversion:
      "Visitors decide in seconds whether to trust you and contact you. Testimonials, credentials, strong CTAs, and clear contact paths turn traffic into patients or clients.",
    competitive_ai_visibility:
      "AI search (ChatGPT, Gemini, Google AI Overviews, Perplexity) is increasingly how people find local businesses. Structured data, entity clarity, and competitor differentiation determine who gets recommended.",
  };
  return reasons[phase] ?? "";
}

function phaseRecommendedNextStep(phase: string, score: number | null): string {
  if (score === null) return "Complete your intake and run a scan to unlock phase recommendations.";
  if (score >= 80) return "Maintain your strong foundation and monitor for changes.";
  const steps: Record<string, string> = {
    foundation: "Fix page titles, H1s, and missing schema markup as quick wins.",
    local_authority: "Ensure your Google Business Profile URL is added and review count is growing.",
    service_authority: "Create or expand service pages for your top revenue services.",
    trust_conversion: "Add provider bios, testimonials, and a clear primary CTA above the fold.",
    competitive_ai_visibility: "Add FAQ schema, improve entity clarity, and analyze competitor gaps.",
  };
  return steps[phase] ?? "Review findings and address critical priority issues first.";
}

function phaseEstimatedImpact(phase: string, score: number | null): string {
  if (score === null) return "Impact will be calculated once your audit is complete.";
  if (score >= 80) return "Maintaining this phase protects your current rankings and conversion rates.";
  const impacts: Record<string, string> = {
    foundation:
      "Fixing foundation issues typically improves crawlability, indexability, and core ranking signals within 30–60 days.",
    local_authority:
      "Improving local authority can move your map pack ranking from page 2 to page 1 within 60–90 days.",
    service_authority:
      "Adding depth to service pages can improve impressions and clicks within 30–60 days and directly impacts revenue.",
    trust_conversion:
      "Strengthening trust signals and CTAs can improve contact form conversions 20–40% within 30 days.",
    competitive_ai_visibility:
      "Improving AI readiness positions you to capture the growing share of AI-driven local search traffic.",
  };
  return impacts[phase] ?? "Addressing this phase will improve your overall authority score.";
}

// ─── Missing Inputs Per Phase ──────────────────────────────────────────────────

function buildMissingInputs(
  phase: string,
  intakeAnswers: Record<string, unknown>,
  uploadedFiles: Array<{ file_category: string; parse_status: string }>,
  competitors: unknown[],
  gapAnalysis: unknown | null,
  projectId: string
): DashboardMissingInput[] {
  const missing: DashboardMissingInput[] = [];
  const uploadedCategories = new Set(uploadedFiles.map((f) => f.file_category));

  if (phase === "foundation") {
    if (!intakeAnswers["website_url"]) {
      missing.push({
        name: "Website URL",
        why_it_matters: "Required to crawl and analyze your website.",
        recommended_format: "Full URL, e.g. https://yoursite.com",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/intake`,
        action_label: "Add in Intake",
        phase,
      });
    }
    if (!intakeAnswers["practice_name"]) {
      missing.push({
        name: "Business Name",
        why_it_matters: "Used to check NAP consistency and entity clarity across the web.",
        recommended_format: "Official business name",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/intake`,
        action_label: "Add in Intake",
        phase,
      });
    }
    if (!intakeAnswers["location"]) {
      missing.push({
        name: "Primary Address / Location",
        why_it_matters: "Address consistency is critical for local SEO and map pack ranking.",
        recommended_format: "Full street address including city and state",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/intake`,
        action_label: "Add in Intake",
        phase,
      });
    }
    if (!uploadedCategories.has("gsc_queries")) {
      missing.push({
        name: "Google Search Console — Queries CSV",
        why_it_matters: "Shows what keywords you rank for and where you can improve CTR.",
        recommended_format: "CSV export from GSC Performance → Queries tab",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/uploads`,
        action_label: "Upload",
        phase,
      });
    }
  }

  if (phase === "local_authority") {
    if (!intakeAnswers["google_business_profile_url"]) {
      missing.push({
        name: "Google Business Profile URL",
        why_it_matters: "Required to analyze your GBP strength, category, and review data.",
        recommended_format: "Full GBP URL from Google Maps",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/intake`,
        action_label: "Add in Intake",
        phase,
      });
    }
    if (!uploadedCategories.has("gbp_screenshot")) {
      missing.push({
        name: "Google Business Profile Screenshot",
        why_it_matters: "Shows category, services, photos, and review snippet as customers see it.",
        recommended_format: "PNG or JPG screenshot of your full GBP listing",
        required_or_optional: "recommended",
        action_href: `/projects/${projectId}/uploads`,
        action_label: "Upload",
        phase,
      });
    }
    if (!uploadedCategories.has("map_pack_screenshot")) {
      missing.push({
        name: "Map Pack Screenshot",
        why_it_matters: "Reveals your current map pack position and nearby competitor positions.",
        recommended_format: "Screenshot of local map pack for your main service + city search",
        required_or_optional: "recommended",
        action_href: `/projects/${projectId}/uploads`,
        action_label: "Upload",
        phase,
      });
    }
    if (competitors.length === 0) {
      missing.push({
        name: "Top 3 Competitor URLs",
        why_it_matters: "Competitor data is required to identify your local authority gaps.",
        recommended_format: "Website URLs of your top 3 local competitors",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/competitors`,
        action_label: "Add Competitors",
        phase,
      });
    }
    if (!intakeAnswers["google_reviews_notes"]) {
      missing.push({
        name: "Google Reviews Notes",
        why_it_matters: "Review count and rating are strong local ranking and trust signals.",
        recommended_format: "Note your current review count and star rating",
        required_or_optional: "recommended",
        action_href: `/projects/${projectId}/intake`,
        action_label: "Add in Intake",
        phase,
      });
    }
  }

  if (phase === "service_authority") {
    if (!intakeAnswers["revenue_services"] ||
        (Array.isArray(intakeAnswers["revenue_services"]) && (intakeAnswers["revenue_services"] as unknown[]).length === 0)) {
      missing.push({
        name: "Primary Revenue Services",
        why_it_matters: "Identifies which service pages to prioritize for content depth and conversion.",
        recommended_format: "List your top 3–5 revenue-generating services",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/intake`,
        action_label: "Add in Intake",
        phase,
      });
    }
    if (!uploadedCategories.has("gsc_queries")) {
      missing.push({
        name: "Google Search Console — Queries CSV",
        why_it_matters: "Reveals high-impression, low-click queries you can target with content.",
        recommended_format: "CSV export from GSC Performance → Queries tab",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/uploads`,
        action_label: "Upload",
        phase,
      });
    }
    if (!uploadedCategories.has("gsc_pages")) {
      missing.push({
        name: "Google Search Console — Pages CSV",
        why_it_matters: "Shows which pages are getting impressions so you can prioritize thin content fixes.",
        recommended_format: "CSV export from GSC Performance → Pages tab",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/uploads`,
        action_label: "Upload",
        phase,
      });
    }
    if (!uploadedCategories.has("keyword_rankings")) {
      missing.push({
        name: "Keyword Rankings CSV",
        why_it_matters: "Positions 4–20 represent your fastest ranking opportunities.",
        recommended_format: "Export from SEMrush, Ahrefs, BrightLocal, or similar",
        required_or_optional: "recommended",
        action_href: `/projects/${projectId}/uploads`,
        action_label: "Upload",
        phase,
      });
    }
  }

  if (phase === "trust_conversion") {
    if (!intakeAnswers["preferred_cta"]) {
      missing.push({
        name: "Preferred Call-to-Action",
        why_it_matters: "The primary CTA drives how visitors contact you — clarity here is critical.",
        recommended_format: "Select your main CTA (Call Now, Book Online, etc.)",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/intake`,
        action_label: "Add in Intake",
        phase,
      });
    }
    if (!intakeAnswers["testimonials"]) {
      missing.push({
        name: "Patient / Client Testimonials",
        why_it_matters: "Testimonials on your website build trust and improve conversion rates.",
        recommended_format: "Paste 3–5 testimonials or describe where they appear on your site",
        required_or_optional: "recommended",
        action_href: `/projects/${projectId}/intake`,
        action_label: "Add in Intake",
        phase,
      });
    }
    if (!uploadedCategories.has("reviews_screenshot")) {
      missing.push({
        name: "Google Reviews Screenshot",
        why_it_matters: "Confirms your current rating and review volume for trust analysis.",
        recommended_format: "Screenshot of your Google reviews panel",
        required_or_optional: "recommended",
        action_href: `/projects/${projectId}/uploads`,
        action_label: "Upload",
        phase,
      });
    }
    if (!uploadedCategories.has("ga_landing_pages")) {
      missing.push({
        name: "Google Analytics — Landing Pages CSV",
        why_it_matters: "Reveals which pages have high bounce rates or low conversion signals.",
        recommended_format: "Export from GA4 → Engagement → Landing Page",
        required_or_optional: "recommended",
        action_href: `/projects/${projectId}/uploads`,
        action_label: "Upload",
        phase,
      });
    }
  }

  if (phase === "competitive_ai_visibility") {
    if (competitors.length === 0) {
      missing.push({
        name: "Competitor URLs",
        why_it_matters: "Required to identify competitive gaps in services, content, and local visibility.",
        recommended_format: "Website URLs of your top local competitors",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/competitors`,
        action_label: "Add Competitors",
        phase,
      });
    }
    if (!gapAnalysis) {
      missing.push({
        name: "Competitor Gap Analysis",
        why_it_matters: "Identifies exactly where competitors outperform you so you can close the gap.",
        recommended_format: "Run the Competitor Gap Analysis after adding and crawling competitors",
        required_or_optional: "required",
        action_href: `/projects/${projectId}/competitive-analysis`,
        action_label: "Run Analysis",
        phase,
      });
    }
    if (!intakeAnswers["schema_markup_notes"]) {
      missing.push({
        name: "Schema Markup Notes",
        why_it_matters: "Structured data helps AI systems and Google understand your business entities.",
        recommended_format: "Describe any schema markup on your site or note if none exists",
        required_or_optional: "recommended",
        action_href: `/projects/${projectId}/intake`,
        action_label: "Add in Intake",
        phase,
      });
    }
  }

  return missing;
}

// ─── Provisional Phase Scores from Scan ───────────────────────────────────────

function provisionalScoresFromScan(
  scanReport: Record<string, unknown> | null,
  intakeAnswers: Record<string, unknown>,
  uploadedFiles: Array<{ file_category: string }>,
  competitors: unknown[]
): Partial<Record<string, number>> {
  if (!scanReport) return {};

  const base = (scanReport as Record<string, number>).authority_gap_score ?? 50;
  const visibility = (scanReport as Record<string, number>).visibility_score ?? 50;
  const conversion = (scanReport as Record<string, number>).conversion_score ?? 50;

  const uploadedCategories = new Set(uploadedFiles.map((f) => f.file_category));
  const hasGbp = !!intakeAnswers["google_business_profile_url"];
  const hasCompetitors = competitors.length > 0;
  const hasGsc = uploadedCategories.has("gsc_queries");

  return {
    foundation: Math.min(100, Math.round((base * 0.6 + visibility * 0.4))),
    local_authority: Math.min(100, Math.round((visibility * 0.5 + (hasGbp ? 15 : 0) + (hasCompetitors ? 10 : 0) + base * 0.25))),
    service_authority: Math.min(100, Math.round((visibility * 0.4 + (hasGsc ? 15 : 0) + base * 0.45))),
    trust_conversion: Math.min(100, Math.round((conversion * 0.7 + base * 0.3))),
    competitive_ai_visibility: Math.min(100, Math.round((base * 0.4 + visibility * 0.35 + (hasCompetitors ? 15 : 0)))),
  };
}

// ─── Determine Dashboard State ─────────────────────────────────────────────────

function determineDashboardState(
  intakeAnswerCount: number,
  requiredAnswered: number,
  requiredTotal: number,
  hasScan: boolean,
  hasReport: boolean,
  hasGrowthPlan: boolean,
  growthPlanTaskCount: number
): DashboardState {
  if (intakeAnswerCount === 0) return "no_data";
  if (requiredAnswered < requiredTotal) return "intake_incomplete";
  if (!hasScan) return "intake_complete";
  if (!hasReport) return "scan_complete";
  if (!hasGrowthPlan) return "report_complete";
  if (growthPlanTaskCount > 0) return "growth_plan_active";
  return "all_complete";
}

// ─── Next Best Action Logic ────────────────────────────────────────────────────

function computeNextBestAction(
  state: DashboardState,
  intakeAnswers: Record<string, unknown>,
  uploadedFiles: Array<{ file_category: string }>,
  competitors: unknown[],
  hasScan: boolean,
  hasReport: boolean,
  hasGrowthPlan: boolean,
  scores: DashboardScores,
  biggestGap: BiggestGap | null,
  projectId: string
): NextBestAction {
  const uploadedCategories = new Set(uploadedFiles.map((f) => f.file_category));

  if (state === "no_data" || state === "intake_incomplete") {
    return {
      title: "Complete your business intake",
      description: "Answer a few questions about your business so we can start analyzing your authority gaps.",
      action_type: "complete_intake",
      href: `/projects/${projectId}/intake`,
      priority: "critical",
    };
  }

  if (!intakeAnswers["google_business_profile_url"]) {
    return {
      title: "Add your Google Business Profile URL",
      description: "Your GBP URL is required to analyze local authority and map pack visibility.",
      action_type: "add_gbp",
      href: `/projects/${projectId}/intake`,
      priority: "critical",
    };
  }

  if (!hasScan) {
    return {
      title: "Run your first authority scan",
      description: "Scan your website to begin identifying authority gaps and missing signals.",
      action_type: "run_scan",
      href: `/projects/${projectId}/intake`,
      priority: "critical",
    };
  }

  if (!uploadedCategories.has("gsc_queries") || !uploadedCategories.has("gsc_pages")) {
    return {
      title: "Upload Google Search Console data",
      description: "GSC data reveals which keywords you rank for and where you're leaving traffic behind.",
      action_type: "upload_gsc",
      href: `/projects/${projectId}/uploads`,
      priority: "high",
    };
  }

  if (competitors.length === 0) {
    return {
      title: "Add your top 3 competitors",
      description: "Competitor analysis unlocks gap identification and reveals what they do better.",
      action_type: "add_competitors",
      href: `/projects/${projectId}/competitors`,
      priority: "high",
    };
  }

  if (!uploadedCategories.has("ga_traffic_acquisition") || !uploadedCategories.has("ga_landing_pages")) {
    return {
      title: "Upload Google Analytics data",
      description: "GA data reveals conversion patterns and identifies which pages need CTA improvements.",
      action_type: "upload_ga",
      href: `/projects/${projectId}/uploads`,
      priority: "high",
    };
  }

  if (!hasReport) {
    return {
      title: "Generate your Full Authority Gap Report",
      description: "Get a complete five-phase analysis of your authority gaps with prioritized recommendations.",
      action_type: "generate_report",
      href: `/projects/${projectId}/intake`,
      priority: "critical",
    };
  }

  if (!hasGrowthPlan) {
    return {
      title: "Generate your Personal Authority Growth Plan",
      description: "Convert your report findings into a 30/60/90-day action roadmap with prioritized tasks.",
      action_type: "generate_growth_plan",
      href: `/projects/${projectId}/intake`,
      priority: "high",
    };
  }

  if (biggestGap && biggestGap.score < 50) {
    return {
      title: `Improve your ${biggestGap.label} score`,
      description: `Your ${biggestGap.label} phase is your weakest area at ${biggestGap.score}/100. Focus here for the highest authority score improvement.`,
      action_type: "fix_critical",
      href: `/projects/${projectId}/intake`,
      priority: "high",
    };
  }

  return {
    title: "Work through your growth plan tasks",
    description: "Check off completed tasks and update statuses to track your authority score improvement.",
    action_type: "update_tasks",
    href: `/projects/${projectId}/intake`,
    priority: "medium",
  };
}

// ─── Build Phase Data ──────────────────────────────────────────────────────────

function buildPhaseData(
  phase: string,
  score: number | null,
  reportPhase: Record<string, unknown> | null,
  missingInputs: DashboardMissingInput[],
  growthPlanTasks: DashboardTask[],
  projectId: string
): DashboardPhaseData {
  const findings = reportPhase
    ? ((reportPhase["findings"] as unknown[]) ?? []).map((f: unknown) => {
        const finding = f as Record<string, unknown>;
        return {
          id: String(finding["id"] ?? ""),
          label: String(finding["label"] ?? ""),
          severity: String(finding["severity"] ?? "medium"),
          description: String(finding["description"] ?? ""),
        };
      })
    : [];

  // Build priority fixes from report phase priority_fixes + priority_actions
  const priorityFixes: DashboardPriorityFix[] = [];
  if (reportPhase) {
    const rawFixes = (reportPhase["priority_fixes"] as string[]) ?? [];
    rawFixes.slice(0, 6).forEach((fix, i) => {
      priorityFixes.push({
        id: `${phase}_fix_${i}`,
        title: fix,
        description: fix,
        priority: i === 0 ? "critical" : i <= 2 ? "high" : "medium",
        difficulty: "moderate",
        estimated_impact: "Medium",
        source: "Full Authority Gap Report",
        phase,
        status: "not_started",
      });
    });
  }

  return {
    phase,
    phase_label: phaseLabel(phase),
    score,
    score_status: scoreStatus(score),
    why_it_matters: phaseWhyItMatters(phase),
    summary: reportPhase ? String(reportPhase["summary"] ?? "") : "Run a scan and generate a Full Authority Gap Report to unlock phase insights.",
    findings,
    missing_inputs: missingInputs,
    priority_fixes: priorityFixes,
    growth_plan_tasks: growthPlanTasks.filter((t) => t.phase === phase),
    estimated_impact: phaseEstimatedImpact(phase, score),
    recommended_next_step: phaseRecommendedNextStep(phase, score),
  };
}

// ─── Main Dashboard Builder ────────────────────────────────────────────────────

export async function buildDashboardViewModel(
  db: SupabaseClient,
  projectId: string,
  userId: string
): Promise<DashboardViewModel> {
  // Aggregate all context
  const ctx = await aggregateReportContext(db, projectId, userId);
  const completeness = assessDataCompleteness(ctx);

  // Project record
  const { data: projectRow } = await db
    .from("projects")
    .select("id, name, website_url, clinic_type, location, business_name, status")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  // Intake progress
  const intakeAnswerCount = Object.keys(ctx.intakeAnswers).length;
  const requiredIds = [...REQUIRED_QUESTION_IDS];
  const requiredTotal = requiredIds.length;
  const requiredAnswered = requiredIds.filter((id) => {
    const v = ctx.intakeAnswers[id];
    if (v === null || v === undefined) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;

  const totalQuestions = ALL_QUESTIONS.length;
  const totalAnswered = ALL_QUESTIONS.filter((q) => {
    const v = ctx.intakeAnswers[q.id];
    if (v === null || v === undefined) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;

  // Latest completed report
  const { data: reportRow } = await db
    .from("reports")
    .select("id, report_status, report_json, authority_score, audit_readiness_score, foundation_score, local_authority_score, service_authority_score, trust_conversion_score, competitive_ai_score, created_at, updated_at")
    .eq("project_id", projectId)
    .eq("report_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const fullReport: FullReport | null = reportRow?.report_json ? (reportRow.report_json as FullReport) : null;

  // Latest growth plan
  const { data: planRow } = await db
    .from("growth_plans")
    .select("id, plan_status, authority_score_start, target_authority_score, created_at")
    .eq("project_id", projectId)
    .eq("plan_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Growth plan tasks
  let growthPlanTasks: DashboardTask[] = [];
  let totalTaskCount = 0;
  let completedTaskCount = 0;

  if (planRow) {
    const { data: taskRows } = await db
      .from("growth_plan_tasks")
      .select("id, phase, title, description, priority, difficulty, due_window, status, estimated_effort, sort_order")
      .eq("growth_plan_id", planRow.id)
      .order("sort_order", { ascending: true });

    if (taskRows) {
      totalTaskCount = taskRows.length;
      completedTaskCount = taskRows.filter((t) => t.status === "completed").length;
      growthPlanTasks = taskRows.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        difficulty: t.difficulty,
        due_window: t.due_window,
        status: t.status,
        phase: t.phase,
        estimated_effort: t.estimated_effort,
        sort_order: t.sort_order,
      }));
    }
  }

  // Latest scan
  const { data: scanRow } = await db
    .from("scans")
    .select("id, authority_gap_score, visibility_score, conversion_score, created_at")
    .eq("website_url", ctx.project.website_url || "")
    .not("report_json", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Determine scores
  const hasScan = !!scanRow || !!ctx.scanReport;
  const hasReport = !!reportRow;
  const hasGrowthPlan = !!planRow;
  const provisional = !hasReport && hasScan;

  let scores: DashboardScores;

  if (fullReport) {
    scores = {
      authority: fullReport.scores.authority_score,
      audit_readiness: fullReport.scores.audit_readiness_score,
      foundation: fullReport.scores.foundation_score,
      local_authority: fullReport.scores.local_authority_score,
      service_authority: fullReport.scores.service_authority_score,
      trust_conversion: fullReport.scores.trust_conversion_score,
      competitive_ai_visibility: fullReport.scores.competitive_ai_score,
      provisional: false,
    };
  } else if (ctx.scanReport) {
    const provScores = provisionalScoresFromScan(ctx.scanReport, ctx.intakeAnswers, ctx.uploadedFiles, ctx.competitors);
    const scanScores = ctx.scanReport as Record<string, number>;
    scores = {
      authority: scanScores["authority_gap_score"] ?? null,
      audit_readiness: null,
      foundation: provScores["foundation"] ?? null,
      local_authority: provScores["local_authority"] ?? null,
      service_authority: provScores["service_authority"] ?? null,
      trust_conversion: provScores["trust_conversion"] ?? null,
      competitive_ai_visibility: provScores["competitive_ai_visibility"] ?? null,
      provisional: true,
    };
  } else {
    scores = {
      authority: null,
      audit_readiness: null,
      foundation: null,
      local_authority: null,
      service_authority: null,
      trust_conversion: null,
      competitive_ai_visibility: null,
      provisional: false,
    };
  }

  // Biggest gap
  const phaseScores: Array<{ phase: string; label: string; score: number }> = [
    { phase: "foundation", label: "Foundation", score: scores.foundation ?? 100 },
    { phase: "local_authority", label: "Local Authority", score: scores.local_authority ?? 100 },
    { phase: "service_authority", label: "Service Authority", score: scores.service_authority ?? 100 },
    { phase: "trust_conversion", label: "Trust & Conversion", score: scores.trust_conversion ?? 100 },
    { phase: "competitive_ai_visibility", label: "Competitive & AI", score: scores.competitive_ai_visibility ?? 100 },
  ].filter((p) => scores[p.phase as keyof DashboardScores] !== null);

  const biggestGap: BiggestGap | null = phaseScores.length > 0
    ? phaseScores.reduce((min, p) => p.score < min.score ? p : min, phaseScores[0])
    : null;

  // Dashboard state
  const dashboardState = determineDashboardState(
    intakeAnswerCount,
    requiredAnswered,
    requiredTotal,
    hasScan,
    hasReport,
    hasGrowthPlan,
    totalTaskCount
  );

  // Next best action
  const nextBestAction = computeNextBestAction(
    dashboardState,
    ctx.intakeAnswers,
    ctx.uploadedFiles,
    ctx.competitors,
    hasScan,
    hasReport,
    hasGrowthPlan,
    scores,
    biggestGap,
    projectId
  );

  // Build per-phase data
  const phases = ["foundation", "local_authority", "service_authority", "trust_conversion", "competitive_ai_visibility"] as const;

  const phaseDataMap = {} as DashboardViewModel["phases"];

  for (const phase of phases) {
    const reportPhase = fullReport?.five_phase_analysis
      ? (fullReport.five_phase_analysis[phase as keyof typeof fullReport.five_phase_analysis] as unknown as Record<string, unknown>)
      : null;

    const missingInputs = buildMissingInputs(
      phase,
      ctx.intakeAnswers,
      ctx.uploadedFiles,
      ctx.competitors,
      ctx.gapAnalysis,
      projectId
    );

    const phaseScore = scores[phase as keyof DashboardScores] as number | null;

    phaseDataMap[phase] = buildPhaseData(
      phase,
      phaseScore,
      reportPhase,
      missingInputs,
      growthPlanTasks,
      projectId
    );
  }

  // Recent activity
  const recentActivity: DashboardRecentActivity[] = [];
  if (scanRow) {
    recentActivity.push({ type: "scan", label: "Website scan completed", date: scanRow.created_at });
  }
  if (reportRow) {
    recentActivity.push({
      type: "report",
      label: "Full Authority Gap Report generated",
      date: reportRow.created_at,
      href: `/projects/${projectId}/reports/${reportRow.id}`,
    });
  }
  if (planRow) {
    recentActivity.push({
      type: "growth_plan",
      label: "Personal Authority Growth Plan created",
      date: planRow.created_at,
      href: `/projects/${projectId}/growth-plans/${planRow.id}`,
    });
  }
  if (ctx.uploadedFiles.length > 0) {
    recentActivity.push({ type: "upload", label: `${ctx.uploadedFiles.length} file(s) uploaded`, date: new Date().toISOString() });
  }
  if (ctx.competitors.length > 0) {
    recentActivity.push({ type: "competitor", label: `${ctx.competitors.length} competitor(s) added`, date: new Date().toISOString() });
  }

  // Available actions
  const availableActions: DashboardAvailableAction[] = [];
  if (!hasReport && hasScan) {
    availableActions.push({
      label: "Generate Full Authority Gap Report",
      description: "Get your complete five-phase authority analysis",
      href: `/projects/${projectId}/intake`,
      action_type: "generate_report",
      variant: "primary",
    });
  }
  if (hasReport && !hasGrowthPlan) {
    availableActions.push({
      label: "Generate Personal Authority Growth Plan",
      description: "Convert your report into a 30/60/90-day action roadmap",
      href: `/projects/${projectId}/intake`,
      action_type: "generate_growth_plan",
      variant: "primary",
    });
  }
  if (reportRow) {
    availableActions.push({
      label: "View Full Report",
      description: "Review your complete authority gap analysis",
      href: `/projects/${projectId}/reports/${reportRow.id}`,
      action_type: "view_report",
      variant: "secondary",
    });
  }
  if (planRow) {
    availableActions.push({
      label: "View Growth Plan",
      description: "Track your 30/60/90-day improvement roadmap",
      href: `/projects/${projectId}/growth-plans/${planRow.id}`,
      action_type: "view_growth_plan",
      variant: "secondary",
    });
  }
  availableActions.push({
    label: "Upload Supporting Files",
    description: "Add GSC, GA, screenshots, and other data to improve audit confidence",
    href: `/projects/${projectId}/uploads`,
    action_type: "upload_files",
    variant: "outline",
  });
  availableActions.push({
    label: "Manage Competitors",
    description: "Add or crawl competitor websites for gap analysis",
    href: `/projects/${projectId}/competitors`,
    action_type: "manage_competitors",
    variant: "outline",
  });

  return {
    project: {
      id: ctx.project.id,
      name: ctx.project.name,
      website_url: ctx.project.website_url,
      clinic_type: ctx.project.clinic_type,
      location: ctx.project.location,
      business_name: ctx.project.business_name,
      status: projectRow?.status ?? "intake",
    },
    dashboard_state: dashboardState,
    scores,
    biggest_gap: biggestGap,
    next_best_action: nextBestAction,
    phases: phaseDataMap,
    latest_scan: scanRow
      ? {
          id: scanRow.id,
          authority_gap_score: scanRow.authority_gap_score,
          visibility_score: scanRow.visibility_score,
          conversion_score: scanRow.conversion_score,
          created_at: scanRow.created_at,
        }
      : null,
    latest_report: reportRow
      ? {
          id: reportRow.id,
          report_status: reportRow.report_status,
          authority_score: reportRow.authority_score ?? null,
          audit_readiness_score: reportRow.audit_readiness_score ?? null,
          created_at: reportRow.created_at,
          updated_at: reportRow.updated_at,
        }
      : null,
    latest_growth_plan: planRow
      ? {
          id: planRow.id,
          plan_status: planRow.plan_status,
          authority_score_start: planRow.authority_score_start ?? null,
          target_authority_score: planRow.target_authority_score ?? null,
          created_at: planRow.created_at,
          total_tasks: totalTaskCount,
          completed_tasks: completedTaskCount,
        }
      : null,
    recent_activity: recentActivity,
    available_actions: availableActions,
    intake_progress: {
      total_questions: totalQuestions,
      answered_questions: totalAnswered,
      required_total: requiredTotal,
      required_answered: requiredAnswered,
      pct: totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0,
    },
    data_completeness: {
      level: completeness.level,
      score: completeness.score,
    },
  };
}
