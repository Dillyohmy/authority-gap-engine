import "../lib/env.js";
import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { db } from "../lib/db.js";
import { crawlWebsite } from "../services/crawlService.js";
import { extractCompetitorSignals } from "../services/competitorExtractService.js";

interface CompetitorCrawlJobData {
  jobId: string;
  competitorId: string;
  projectId: string;
  userId: string;
  websiteUrl: string;
}

const CRAWL_PAGE_LIMIT = 5;

async function processCompetitorCrawl(job: Job<CompetitorCrawlJobData>) {
  const { jobId, competitorId, projectId, userId, websiteUrl } = job.data;

  logger.info({ jobId, competitorId, websiteUrl }, "Starting competitor crawl");

  // Mark processing
  await db.from("competitors").update({
    crawl_status: "processing",
    updated_at: new Date().toISOString(),
  }).eq("id", competitorId);

  try {
    // Crawl up to CRAWL_PAGE_LIMIT pages
    const crawlResult = await crawlWebsite(websiteUrl);
    const pages = crawlResult.pages.slice(0, CRAWL_PAGE_LIMIT);

    logger.info({ jobId, competitorId, pages: pages.length }, "Competitor crawl complete");

    const { pages: extractedPages, summary } = extractCompetitorSignals(pages);

    // Store crawl result
    const { error: insertError } = await db.from("competitor_crawl_results").insert({
      competitor_id: competitorId,
      project_id: projectId,
      user_id: userId,
      crawl_job_id: jobId,
      pages_crawled: pages.length,
      crawl_limit: CRAWL_PAGE_LIMIT,
      crawl_status: "completed",
      extracted_json: extractedPages,
      summary_json: summary,
    });

    if (insertError) {
      logger.warn({ insertError, competitorId }, "Could not save crawl result");
    }

    // Mark competitor as crawled
    await db.from("competitors").update({
      crawl_status: "completed",
      last_crawled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", competitorId);

    logger.info({ jobId, competitorId }, "Competitor crawl saved");
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ jobId, competitorId, err: msg }, "Competitor crawl failed");

    await db.from("competitors").update({
      crawl_status: "failed",
      updated_at: new Date().toISOString(),
    }).eq("id", competitorId);

    await db.from("competitor_crawl_results").insert({
      competitor_id: competitorId,
      project_id: projectId,
      user_id: userId,
      crawl_job_id: jobId,
      pages_crawled: 0,
      crawl_limit: CRAWL_PAGE_LIMIT,
      crawl_status: "failed",
      crawl_error: msg,
    }).then(() => {});

    throw err;
  }
}

const worker = new Worker("competitor-crawl-jobs", processCompetitorCrawl, {
  connection: redis,
  concurrency: 2,
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Competitor crawl worker: job completed");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Competitor crawl worker: job failed");
});

logger.info("Competitor crawl worker started");
