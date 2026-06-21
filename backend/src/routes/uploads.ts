import { Router, type Request } from "express";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { Queue } from "bullmq";
import { requireEnv } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { redis } from "../lib/redis.js";
import {
  UPLOAD_CATEGORIES,
  PARSEABLE_CATEGORIES,
  CATEGORY_TO_DATA_TYPE,
  type UploadCategory,
} from "../config/uploadCategories.js";

const SUPABASE_URL = requireEnv([
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
]);
const SUPABASE_SERVICE_KEY = requireEnv([
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
const STORAGE_BUCKET = "project-uploads";

export const uploadsRouter = Router({ mergeParams: true });

// Helper: extract merged params (projectId from parent + uploadId from this router)
function p(req: Request): { projectId: string; uploadId: string } {
  const params = req.params as Record<string, string>;
  return { projectId: params.projectId ?? "", uploadId: params.uploadId ?? "" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function userClient(authHeader: string | undefined) {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

async function getUserId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser(token);
  return data.user?.id ?? null;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase()
    .slice(0, 200);
}

function buildStoragePath(
  userId: string,
  projectId: string,
  category: string,
  fileName: string
): string {
  const ts = Date.now();
  const safe = sanitizeFileName(fileName);
  return `${userId}/${projectId}/${category}/${ts}_${safe}`;
}

// Lazy parse queue — only used when Redis is available
let _parseQueue: Queue | null = null;
function getParseQueue(): Queue | null {
  try {
    if (!_parseQueue) {
      _parseQueue = new Queue("parse-jobs", { connection: redis });
    }
    return _parseQueue;
  } catch {
    return null;
  }
}

async function enqueueParseJob(uploadId: string, category: UploadCategory) {
  const q = getParseQueue();
  if (!q) {
    logger.warn({ uploadId }, "Redis unavailable — parse job not queued");
    return;
  }
  await q.add("parse_csv_file", { uploadId, category }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  });
  logger.info({ uploadId, category }, "Parse job queued");
}

// ── Validation schemas ────────────────────────────────────────────────────────

const VALID_CATEGORIES = Object.keys(UPLOAD_CATEGORIES) as [UploadCategory, ...UploadCategory[]];

const InitiateUploadSchema = z.object({
  file_category: z.enum(VALID_CATEGORIES),
  original_file_name: z.string().min(1).max(500),
  mime_type: z.string().min(1),
  file_size: z.number().int().positive(),
});

const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

// ── POST /api/projects/:projectId/uploads ──────────────────────────────────────
// Step 1: Create upload record + return signed upload URL
uploadsRouter.post("/", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = InitiateUploadSchema.parse(req.body);
    const catDef = UPLOAD_CATEGORIES[body.file_category];

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(body.mime_type)) {
      return res.status(400).json({ error: `File type not allowed: ${body.mime_type}` });
    }
    if (!catDef.acceptedMimeTypes.includes(body.mime_type)) {
      return res.status(400).json({
        error: `File type ${body.mime_type} is not accepted for ${catDef.label}`,
      });
    }

    // Validate file size
    if (body.file_size > catDef.maxSizeBytes) {
      const maxMB = Math.round(catDef.maxSizeBytes / (1024 * 1024));
      return res.status(400).json({ error: `File exceeds ${maxMB}MB limit` });
    }

    const db = userClient(req.headers.authorization);
    const { projectId } = p(req);

    // Verify project ownership
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (!project) return res.status(404).json({ error: "Project not found" });

    const fileName = sanitizeFileName(body.original_file_name);
    const storagePath = buildStoragePath(userId, projectId, body.file_category, fileName);
    const fileType = catDef.fileType;
    const parseStatus = PARSEABLE_CATEGORIES.includes(body.file_category)
      ? "pending"
      : "not_required";

    // Create upload record
    const { data: uploadRecord, error: insertError } = await db
      .from("uploaded_files")
      .insert({
        project_id: projectId,
        user_id: userId,
        file_name: fileName,
        original_file_name: body.original_file_name,
        file_category: body.file_category,
        file_type: fileType,
        mime_type: body.mime_type,
        file_size: body.file_size,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        upload_status: "pending",
        parse_status: parseStatus,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Generate signed upload URL (frontend will PUT directly to this URL)
    const svc = serviceClient();
    const { data: signedData, error: signedError } = await svc.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedError) {
      // Cleanup record on storage error
      await db.from("uploaded_files").delete().eq("id", uploadRecord.id);
      logger.error({ error: signedError.message }, "Failed to create signed upload URL");
      return res.status(500).json({ error: "Failed to prepare upload. Please try again." });
    }

    logger.info({ uploadId: uploadRecord.id, category: body.file_category }, "Upload initiated");

    res.status(201).json({
      upload: uploadRecord,
      signed_url: signedData.signedUrl,
      token: signedData.token,
      storage_path: storagePath,
    });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    next(err);
  }
});

// ── POST /api/projects/:projectId/uploads/:uploadId/confirm ────────────────────
// Step 2: Mark upload as complete, enqueue parse job
uploadsRouter.post("/:uploadId/confirm", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, uploadId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data: upload, error } = await db
      .from("uploaded_files")
      .update({ upload_status: "uploaded", updated_at: new Date().toISOString() })
      .eq("id", uploadId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !upload) return res.status(404).json({ error: "Upload record not found" });

    // Queue parse job for CSVs
    if (PARSEABLE_CATEGORIES.includes(upload.file_category as UploadCategory)) {
      await enqueueParseJob(uploadId, upload.file_category as UploadCategory);
    }

    logger.info({ uploadId, category: upload.file_category }, "Upload confirmed");
    res.json({ upload });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/projects/:projectId/uploads ──────────────────────────────────────
uploadsRouter.get("/", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { data, error } = await db
      .from("uploaded_files")
      .select(
        "id, file_name, original_file_name, file_category, file_type, mime_type, file_size, upload_status, parse_status, parse_error, created_at, updated_at"
      )
      .eq("project_id", projectId)
      .neq("upload_status", "deleted")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ uploads: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/projects/:projectId/uploads/:uploadId ────────────────────────────
uploadsRouter.get("/:uploadId", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, uploadId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data, error } = await db
      .from("uploaded_files")
      .select("*")
      .eq("id", uploadId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (error || !data) return res.status(404).json({ error: "Not found" });
    res.json({ upload: data });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/projects/:projectId/uploads/:uploadId ─────────────────────────
uploadsRouter.delete("/:uploadId", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, uploadId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data: upload } = await db
      .from("uploaded_files")
      .select("storage_path, storage_bucket")
      .eq("id", uploadId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (!upload) return res.status(404).json({ error: "Not found" });

    // Delete from storage (best-effort)
    try {
      const svc = serviceClient();
      await svc.storage.from(upload.storage_bucket).remove([upload.storage_path]);
    } catch (storageErr) {
      logger.warn({ uploadId, error: storageErr }, "Storage deletion failed (continuing)");
    }

    // Soft-delete: mark as deleted + cascade deletes parsed_file_data via FK
    await db
      .from("uploaded_files")
      .update({ upload_status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", uploadId);

    logger.info({ uploadId }, "Upload deleted");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/projects/:projectId/uploads/:uploadId/parse ─────────────────────
// Manually trigger or re-trigger parsing
uploadsRouter.post("/:uploadId/parse", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, uploadId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data: upload } = await db
      .from("uploaded_files")
      .select("id, file_category, upload_status, parse_status")
      .eq("id", uploadId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (!upload) return res.status(404).json({ error: "Not found" });
    if (upload.upload_status !== "uploaded") {
      return res.status(400).json({ error: "File has not been uploaded yet" });
    }
    if (!PARSEABLE_CATEGORIES.includes(upload.file_category as UploadCategory)) {
      return res.status(400).json({ error: "This file type does not support parsing" });
    }

    // Reset parse status
    await db
      .from("uploaded_files")
      .update({ parse_status: "pending", parse_error: null })
      .eq("id", uploadId);

    await enqueueParseJob(uploadId, upload.file_category as UploadCategory);
    res.json({ success: true, parse_status: "pending" });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/projects/:projectId/uploads/:uploadId/parse-status ───────────────
uploadsRouter.get("/:uploadId/parse-status", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, uploadId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data, error } = await db
      .from("uploaded_files")
      .select("id, parse_status, parse_error, updated_at")
      .eq("id", uploadId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (error || !data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/projects/:projectId/uploads/:uploadId/summary ────────────────────
uploadsRouter.get("/:uploadId/summary", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, uploadId } = p(req);
    const db = userClient(req.headers.authorization);

    // Verify ownership
    const { data: upload } = await db
      .from("uploaded_files")
      .select("id")
      .eq("id", uploadId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();
    if (!upload) return res.status(404).json({ error: "Not found" });

    const { data, error } = await db
      .from("parsed_file_data")
      .select("id, data_type, row_count, column_headers, summary_json, created_at")
      .eq("uploaded_file_id", uploadId)
      .single();

    if (error || !data) return res.status(404).json({ error: "No parsed data available" });
    res.json({ parsed: data });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/projects/:projectId/uploads/:uploadId/signed-url ─────────────────
// Generate a temporary download URL for viewing a file
uploadsRouter.get("/:uploadId/signed-url", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, uploadId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data: upload } = await db
      .from("uploaded_files")
      .select("storage_path, storage_bucket, upload_status")
      .eq("id", uploadId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (!upload) return res.status(404).json({ error: "Not found" });
    if (upload.upload_status !== "uploaded") {
      return res.status(400).json({ error: "File not yet uploaded" });
    }

    const svc = serviceClient();
    const { data, error } = await svc.storage
      .from(upload.storage_bucket)
      .createSignedUrl(upload.storage_path, 3600); // 1 hour

    if (error) return res.status(500).json({ error: "Could not generate download URL" });
    res.json({ signed_url: data.signedUrl, expires_in: 3600 });
  } catch (err) {
    next(err);
  }
});
