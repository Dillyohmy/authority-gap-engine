import { Router, type Request } from "express";
import { Queue } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { redis } from "../lib/redis.js";

const SUPABASE_URL = requireEnv(["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
const SUPABASE_SERVICE_KEY = requireEnv(["SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

function userClient(authHeader: string | undefined) {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

async function getUserId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const { data } = await client.auth.getUser(token);
  return data.user?.id ?? null;
}

function p(req: Request): { projectId: string; reportId: string } {
  return req.params as Record<string, string> as never;
}

let reportQueue: Queue | undefined;
function getReportQueue() {
  reportQueue ??= new Queue("full-report-jobs", { connection: redis });
  return reportQueue;
}

export const reportsRouter = Router({ mergeParams: true });

// POST /api/projects/:projectId/reports/full/start
reportsRouter.post("/full/start", async (req, res, next) => {
  try {
    const { projectId } = p(req);
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);

    // Verify project belongs to user
    const { data: project } = await db.from("projects").select("id, website_url").eq("id", projectId).single();
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Create report record
    const { data: report, error: insertError } = await db.from("reports").insert({
      project_id: projectId,
      user_id: userId,
      report_type: "full_authority_gap_report",
      report_status: "queued",
    }).select().single();

    if (insertError || !report) {
      return res.status(500).json({ error: "Could not create report record" });
    }

    const jobId = `full-report-${report.id}`;
    try {
      await getReportQueue().add("generate-full-report", {
        jobId,
        reportId: report.id,
        projectId,
        userId,
      }, { jobId, attempts: 2, backoff: { type: "exponential", delay: 5000 } });
    } catch (queueErr) {
      await db.from("reports").update({ report_status: "failed", error_message: "Queue unavailable" }).eq("id", report.id);
      return res.status(503).json({ error: "Job queue unavailable. Please try again shortly." });
    }

    logger.info({ reportId: report.id, projectId }, "Full report job queued");
    return res.status(201).json({ report_id: report.id, status: "queued" });
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/reports
reportsRouter.get("/", async (req, res, next) => {
  try {
    const { projectId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data, error } = await db
      .from("reports")
      .select("id, report_type, report_status, authority_score, audit_readiness_score, foundation_score, local_authority_score, service_authority_score, trust_conversion_score, competitive_ai_score, confidence_level, report_summary, created_at, updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/reports/:reportId/status
reportsRouter.get("/:reportId/status", async (req, res, next) => {
  try {
    const { projectId, reportId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data } = await db
      .from("reports")
      .select("id, report_status, error_message, updated_at")
      .eq("id", reportId)
      .eq("project_id", projectId)
      .single();

    if (!data) return res.status(404).json({ error: "Report not found" });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/reports/:reportId
reportsRouter.get("/:reportId", async (req, res, next) => {
  try {
    const { projectId, reportId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data } = await db
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .eq("project_id", projectId)
      .single();

    if (!data) return res.status(404).json({ error: "Report not found" });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/projects/:projectId/reports/:reportId
reportsRouter.delete("/:reportId", async (req, res, next) => {
  try {
    const { projectId, reportId } = p(req);
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);
    const { error } = await db.from("reports").delete().eq("id", reportId).eq("project_id", projectId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
