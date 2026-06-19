import { Router } from "express";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import {
  INTAKE_SECTIONS,
  ALL_QUESTIONS,
  REQUIRED_QUESTION_IDS,
} from "../config/intakeQuestions.js";

const SUPABASE_URL = requireEnv([
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
]);

const SUPABASE_SERVICE_KEY = requireEnv([
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

export const projectRouter = Router();

// Build a per-request Supabase client scoped to the user's JWT so RLS applies.
function userClient(authHeader: string | undefined) {
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authHeader
      ? { headers: { Authorization: authHeader } }
      : undefined,
  });
  return client;
}

// Extract user from JWT via service client
async function getUserId(
  authHeader: string | undefined
): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { createClient: cc } = await import("@supabase/supabase-js");
  const anon = cc(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data } = await anon.auth.getUser(token);
  return data.user?.id ?? null;
}

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  website_url: z.string().url().optional().or(z.literal("")),
  clinic_type: z.string().optional(),
  location: z.string().optional(),
});

const UpsertAnswersSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

const UpdateStatusSchema = z.object({
  status: z.enum(["intake", "ready", "auditing", "complete"]),
});

// ── GET /api/projects ─────────────────────────────────────────────────────────
projectRouter.get("/", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);
    const { data, error } = await db
      .from("projects")
      .select("id, name, website_url, clinic_type, location, status, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    res.json({ projects: data });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/projects ────────────────────────────────────────────────────────
projectRouter.post("/", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = CreateProjectSchema.parse(req.body);
    const db = userClient(req.headers.authorization);

    const { data, error } = await db
      .from("projects")
      .insert({ ...body, user_id: userId, status: "intake" })
      .select()
      .single();

    if (error) throw error;
    logger.info({ projectId: data.id, userId }, "Project created");
    res.status(201).json({ project: data });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    next(err);
  }
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────────
projectRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);
    const { data, error } = await db
      .from("projects")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (error || !data) return res.status(404).json({ error: "Not found" });
    res.json({ project: data });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/projects/:id/status ────────────────────────────────────────────
projectRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { status } = UpdateStatusSchema.parse(req.body);
    const db = userClient(req.headers.authorization);

    const patch: Record<string, unknown> = { status };
    if (status === "ready") patch.intake_completed_at = new Date().toISOString();

    const { data, error } = await db
      .from("projects")
      .update(patch)
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Not found" });
    logger.info({ projectId: req.params.id, status }, "Project status updated");
    res.json({ project: data });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    next(err);
  }
});

// ── GET /api/projects/:id/answers ─────────────────────────────────────────────
projectRouter.get("/:id/answers", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);

    // Verify ownership
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();
    if (!project) return res.status(404).json({ error: "Not found" });

    const { data, error } = await db
      .from("intake_answers")
      .select("question_id, value, updated_at")
      .eq("project_id", req.params.id);

    if (error) throw error;

    // Return as { questionId: value } map
    const answers: Record<string, unknown> = {};
    for (const row of data ?? []) {
      answers[row.question_id] = row.value;
    }
    res.json({ answers });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/projects/:id/answers ─────────────────────────────────────────────
// Upserts one or more answers. Partial updates are fine.
projectRouter.put("/:id/answers", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { answers } = UpsertAnswersSchema.parse(req.body);
    const db = userClient(req.headers.authorization);

    // Verify ownership
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();
    if (!project) return res.status(404).json({ error: "Not found" });

    // Valid question ids only
    const validIds = new Set(ALL_QUESTIONS.map((q) => q.id));
    const rows = Object.entries(answers)
      .filter(([qid]) => validIds.has(qid))
      .map(([question_id, value]) => ({
        project_id: req.params.id,
        question_id,
        value,
        updated_at: new Date().toISOString(),
      }));

    if (rows.length === 0) return res.json({ saved: 0 });

    const { error } = await db
      .from("intake_answers")
      .upsert(rows, { onConflict: "project_id,question_id" });

    if (error) throw error;

    // Bump project updated_at
    await db
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", req.params.id);

    res.json({ saved: rows.length });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    next(err);
  }
});

// ── GET /api/projects/:id/progress ────────────────────────────────────────────
projectRouter.get("/:id/progress", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();
    if (!project) return res.status(404).json({ error: "Not found" });

    const { data: answerRows } = await db
      .from("intake_answers")
      .select("question_id, value")
      .eq("project_id", req.params.id);

    const answered = new Set(
      (answerRows ?? [])
        .filter((r) => {
          const v = r.value;
          if (v === null || v === undefined) return false;
          if (typeof v === "string" && v.trim() === "") return false;
          if (Array.isArray(v) && v.length === 0) return false;
          return true;
        })
        .map((r) => r.question_id)
    );

    const sections = INTAKE_SECTIONS.map((section) => {
      const total = section.questions.length;
      const done = section.questions.filter((q) => answered.has(q.id)).length;
      const requiredTotal = section.questions.filter((q) => q.required).length;
      const requiredDone = section.questions.filter(
        (q) => q.required && answered.has(q.id)
      ).length;
      return {
        id: section.id,
        title: section.title,
        total,
        done,
        requiredTotal,
        requiredDone,
        complete: requiredDone === requiredTotal,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });

    const totalQuestions = ALL_QUESTIONS.length;
    const totalAnswered = ALL_QUESTIONS.filter((q) => answered.has(q.id)).length;
    const totalRequired = REQUIRED_QUESTION_IDS.size;
    const requiredAnswered = [...REQUIRED_QUESTION_IDS].filter((id) =>
      answered.has(id)
    ).length;

    res.json({
      sections,
      totalQuestions,
      totalAnswered,
      totalRequired,
      requiredAnswered,
      overallPct: Math.round((totalAnswered / totalQuestions) * 100),
      readyForAudit: requiredAnswered === totalRequired,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/projects/:id/missing ─────────────────────────────────────────────
projectRouter.get("/:id/missing", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();
    if (!project) return res.status(404).json({ error: "Not found" });

    const { data: answerRows } = await db
      .from("intake_answers")
      .select("question_id, value")
      .eq("project_id", req.params.id);

    const answered = new Set(
      (answerRows ?? [])
        .filter((r) => {
          const v = r.value;
          if (v === null || v === undefined) return false;
          if (typeof v === "string" && v.trim() === "") return false;
          if (Array.isArray(v) && v.length === 0) return false;
          return true;
        })
        .map((r) => r.question_id)
    );

    const missing = ALL_QUESTIONS.filter(
      (q) => q.required && !answered.has(q.id)
    ).map((q) => {
      const section = INTAKE_SECTIONS.find((s) =>
        s.questions.some((sq) => sq.id === q.id)
      );
      return {
        questionId: q.id,
        label: q.label,
        sectionId: section?.id,
        sectionTitle: section?.title,
      };
    });

    const optional = ALL_QUESTIONS.filter(
      (q) => !q.required && !answered.has(q.id)
    ).map((q) => {
      const section = INTAKE_SECTIONS.find((s) =>
        s.questions.some((sq) => sq.id === q.id)
      );
      return {
        questionId: q.id,
        label: q.label,
        sectionId: section?.id,
        sectionTitle: section?.title,
      };
    });

    res.json({ missing, optional });
  } catch (err) {
    next(err);
  }
});
