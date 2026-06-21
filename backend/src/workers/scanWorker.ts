/**
 * Scan Worker — BullMQ background processor
 *
 * Processes scan jobs through the full pipeline:
 * 1. fetching   — Crawl the website
 * 2. extracting — Parse HTML into structured signals
 * 3. analyzing  — Run rule engine
 * 4. scoring    — Calculate scores
 * 5. generating_report — AI interpretation + report composition
 * 6. completed  — Store result
 */

import "../lib/env.js";
import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { db } from "../lib/db.js";
import { crawlWebsite } from "../services/crawlService.js";
import { extractSignals } from "../services/extractService.js";
import { evaluateRules } from "../services/ruleEngine.js";
import { calculateScores } from "../services/scoringEngine.js";
import { generateInterpretation } from "../services/aiInterpretationService.js";
import { calculateOpportunity } from "../services/opportunityModel.js";
import { composeReport } from "../services/reportComposer.js";
import type { ScanJobStatus, StartScanInput, ScanJob } from "../types/scanReport.js";

async function updateJobStatus(
  jobId: string,
  status: ScanJobStatus,
  error?: string
) {
  // Update Redis (rebuild key if missing so cold-start workers still track status)
  try {
    const raw = await redis.get(`scan:job:${jobId}`);
    const job: ScanJob = raw
      ? JSON.parse(raw)
      : { id: jobId, status: "queued", created_at: new Date(), updated_at: new Date(), input: {} as StartScanInput };
    job.status = status;
    job.updated_at = new Date();
    if (error) job.error = error;
    await redis.set(`scan:job:${jobId}`, JSON.stringify(job), "EX", 86400);
  } catch (err) {
    logger.warn({ jobId, err }, "Could not update Redis job status");
  }

  // Always mirror status to Supabase
  db.from("scans")
    .update({ status, error_message: error ?? null, updated_at: new Date().toISOString() })
    .eq("job_id", jobId)
    .then(({ error: dbErr }) => {
      if (dbErr) logger.warn({ jobId, error: dbErr.message }, "Could not update scan status in Supabase");
    });

  logger.info({ jobId, status }, "Job status updated");
}

async function processScan(job: Job<{ jobId: string; input: StartScanInput }>) {
  const { jobId, input } = job.data;

  try {
    // Step 1: Fetch
    await updateJobStatus(jobId, "fetching");
    const crawlResult = await crawlWebsite(input.website_url);
    logger.info({ jobId, pages: crawlResult.pages.length }, "Crawl complete");

    // Step 2: Extract
    await updateJobStatus(jobId, "extracting");
    const extraction = extractSignals(crawlResult.pages);

    // Step 3: Analyze
    await updateJobStatus(jobId, "analyzing");
    const ruleResult = evaluateRules(extraction);

    // Step 4: Score
    await updateJobStatus(jobId, "scoring");
    const scores = calculateScores(extraction, ruleResult);

    // Step 5: Generate report (AI + opportunity model + composition)
    await updateJobStatus(jobId, "generating_report");

    const [aiInterpretation, opportunity] = await Promise.all([
      generateInterpretation(
        input.website_url,
        input.clinic_type,
        input.location,
        extraction,
        ruleResult,
        scores
      ),
      Promise.resolve(
        calculateOpportunity(
          input.clinic_type,
          input.location,
          scores,
          input.monthly_patient_value,
          input.monthly_traffic
        )
      ),
    ]);

    const report = composeReport(
      jobId,
      input,
      scores,
      ruleResult,
      aiInterpretation,
      opportunity
    );

    // Store result in Redis
    try {
      await redis.set(`scan:result:${jobId}`, JSON.stringify(report), "EX", 86400);
    } catch (err) {
      logger.warn({ jobId, err }, "Could not store result in Redis");
    }

    // Store result in Supabase (durable fallback)
    db.from("scans").update({
      status: "completed",
      authority_gap_score: scores.authority_gap_score,
      visibility_score: scores.visibility_score,
      conversion_score: scores.conversion_score,
      opportunity_score: scores.opportunity_score,
      estimated_revenue_low: report.estimated_revenue_low,
      estimated_revenue_high: report.estimated_revenue_high,
      executive_summary: report.executive_summary,
      report_json: report,
      updated_at: new Date().toISOString(),
    }).eq("job_id", jobId).then(({ error }) => {
      if (error) logger.warn({ jobId, error: error.message }, "Could not store result in Supabase");
      else logger.info({ jobId }, "Scan result saved to Supabase");
    });

    // Step 6: Complete
    await updateJobStatus(jobId, "completed");
    logger.info({ jobId, score: scores.authority_gap_score }, "Scan complete");
  } catch (err) {
    logger.error(err, `Scan failed for job ${jobId}`);
    await updateJobStatus(jobId, "failed", (err as Error).message);
    throw err;
  }
}

// Start worker
const worker = new Worker("scan-jobs", processScan, {
  connection: redis,
  concurrency: 2,
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Worker: job completed");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Worker: job failed");
});

logger.info("Scan worker started");
