/**
 * Parse Worker — BullMQ background processor for CSV file parsing
 *
 * Consumes jobs from the "parse-jobs" queue.
 * Each job fetches a file from Supabase Storage, parses it, and stores
 * the results in parsed_file_data.
 */

import "../lib/env.js";
import { Worker, type Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { requireEnv } from "../lib/env.js";
import { parseCsvByCategory } from "../services/csvParsers/index.js";
import { PARSEABLE_CATEGORIES } from "../config/uploadCategories.js";
import type { UploadCategory } from "../config/uploadCategories.js";

const SUPABASE_URL = requireEnv([
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
]);
const SUPABASE_SERVICE_KEY = requireEnv([
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

interface ParseJobData {
  uploadId: string;
  category: UploadCategory;
}

async function processParseJob(job: Job<ParseJobData>) {
  const { uploadId, category } = job.data;
  const supabase = db();

  logger.info({ uploadId, category }, "Parse job started");

  // Mark as processing
  await supabase
    .from("uploaded_files")
    .update({ parse_status: "processing", updated_at: new Date().toISOString() })
    .eq("id", uploadId);

  try {
    // Fetch the upload record
    const { data: upload, error: fetchError } = await supabase
      .from("uploaded_files")
      .select("storage_path, storage_bucket, upload_status, project_id, user_id")
      .eq("id", uploadId)
      .single();

    if (fetchError || !upload) {
      throw new Error(`Upload record not found: ${uploadId}`);
    }

    if (upload.upload_status !== "uploaded") {
      throw new Error(`Upload not ready (status: ${upload.upload_status})`);
    }

    if (!PARSEABLE_CATEGORIES.includes(category)) {
      throw new Error(`Category is not parseable: ${category}`);
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(upload.storage_bucket)
      .download(upload.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const csvText = await fileData.text();

    if (!csvText || csvText.trim().length === 0) {
      throw new Error("File is empty");
    }

    // Parse CSV
    const result = parseCsvByCategory(csvText, category);

    if (result.rowCount === 0) {
      throw new Error("CSV parsed but no data rows found. Check file format.");
    }

    // Store parsed data (upsert in case of re-parse)
    const { error: upsertError } = await supabase
      .from("parsed_file_data")
      .upsert(
        {
          uploaded_file_id: uploadId,
          project_id: upload.project_id,
          user_id: upload.user_id,
          data_type: result.dataType,
          row_count: result.rowCount,
          column_headers: result.columnHeaders,
          parsed_json: result.rows,
          summary_json: result.summary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "uploaded_file_id" }
      );

    if (upsertError) {
      throw new Error(`Failed to store parsed data: ${upsertError.message}`);
    }

    // Mark as parsed
    await supabase
      .from("uploaded_files")
      .update({
        parse_status: "parsed",
        parse_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", uploadId);

    logger.info({ uploadId, category, rowCount: result.rowCount }, "Parse job complete");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ uploadId, category, error: message }, "Parse job failed");

    await supabase
      .from("uploaded_files")
      .update({
        parse_status: "failed",
        parse_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", uploadId);

    throw err; // Let BullMQ handle retries
  }
}

const worker = new Worker("parse-jobs", processParseJob, {
  connection: redis,
  concurrency: 3,
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, uploadId: job.data.uploadId }, "Parse worker: job completed");
});

worker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, uploadId: job?.data?.uploadId, error: err.message },
    "Parse worker: job failed"
  );
});

worker.on("error", (err) => {
  logger.error({ error: err.message }, "Parse worker error");
});

logger.info("Parse worker started, listening on queue: parse-jobs");

// Graceful shutdown
async function shutdown() {
  logger.info("Parse worker shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
