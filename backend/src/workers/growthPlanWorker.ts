import "../lib/env.js";
import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { db } from "../lib/db.js";
import { aggregateReportContext } from "../services/reportContextAggregator.js";
import { buildGrowthPlanActions } from "../services/growthPlanService.js";
import { generateGrowthPlanAiInterpretation } from "../services/growthPlanAiService.js";
import type { GrowthPlanContext } from "../types/growthPlan.js";
import type { FullReport } from "../types/fullReport.js";

interface GrowthPlanJobData {
  jobId: string;
  planId: string;
  projectId: string;
  reportId: string;
  userId: string;
}

async function processGrowthPlan(job: Job<GrowthPlanJobData>) {
  const { jobId, planId, projectId, reportId, userId } = job.data;
  logger.info({ jobId, planId, projectId }, "Starting growth plan generation");

  await db.from("growth_plans").update({
    plan_status: "processing",
    updated_at: new Date().toISOString(),
  }).eq("id", planId);

  try {
    // 1. Load the source report
    const { data: reportRow } = await db
      .from("reports")
      .select("report_json, authority_score, confidence_level")
      .eq("id", reportId)
      .eq("project_id", projectId)
      .single();

    if (!reportRow?.report_json) {
      throw new Error("Source report not found or not yet completed");
    }

    const fullReport = reportRow.report_json as FullReport;

    // 2. Aggregate project context for intake answers
    const ctx = await aggregateReportContext(db, projectId, userId);

    // 3. Build growth plan context from report + intake
    const intake = ctx.intakeAnswers;
    const revenueServicesRaw = intake["revenue_services"] ?? intake["top_revenue_services"] ?? "";
    const revenueServices: string[] = Array.isArray(revenueServicesRaw)
      ? revenueServicesRaw.map(String)
      : typeof revenueServicesRaw === "string" && revenueServicesRaw.trim()
        ? revenueServicesRaw.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
        : [];

    const profitableTreatments: string[] = (() => {
      const raw = intake["profitable_treatments"] ?? intake["high_margin_treatments"] ?? "";
      if (Array.isArray(raw)) return raw.map(String);
      if (typeof raw === "string" && raw.trim()) return raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
      return [];
    })();

    const gbpUrl = String(intake["gbp_url"] ?? intake["google_business_profile_url"] ?? "");
    const hasGbp = gbpUrl.includes("g.page") || gbpUrl.includes("maps.google") || gbpUrl.includes("business.google") || gbpUrl.length > 10;

    const hasGsc = !!(ctx.parsedSummaries?.["google_search_console"] ?? ctx.uploadedFiles?.find((f: Record<string, unknown>) => String(f.file_category ?? "").includes("search_console")));
    const hasGa = !!(ctx.parsedSummaries?.["google_analytics"] ?? ctx.uploadedFiles?.find((f: Record<string, unknown>) => String(f.file_category ?? "").includes("analytics")));
    const hasCompetitorAnalysis = !!ctx.gapAnalysis;

    const clinicTypeRaw = String(ctx.project.clinic_type ?? intake["clinic_type"] ?? "");
    const hipaaRequired = /medical|clinic|dental|chiro|therapy|health|doctor|physician|surgery|ortho|cardio|derma|optom|physio|rehab/i.test(clinicTypeRaw);

    const planCtx: GrowthPlanContext = {
      project: ctx.project as Record<string, unknown>,
      report: fullReport,
      intakeAnswers: intake,
      revenueServices,
      profitableTreatments,
      preferredCta: String(intake["preferred_cta"] ?? intake["primary_cta"] ?? ""),
      serviceArea: String(intake["service_area"] ?? intake["location"] ?? ctx.project.location ?? ""),
      hasGsc,
      hasGa,
      hasCompetitorAnalysis,
      hasGbp,
      hipaaRequired,
      complianceNotes: String(intake["compliance_notes"] ?? intake["special_compliance"] ?? ""),
      missingOptionalData: fullReport.missing_data?.map((m) => m.item_name) ?? [],
    };

    // 4. Build deterministic actions
    const partial = buildGrowthPlanActions(planCtx);

    // 5. AI interpretation — executive summary + growth strategy
    const totalTaskCount = partial.priority_actions.length + partial.thirty_day_plan.length + partial.sixty_day_plan.length + partial.ninety_day_plan.length;
    const ai = await generateGrowthPlanAiInterpretation(planCtx, totalTaskCount, partial.quick_wins.length);

    // 6. Compose final plan
    const planJson = {
      ...partial,
      source_report_id: reportId,
      executive_summary: ai.executive_summary,
      growth_strategy: ai.growth_strategy,
    };

    // 7. Save all tasks to growth_plan_tasks table
    const allTasks = [
      ...partial.thirty_day_plan,
      ...partial.sixty_day_plan,
      ...partial.ninety_day_plan,
    ].filter(t => !partial.thirty_day_plan.some(tw => tw.id === t.id && partial.sixty_day_plan.some(sw => sw.id === t.id)));

    // Dedupe tasks across windows
    const seen = new Set<string>();
    const dedupedTasks = [
      ...partial.thirty_day_plan,
      ...partial.sixty_day_plan,
      ...partial.ninety_day_plan,
    ].filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    if (dedupedTasks.length > 0) {
      const taskRows = dedupedTasks.map(t => ({
        growth_plan_id: planId,
        project_id: projectId,
        user_id: userId,
        phase: t.phase,
        title: t.title,
        description: t.description,
        priority: t.priority,
        difficulty: t.difficulty,
        estimated_impact: t.estimated_impact,
        suggested_owner: t.suggested_owner,
        estimated_effort: t.estimated_effort,
        status: "not_started",
        due_window: t.due_window,
        completion_criteria: t.completion_criteria,
        dependencies: t.dependencies,
        sort_order: t.sort_order,
      }));

      const { error: taskError } = await db.from("growth_plan_tasks").insert(taskRows);
      if (taskError) {
        logger.warn({ taskError, planId }, "Could not save growth plan tasks — continuing without row-level tracking");
      }
    }

    // 8. Save plan to Supabase
    const { error: saveError } = await db.from("growth_plans").update({
      plan_status: "completed",
      plan_json: planJson,
      summary: ai.executive_summary,
      authority_score_start: fullReport.scores?.authority_score ?? 0,
      target_authority_score: partial.target_scores?.authority_score ?? 0,
      confidence_level: partial.confidence?.level ?? "medium",
      updated_at: new Date().toISOString(),
    }).eq("id", planId);

    if (saveError) {
      logger.warn({ saveError, planId }, "Could not save growth plan");
    }

    logger.info({ jobId, planId, taskCount: dedupedTasks.length }, "Growth plan generation complete");
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ jobId, planId, err: msg }, "Growth plan generation failed");

    await db.from("growth_plans").update({
      plan_status: "failed",
      error_message: msg,
      updated_at: new Date().toISOString(),
    }).eq("id", planId);

    throw err;
  }
}

const worker = new Worker("growth-plan-jobs", processGrowthPlan, {
  connection: redis,
  concurrency: 1,
});

worker.on("completed", (job) => logger.info({ jobId: job.id }, "Growth plan worker: completed"));
worker.on("failed", (job, err) => logger.error({ jobId: job?.id, error: err.message }, "Growth plan worker: failed"));

logger.info("Growth plan worker started");
