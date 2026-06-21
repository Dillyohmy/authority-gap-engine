import "../lib/env.js";
import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { db } from "../lib/db.js";
import { aggregateReportContext, assessDataCompleteness } from "../services/reportContextAggregator.js";
import {
  scoreFoundation,
  scoreLocalAuthority,
  scoreServiceAuthority,
  scoreTrustConversion,
  scoreCompetitiveAiVisibility,
  calculateFullScores,
  buildFullReportPriorityActions,
  buildMissingDataManifest,
} from "../services/fullReportScoring.js";
import { generateFullReportAiInterpretation } from "../services/fullReportAiService.js";
import type { FullReport } from "../types/fullReport.js";

interface FullReportJobData {
  jobId: string;
  reportId: string;
  projectId: string;
  userId: string;
}

async function processFullReport(job: Job<FullReportJobData>) {
  const { jobId, reportId, projectId, userId } = job.data;
  logger.info({ jobId, reportId, projectId }, "Starting full authority gap report generation");

  await db.from("reports").update({
    report_status: "processing",
    updated_at: new Date().toISOString(),
  }).eq("id", reportId);

  try {
    // 1. Aggregate all project data
    const ctx = await aggregateReportContext(db, projectId, userId);

    // 2. Assess data completeness
    const completeness = assessDataCompleteness(ctx);

    // 3. Score all five phases
    const foundation = scoreFoundation(ctx);
    const local_authority = scoreLocalAuthority(ctx);
    const service_authority = scoreServiceAuthority(ctx);
    const trust_conversion = scoreTrustConversion(ctx);
    const competitive_ai_visibility = scoreCompetitiveAiVisibility(ctx);

    const phases = {
      foundation,
      local_authority,
      service_authority,
      trust_conversion,
      competitive_ai_visibility,
    };

    // 4. Calculate composite scores
    const scores = calculateFullScores(phases);

    // Pull opportunity score from scan if available
    const scanScoreData = ctx.scanReport?.scores as Record<string, number> | undefined;
    scores.opportunity_score = scanScoreData?.opportunity_score ?? 0;

    // 5. Generate AI interpretation
    const ai = await generateFullReportAiInterpretation(ctx, scores, phases);

    // 6. Apply AI summaries back to phases
    phases.foundation.summary = ai.foundation_summary || phases.foundation.summary;
    phases.local_authority.summary = ai.local_authority_summary || phases.local_authority.summary;
    phases.service_authority.summary = ai.service_authority_summary || phases.service_authority.summary;
    phases.trust_conversion.summary = ai.trust_conversion_summary || phases.trust_conversion.summary;
    phases.competitive_ai_visibility.summary = ai.competitive_ai_summary || phases.competitive_ai_visibility.summary;

    // 7. Build priority actions and missing data manifest
    const priorityActions = buildFullReportPriorityActions(phases);
    const missingData = buildMissingDataManifest(phases);

    // 8. Build opportunity summary
    const scanReport = ctx.scanReport;
    const opportunitySummary = {
      summary: ai.opportunity_summary,
      estimated_revenue_low: (scanReport?.estimated_revenue_low as number) ?? 0,
      estimated_revenue_high: (scanReport?.estimated_revenue_high as number) ?? 0,
      top_opportunities: ai.top_opportunities ?? [],
    };

    // 9. Compose final report
    const report: FullReport = {
      report_version: "1.0",
      report_type: "full_authority_gap_report",
      project: ctx.project,
      generated_at: new Date().toISOString(),
      scores,
      confidence: {
        level: completeness.level,
        score: completeness.score,
        data_sources_available: completeness.available,
        data_sources_missing: completeness.missing,
      },
      executive_summary: ai.executive_summary,
      five_phase_analysis: phases,
      priority_actions: priorityActions,
      missing_data: missingData,
      opportunity_summary: opportunitySummary,
      data_sources_used: completeness.available,
      methodology: "Authority Gap Report v1.0. Scores are calculated deterministically from website scan signals, intake answers, uploaded CSV data, and competitive analysis. AI interpretation is used for summaries and strategic language only. Missing data is explicitly labeled. For healthcare clients, all content recommendations should be reviewed for compliance before publication.",
      disclaimers: [
        "This report is generated from available data only. Scores reflect current data completeness and may improve as more data is added.",
        "Revenue estimates, where present, are directional projections based on industry benchmarks and are not guaranteed.",
        "For healthcare and medical practices: all website content changes should be reviewed by a qualified compliance advisor before publication.",
        "Authority Gap Engine™ does not represent or guarantee specific search ranking outcomes.",
      ],
    };

    // 10. Save to Supabase
    const { error: saveError } = await db.from("reports").update({
      report_status: "completed",
      report_json: report,
      report_summary: ai.executive_summary,
      authority_score: scores.authority_score,
      audit_readiness_score: scores.audit_readiness_score,
      foundation_score: scores.foundation_score,
      local_authority_score: scores.local_authority_score,
      service_authority_score: scores.service_authority_score,
      trust_conversion_score: scores.trust_conversion_score,
      competitive_ai_score: scores.competitive_ai_score,
      confidence_level: completeness.level,
      missing_data_json: missingData,
      priority_actions_json: priorityActions,
      updated_at: new Date().toISOString(),
    }).eq("id", reportId);

    if (saveError) {
      logger.warn({ saveError, reportId }, "Could not save report");
    }

    logger.info({ jobId, reportId, authority_score: scores.authority_score }, "Full report generation complete");
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ jobId, reportId, err: msg }, "Full report generation failed");

    await db.from("reports").update({
      report_status: "failed",
      error_message: msg,
      updated_at: new Date().toISOString(),
    }).eq("id", reportId);

    throw err;
  }
}

const worker = new Worker("full-report-jobs", processFullReport, {
  connection: redis,
  concurrency: 1,
});

worker.on("completed", (job) => logger.info({ jobId: job.id }, "Full report worker: completed"));
worker.on("failed", (job, err) => logger.error({ jobId: job?.id, error: err.message }, "Full report worker: failed"));

logger.info("Full report worker started");
