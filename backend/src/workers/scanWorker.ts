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
  const raw = await redis.get(`scan:job:${jobId}`);
  if (!raw) return;
  const job: ScanJob = JSON.parse(raw);
  job.status = status;
  job.updated_at = new Date();
  if (error) job.error = error;
  await redis.set(`scan:job:${jobId}`, JSON.stringify(job), "EX", 3600);
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

    // Store result
    await redis.set(`scan:result:${jobId}`, JSON.stringify(report), "EX", 86400);

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
