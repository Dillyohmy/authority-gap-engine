import { Router, type Request } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireEnv } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { buildDashboardViewModel } from "../services/dashboardService.js";

const SUPABASE_URL = requireEnv(["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
const SUPABASE_SERVICE_KEY = requireEnv(["SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

export const dashboardRouter = Router({ mergeParams: true });

function p(req: Request): { projectId: string; taskId: string } {
  return req.params as Record<string, string> as never;
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
  const anon = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const { data } = await anon.auth.getUser(token);
  return data.user?.id ?? null;
}

// ── GET /api/projects/:projectId/dashboard ────────────────────────────────────
dashboardRouter.get("/", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId } = p(req);
    const db = userClient(req.headers.authorization);

    const viewModel = await buildDashboardViewModel(db, projectId, userId);
    res.json(viewModel);
  } catch (err) {
    logger.error({ err }, "Dashboard view model failed");
    next(err);
  }
});

// ── PATCH /api/projects/:projectId/dashboard/tasks/:taskId ────────────────────
// Update growth plan task status directly from the dashboard
const UpdateTaskStatusSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed", "blocked", "skipped"]),
});

dashboardRouter.patch("/tasks/:taskId", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { taskId } = p(req);
    const { status } = UpdateTaskStatusSchema.parse(req.body);
    const db = userClient(req.headers.authorization);

    const { data, error } = await db
      .from("growth_plan_tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId)
      .select("id, status")
      .single();

    if (error || !data) return res.status(404).json({ error: "Task not found" });
    res.json({ task: data });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: "Invalid status", details: err.errors });
    next(err);
  }
});
