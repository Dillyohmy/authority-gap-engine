/**
 * Integration sync worker — handles Google data pull jobs.
 * Jobs: sync_search_console | sync_google_analytics
 */

import { Queue, Worker, type Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger.js";
import { syncSearchConsoleData } from "../services/searchConsoleService.js";
import { syncGoogleAnalyticsData } from "../services/googleAnalyticsService.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

interface SyncJobData {
  projectId: string;
  userId: string;
  integrationId: string;
  daysBack?: number;
  syncJobId?: string;
}

const redisUrl = process.env.REDIS_URL || "redis://localhost:6380";
const redisEnabled = process.env.REDIS_ENABLED !== "false";

// Export queue so routes can enqueue jobs
export let integrationQueue: Queue | null = null;

if (redisEnabled) {
  const connection = { url: redisUrl };

  integrationQueue = new Queue("integration-sync", { connection });

  const worker = new Worker<SyncJobData>(
    "integration-sync",
    async (job: Job<SyncJobData>) => {
      const { projectId, userId, integrationId, daysBack = 28, syncJobId } = job.data;
      const db = serviceDb();

      // Mark job as running
      if (syncJobId) {
        await db.from("integration_sync_jobs").update({
          status: "running",
          started_at: new Date().toISOString(),
        }).eq("id", syncJobId);
      }

      try {
        // Load integration record (service client bypasses RLS)
        const { data: integration, error } = await db
          .from("project_integrations")
          .select("*")
          .eq("id", integrationId)
          .eq("project_id", projectId)
          .eq("user_id", userId)
          .single();

        if (error || !integration) throw new Error("Integration not found");

        if (job.name === "sync_search_console") {
          await syncSearchConsoleData(db, integration, daysBack);
        } else if (job.name === "sync_google_analytics") {
          await syncGoogleAnalyticsData(db, integration, daysBack);
        } else {
          throw new Error(`Unknown job type: ${job.name}`);
        }

        // Mark sync job complete
        if (syncJobId) {
          await db.from("integration_sync_jobs").update({
            status: "completed",
            completed_at: new Date().toISOString(),
          }).eq("id", syncJobId);
        }

        logger.info({ projectId, integrationId, jobName: job.name }, "Integration sync job completed");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err, projectId, integrationId, jobName: job.name }, "Integration sync job failed");

        // Mark job failed
        if (syncJobId) {
          await db.from("integration_sync_jobs").update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: msg,
          }).eq("id", syncJobId);
        }

        // Update integration error status
        await db.from("project_integrations").update({
          last_sync_status: "error",
          last_sync_error: msg,
          updated_at: new Date().toISOString(),
        }).eq("id", integrationId);

        throw err; // BullMQ will retry
      }
    },
    { connection, concurrency: 3 }
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "Integration job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err }, "Integration job failed");
  });

  logger.info("Integration sync worker started");
} else {
  logger.info("Redis disabled — integration sync worker not started");
}
