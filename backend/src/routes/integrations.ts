/**
 * Integration routes — Google OAuth + data sync endpoints.
 *
 * Mounted at:
 *   /api/projects/:projectId/integrations  (project-scoped, mergeParams)
 *   /api/integrations/google/oauth/callback (global, for Google redirect)
 */

import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { z } from "zod";
import { requireEnv } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import {
  buildAuthUrl,
  encodeState,
  decodeState,
  exchangeCode,
  storeTokens,
  getAccountEmail,
  listGscProperties,
  listGa4Properties,
  getValidAccessToken,
  type IntegrationType,
} from "../services/googleAuthService.js";
import { syncSearchConsoleData, loadGscSummary } from "../services/searchConsoleService.js";
import { syncGoogleAnalyticsData, loadGa4Summary } from "../services/googleAnalyticsService.js";
import { integrationQueue } from "../workers/integrationWorker.js";

const SUPABASE_URL = requireEnv(["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
const SUPABASE_SERVICE_KEY = requireEnv(["SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
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
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const { data } = await client.auth.getUser(token);
  return data.user?.id ?? null;
}

function p(req: Request): Record<string, string> {
  return req.params as Record<string, string>;
}

// ── Project-scoped router ─────────────────────────────────────────────────────

export const integrationsRouter = Router({ mergeParams: true });

// GET /api/projects/:projectId/integrations
integrationsRouter.get("/", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data, error } = await db
      .from("project_integrations")
      .select("id, integration_type, status, external_account_email, property_id, property_name, site_url, last_sync_at, last_sync_status, last_sync_error, created_at, updated_at")
      .eq("project_id", projectId)
      .order("integration_type");

    if (error) throw error;
    res.json({ integrations: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/integrations/google/connect
// Returns { url } — frontend redirects the browser there
const ConnectSchema = z.object({
  integrationType: z.enum(["search_console", "google_analytics"]),
});

integrationsRouter.post("/google/connect", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { integrationType } = ConnectSchema.parse(req.body);
    const { projectId } = p(req);

    // Verify user owns this project
    const db = userClient(req.headers.authorization);
    const { data: project } = await db.from("projects").select("id").eq("id", projectId).eq("user_id", userId).single();
    if (!project) return res.status(404).json({ error: "Project not found" });

    const state = encodeState({
      projectId,
      userId,
      integrationType: integrationType as IntegrationType,
      nonce: randomBytes(16).toString("hex"),
    });

    const url = buildAuthUrl(integrationType as IntegrationType, state);
    res.json({ url });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid request", details: err.errors });
    next(err);
  }
});

// POST /api/projects/:projectId/integrations/:integrationId/disconnect
integrationsRouter.post("/:integrationId/disconnect", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, integrationId } = p(req);
    const db = userClient(req.headers.authorization);

    const { error } = await db
      .from("project_integrations")
      .update({
        status: "revoked",
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        property_id: null,
        property_name: null,
        site_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integrationId)
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (error) throw error;

    // Clean up stored data
    await db.from("search_console_data").delete().eq("integration_id", integrationId);
    await db.from("analytics_data").delete().eq("integration_id", integrationId);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/integrations/:integrationId/properties
// Returns available GSC sites or GA4 properties for selection
integrationsRouter.get("/:integrationId/properties", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, integrationId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data: integration } = await db
      .from("project_integrations")
      .select("integration_type, access_token_encrypted, refresh_token_encrypted, token_expires_at")
      .eq("id", integrationId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (!integration) return res.status(404).json({ error: "Integration not found" });

    const accessToken = await getValidAccessToken(integration);

    if (integration.integration_type === "search_console") {
      const sites = await listGscProperties(accessToken);
      return res.json({ properties: sites });
    } else if (integration.integration_type === "google_analytics") {
      const props = await listGa4Properties(accessToken);
      return res.json({ properties: props });
    }

    res.status(400).json({ error: "Unsupported integration type" });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/integrations/:integrationId/select-property
const SelectPropertySchema = z.object({
  propertyId: z.string().optional(),
  propertyName: z.string().optional(),
  siteUrl: z.string().optional(),
});

integrationsRouter.post("/:integrationId/select-property", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, integrationId } = p(req);
    const { propertyId, propertyName, siteUrl } = SelectPropertySchema.parse(req.body);
    const db = userClient(req.headers.authorization);

    const { error } = await db
      .from("project_integrations")
      .update({
        property_id: propertyId ?? null,
        property_name: propertyName ?? null,
        site_url: siteUrl ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integrationId)
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid request", details: err.errors });
    next(err);
  }
});

// POST /api/projects/:projectId/integrations/:integrationId/sync
// Enqueues a background sync job
const SyncSchema = z.object({
  daysBack: z.number().int().min(7).max(365).default(28).optional(),
});

integrationsRouter.post("/:integrationId/sync", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, integrationId } = p(req);
    const { daysBack = 28 } = SyncSchema.parse(req.body);
    const db = userClient(req.headers.authorization);

    const { data: integration } = await db
      .from("project_integrations")
      .select("id, integration_type, status, site_url, property_id")
      .eq("id", integrationId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (!integration) return res.status(404).json({ error: "Integration not found" });
    if (integration.status === "not_connected" || integration.status === "revoked") {
      return res.status(400).json({ error: "Integration is not connected" });
    }
    if (!integration.site_url && !integration.property_id) {
      return res.status(400).json({ error: "No property selected — select a property before syncing" });
    }

    // Create sync job record
    const { data: job } = await db.from("integration_sync_jobs").insert({
      project_id: projectId,
      user_id: userId,
      integration_id: integrationId,
      job_type: integration.integration_type === "search_console" ? "sync_search_console" : "sync_google_analytics",
      status: "queued",
    }).select("id").single();

    // Mark integration as syncing
    await db.from("project_integrations").update({
      last_sync_status: "running",
      updated_at: new Date().toISOString(),
    }).eq("id", integrationId);

    // Enqueue BullMQ job
    if (integrationQueue) {
      await integrationQueue.add(
        integration.integration_type === "search_console" ? "sync_search_console" : "sync_google_analytics",
        { projectId, userId, integrationId, daysBack, syncJobId: job?.id },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );
    } else {
      // Fallback: run synchronously if queue unavailable
      logger.warn("Integration queue unavailable — running sync inline");
      res.json({ ok: true, jobId: job?.id, mode: "inline" });
      return;
    }

    res.json({ ok: true, jobId: job?.id });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid request", details: err.errors });
    next(err);
  }
});

// GET /api/projects/:projectId/integrations/:integrationId/sync-status
integrationsRouter.get("/:integrationId/sync-status", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, integrationId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data: integration } = await db
      .from("project_integrations")
      .select("last_sync_at, last_sync_status, last_sync_error, status")
      .eq("id", integrationId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (!integration) return res.status(404).json({ error: "Integration not found" });

    const { data: latestJob } = await db
      .from("integration_sync_jobs")
      .select("id, status, started_at, completed_at, error_message, created_at")
      .eq("integration_id", integrationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    res.json({
      integrationStatus: integration.status,
      lastSyncAt: integration.last_sync_at,
      lastSyncStatus: integration.last_sync_status,
      lastSyncError: integration.last_sync_error,
      latestJob: latestJob ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/integrations/:integrationId/summary
integrationsRouter.get("/:integrationId/summary", async (req, res, next) => {
  try {
    const userId = await getUserId(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, integrationId } = p(req);
    const db = userClient(req.headers.authorization);

    const { data: integration } = await db
      .from("project_integrations")
      .select("integration_type")
      .eq("id", integrationId)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (!integration) return res.status(404).json({ error: "Integration not found" });

    if (integration.integration_type === "search_console") {
      const summary = await loadGscSummary(db, projectId);
      return res.json({ summary });
    } else if (integration.integration_type === "google_analytics") {
      const summary = await loadGa4Summary(db, projectId);
      return res.json({ summary });
    }

    res.status(400).json({ error: "Unsupported integration type" });
  } catch (err) {
    next(err);
  }
});

// ── Global OAuth callback router ──────────────────────────────────────────────
// Mounted separately at /api/integrations

export const globalIntegrationsRouter = Router();

// GET /api/integrations/google/oauth/callback
globalIntegrationsRouter.get("/google/oauth/callback", async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  if (oauthError) {
    logger.warn({ oauthError }, "Google OAuth denied");
    return res.redirect(`${frontendUrl}/projects?oauth_error=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/projects?oauth_error=missing_params`);
  }

  let decoded: ReturnType<typeof decodeState>;
  try {
    decoded = decodeState(state);
  } catch {
    return res.redirect(`${frontendUrl}/projects?oauth_error=invalid_state`);
  }

  const { projectId, userId, integrationType } = decoded;
  const redirectBase = `${frontendUrl}/projects/${projectId}/integrations`;

  try {
    const tokens = await exchangeCode(code);
    const stored = storeTokens(tokens);
    const db = serviceClient();

    // Get account email
    const email = await getAccountEmail(tokens.access_token).catch(() => "");

    // Upsert integration record
    const { error: upsertError } = await db.from("project_integrations").upsert(
      {
        project_id: projectId,
        user_id: userId,
        provider: "google",
        integration_type: integrationType,
        status: "connected",
        external_account_email: email || null,
        scopes: stored.scopes,
        access_token_encrypted: stored.accessTokenEncrypted,
        refresh_token_encrypted: stored.refreshTokenEncrypted,
        token_expires_at: stored.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,integration_type" }
    );

    if (upsertError) {
      logger.error({ upsertError, projectId, integrationType }, "Failed to store integration");
      return res.redirect(`${redirectBase}?oauth_error=storage_failed`);
    }

    logger.info({ projectId, integrationType, email }, "Google integration connected");
    res.redirect(`${redirectBase}?connected=${integrationType}`);
  } catch (err) {
    logger.error({ err, projectId, integrationType }, "OAuth callback error");
    const msg = err instanceof Error ? err.message : "unknown";
    res.redirect(`${redirectBase}?oauth_error=${encodeURIComponent(msg)}`);
  }
});
