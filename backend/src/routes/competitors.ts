import { Router, type Request } from "express";
import { z } from "zod";
import { Queue } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { redis } from "../lib/redis.js";
import { validateCompetitorUrl } from "../lib/urlValidator.js";

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

// Lazy BullMQ queues
let crawlQueue: Queue | undefined;
let analysisQueue: Queue | undefined;

function getCrawlQueue() {
  crawlQueue ??= new Queue("competitor-crawl-jobs", { connection: redis });
  return crawlQueue;
}

function getAnalysisQueue() {
  analysisQueue ??= new Queue("competitor-analysis-jobs", { connection: redis });
  return analysisQueue;
}

// Merge projectId + competitorId params helper (mergeParams: true)
function p(req: Request): { projectId: string; competitorId: string } {
  return req.params as Record<string, string> as never;
}

export const competitorsRouter = Router({ mergeParams: true });

const CompetitorSchema = z.object({
  business_name: z.string().min(1).max(200),
  website_url: z.string().url().optional().nullable(),
  gbp_url: z.string().url().optional().nullable(),
  competitor_type: z.enum(["map_pack", "organic", "both"]).default("both"),
  search_phrase: z.string().max(300).optional().nullable(),
  city_searched_from: z.string().max(200).optional().nullable(),
  observed_map_pack_rank: z.number().int().min(1).max(20).optional().nullable(),
  observed_organic_rank: z.number().int().min(1).max(100).optional().nullable(),
  review_count: z.number().int().min(0).optional().nullable(),
  star_rating: z.number().min(0).max(5).optional().nullable(),
  primary_gbp_category: z.string().max(200).optional().nullable(),
  secondary_gbp_categories: z.array(z.string()).max(10).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// POST /api/projects/:projectId/competitors
competitorsRouter.post("/", async (req, res, next) => {
  try {
    const { projectId } = p(req);
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = CompetitorSchema.parse(req.body);

    // Validate URLs for SSRF prevention
    if (body.website_url) {
      const check = validateCompetitorUrl(body.website_url);
      if (!check.valid) return res.status(400).json({ error: check.reason });
    }
    if (body.gbp_url) {
      const check = validateCompetitorUrl(body.gbp_url);
      if (!check.valid) return res.status(400).json({ error: check.reason });
    }

    // Check project belongs to user
    const db = userClient(req.headers.authorization);
    const { data: project } = await db.from("projects").select("id").eq("id", projectId).single();
    if (!project) return res.status(404).json({ error: "Project not found" });

    // MVP: max 3 competitors per project
    const { count } = await db
      .from("competitors")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    if ((count ?? 0) >= 3) {
      return res.status(400).json({ error: "Maximum 3 competitors per project in the current plan" });
    }

    const { data, error } = await db.from("competitors").insert({
      project_id: projectId,
      user_id: userId,
      ...body,
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: err.errors });
    return next(err);
  }
});

// GET /api/projects/:projectId/competitors
competitorsRouter.get("/", async (req, res, next) => {
  try {
    const { projectId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data, error } = await db
      .from("competitors")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/competitors/:competitorId
competitorsRouter.get("/:competitorId", async (req, res, next) => {
  try {
    const { projectId, competitorId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data, error } = await db
      .from("competitors")
      .select("*")
      .eq("id", competitorId)
      .eq("project_id", projectId)
      .single();

    if (error || !data) return res.status(404).json({ error: "Competitor not found" });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/projects/:projectId/competitors/:competitorId
competitorsRouter.patch("/:competitorId", async (req, res, next) => {
  try {
    const { projectId, competitorId } = p(req);
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = CompetitorSchema.partial().parse(req.body);

    if (body.website_url) {
      const check = validateCompetitorUrl(body.website_url);
      if (!check.valid) return res.status(400).json({ error: check.reason });
    }
    if (body.gbp_url) {
      const check = validateCompetitorUrl(body.gbp_url);
      if (!check.valid) return res.status(400).json({ error: check.reason });
    }

    const db = userClient(req.headers.authorization);
    const { data, error } = await db
      .from("competitors")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", competitorId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Competitor not found" });
    return res.json(data);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: err.errors });
    return next(err);
  }
});

// DELETE /api/projects/:projectId/competitors/:competitorId
competitorsRouter.delete("/:competitorId", async (req, res, next) => {
  try {
    const { projectId, competitorId } = p(req);
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);
    const { error } = await db
      .from("competitors")
      .delete()
      .eq("id", competitorId)
      .eq("project_id", projectId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// POST /api/projects/:projectId/competitors/:competitorId/crawl
competitorsRouter.post("/:competitorId/crawl", async (req, res, next) => {
  try {
    const { projectId, competitorId } = p(req);
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);
    const { data: competitor } = await db
      .from("competitors")
      .select("*")
      .eq("id", competitorId)
      .eq("project_id", projectId)
      .single();

    if (!competitor) return res.status(404).json({ error: "Competitor not found" });
    if (!competitor.website_url) return res.status(400).json({ error: "Competitor has no website URL" });

    const check = validateCompetitorUrl(competitor.website_url);
    if (!check.valid) return res.status(400).json({ error: check.reason });

    const jobId = `comp-crawl-${competitorId}-${Date.now()}`;

    await db.from("competitors").update({
      crawl_status: "queued",
      crawl_job_id: jobId,
      updated_at: new Date().toISOString(),
    }).eq("id", competitorId);

    try {
      await getCrawlQueue().add("crawl-competitor", {
        jobId,
        competitorId,
        projectId,
        userId,
        websiteUrl: competitor.website_url,
      }, { jobId, attempts: 2, backoff: { type: "exponential", delay: 5000 } });
    } catch (queueErr) {
      logger.warn({ queueErr, competitorId }, "Could not enqueue competitor crawl");
      await db.from("competitors").update({ crawl_status: "not_started", crawl_job_id: null }).eq("id", competitorId);
      return res.status(503).json({ error: "Job queue unavailable. Please try again shortly." });
    }

    logger.info({ competitorId, jobId }, "Competitor crawl queued");
    return res.json({ job_id: jobId, status: "queued" });
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/competitors/:competitorId/crawl-status
competitorsRouter.get("/:competitorId/crawl-status", async (req, res, next) => {
  try {
    const { projectId, competitorId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data } = await db
      .from("competitors")
      .select("crawl_status, crawl_job_id, last_crawled_at")
      .eq("id", competitorId)
      .eq("project_id", projectId)
      .single();

    if (!data) return res.status(404).json({ error: "Competitor not found" });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/competitors/:competitorId/crawl-result
competitorsRouter.get("/:competitorId/crawl-result", async (req, res, next) => {
  try {
    const { projectId, competitorId } = p(req);
    const db = userClient(req.headers.authorization);
    const { data } = await db
      .from("competitor_crawl_results")
      .select("*")
      .eq("competitor_id", competitorId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!data) return res.status(404).json({ error: "No crawl result found" });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

// POST /api/projects/:projectId/competitive-analysis/start  (handled in competitive-analysis router)
// GET  /api/projects/:projectId/competitive-analysis        (handled in competitive-analysis router)

export const competitiveAnalysisRouter = Router({ mergeParams: true });

// POST /api/projects/:projectId/competitive-analysis/start
competitiveAnalysisRouter.post("/start", async (req, res, next) => {
  try {
    const projectId = (req.params as Record<string, string>).projectId;
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = userClient(req.headers.authorization);

    // Must have at least 1 crawled competitor
    const { data: crawled } = await db
      .from("competitors")
      .select("id")
      .eq("project_id", projectId)
      .eq("crawl_status", "completed");

    if (!crawled || crawled.length === 0) {
      return res.status(400).json({ error: "At least one competitor must be crawled before running analysis" });
    }

    // Upsert analysis record
    const { data: existing } = await db
      .from("competitive_gap_analysis")
      .select("id")
      .eq("project_id", projectId)
      .single();

    let analysisId: string;
    if (existing) {
      await db.from("competitive_gap_analysis").update({
        status: "queued",
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      analysisId = existing.id;
    } else {
      const { data: created } = await db.from("competitive_gap_analysis").insert({
        project_id: projectId,
        user_id: userId,
        status: "queued",
      }).select().single();
      analysisId = created!.id;
    }

    const jobId = `comp-analysis-${projectId}-${Date.now()}`;
    try {
      await getAnalysisQueue().add("analyze-competitors", {
        jobId,
        projectId,
        userId,
        analysisId,
      }, { jobId, attempts: 2, backoff: { type: "exponential", delay: 5000 } });
    } catch (queueErr) {
      await db.from("competitive_gap_analysis").update({ status: "not_started" }).eq("id", analysisId);
      return res.status(503).json({ error: "Job queue unavailable. Please try again shortly." });
    }

    return res.json({ analysis_id: analysisId, status: "queued" });
  } catch (err) {
    return next(err);
  }
});

// GET /api/projects/:projectId/competitive-analysis
competitiveAnalysisRouter.get("/", async (req, res, next) => {
  try {
    const projectId = (req.params as Record<string, string>).projectId;
    const db = userClient(req.headers.authorization);
    const { data } = await db
      .from("competitive_gap_analysis")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!data) return res.status(404).json({ error: "No analysis found" });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});
