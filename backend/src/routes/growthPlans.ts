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

function p(req: Request): Record<string, string> {
  return req.params as Record<string, string>;
}

let growthPlanQueue: Queue | undefined;
function getGrowthPlanQueue() {
  growthPlanQueue ??= new Queue("growth-plan-jobs", { connection: redis });
  return growthPlanQueue;
}

export const growthPlansRouter = Router({ mergeParams: true });

// POST /api/projects/:projectId/growth-plans/start?reportId=<id>
growthPlansRouter.post("/start", async (req, res, next) => {
  try {
    const { projectId } = p(req);
    const reportId = (req.query.reportId as string) || (req.body?.reportId as string);
    if (!reportId) return res.status(400).json({ error: "reportId is required" });

    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);

    // Verify project belongs to user
    const { data: project } = await db.from("projects").select("id").eq("id", projectId).single();
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Verify source report is completed
    const { data: report } = await db
      .from("reports")
      .select("id, report_status")
      .eq("id", reportId)
      .eq("project_id", projectId)
      .single();

    if (!report) return res.status(404).json({ error: "Source report not found" });
    if (report.report_status !== "completed") {
      return res.status(422).json({ error: "Source report must be completed before generating a growth plan" });
    }

    // Create plan record
    const { data: plan, error: insertError } = await db.from("growth_plans").insert({
      project_id: projectId,
      user_id: userId,
      source_report_id: reportId,
      plan_type: "personal_authority_growth_plan",
      plan_status: "queued",
    }).select().single();

    if (insertError || !plan) {
      logger.error({ insertError }, "Could not create growth plan record");
      return res.status(500).json({ error: "Could not create growth plan record" });
    }

    const jobId = `growth-plan-${plan.id}`;
    try {
      await getGrowthPlanQueue().add("generate-growth-plan", {
        jobId,
        planId: plan.id,
        projectId,
        reportId,
        userId,
      }, { jobId, attempts: 2, backoff: { type: "exponential", delay: 5000 } });
    } catch (queueErr) {
      await db.from("growth_plans").update({ plan_status: "failed", error_message: "Queue unavailable" }).eq("id", plan.id);
      return res.status(503).json({ error: "Job queue unavailable. Please try again shortly." });
    }

    logger.info({ planId: plan.id, projectId, reportId }, "Growth plan job queued");
    return res.status(201).json({ plan_id: plan.id, status: "queued" });
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/growth-plans
growthPlansRouter.get("/", async (req, res, next) => {
  try {
    const { projectId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data, error } = await db
      .from("growth_plans")
      .select("id, plan_type, plan_status, summary, authority_score_start, target_authority_score, confidence_level, source_report_id, created_at, updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/growth-plans/:planId/status
growthPlansRouter.get("/:planId/status", async (req, res, next) => {
  try {
    const { projectId, planId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data } = await db
      .from("growth_plans")
      .select("id, plan_status, error_message, updated_at")
      .eq("id", planId)
      .eq("project_id", projectId)
      .single();

    if (!data) return res.status(404).json({ error: "Growth plan not found" });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/growth-plans/:planId
growthPlansRouter.get("/:planId", async (req, res, next) => {
  try {
    const { projectId, planId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data } = await db
      .from("growth_plans")
      .select("*")
      .eq("id", planId)
      .eq("project_id", projectId)
      .single();

    if (!data) return res.status(404).json({ error: "Growth plan not found" });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/growth-plans/:planId/tasks
growthPlansRouter.get("/:planId/tasks", async (req, res, next) => {
  try {
    const { projectId, planId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data, error } = await db
      .from("growth_plan_tasks")
      .select("*")
      .eq("growth_plan_id", planId)
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/projects/:projectId/growth-plans/:planId/tasks/:taskId
growthPlansRouter.patch("/:planId/tasks/:taskId", async (req, res, next) => {
  try {
    const { projectId, planId, taskId } = p(req);
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { status } = req.body as { status: string };
    const allowed = ["not_started", "in_progress", "completed", "blocked", "skipped"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    }

    const db = userClient(req.headers.authorization);
    const { data, error } = await db
      .from("growth_plan_tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("growth_plan_id", planId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Task not found" });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/projects/:projectId/growth-plans/:planId
growthPlansRouter.delete("/:planId", async (req, res, next) => {
  try {
    const { projectId, planId } = p(req);
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);
    const { error } = await db.from("growth_plans").delete().eq("id", planId).eq("project_id", projectId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
