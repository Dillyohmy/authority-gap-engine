/**
 * Google Search Console data sync + summary generation.
 * Pulls query and page performance data, stores raw rows,
 * and generates an actionable summary for dashboard and reports.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./googleAuthService.js";
import { logger } from "../lib/logger.js";

const GSC_QUERY_URL = (siteUrl: string) =>
  `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryRow extends GscRow {
  query: string;
}

export interface GscPageRow extends GscRow {
  page: string;
}

export interface GscSummary {
  dateRangeStart: string;
  dateRangeEnd: string;
  totals: {
    clicks: number;
    impressions: number;
    avgCtr: number;
    avgPosition: number;
  };
  topQueriesByClicks: GscQueryRow[];
  topQueriesByImpressions: GscQueryRow[];
  highImpLowCtrQueries: GscQueryRow[];
  nearPageOneQueries: GscQueryRow[];    // positions 4-20
  zeroClickQueries: GscQueryRow[];
  topPagesByClicks: GscPageRow[];
  topPagesByImpressions: GscPageRow[];
  highImpLowCtrPages: GscPageRow[];
  localIntentQueries: GscQueryRow[];    // "near me", city keywords etc.
  serviceKeywordQueries: GscQueryRow[]; // treatment/service queries
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchGscData(
  accessToken: string,
  siteUrl: string,
  dimensions: string[],
  startDate: string,
  endDate: string,
  rowLimit = 1000
): Promise<GscRow[]> {
  const body = {
    startDate,
    endDate,
    dimensions,
    rowLimit,
    dataState: "all",
  };

  const res = await fetch(GSC_QUERY_URL(siteUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof err.error === "object" && err.error !== null
      ? ((err.error as Record<string, unknown>).message as string)
      : res.statusText;
    throw new Error(`GSC API error: ${msg}`);
  }

  const data = await res.json() as { rows?: GscRow[] };
  return data.rows ?? [];
}

// ── Date range helpers ────────────────────────────────────────────────────────

function dateRange(daysBack: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

// ── Local intent detection ────────────────────────────────────────────────────

const LOCAL_SIGNALS = ["near me", " in ", " near ", "local", "best ", "top "];
const SERVICE_SIGNALS = [
  "treatment", "therapy", "service", "clinic", "center", "care", "specialist",
  "doctor", "dr ", "pain", "injury", "health", "wellness", "physical",
  "chiropractic", "chiropractor", "massage", "acupuncture", "physio",
];

function isLocalIntent(query: string): boolean {
  const q = query.toLowerCase();
  return LOCAL_SIGNALS.some(s => q.includes(s));
}

function isServiceKeyword(query: string): boolean {
  const q = query.toLowerCase();
  return SERVICE_SIGNALS.some(s => q.includes(s));
}

// ── Summary builder ───────────────────────────────────────────────────────────

export function buildGscSummary(
  queryRows: GscQueryRow[],
  pageRows: GscPageRow[],
  startDate: string,
  endDate: string
): GscSummary {
  const totalClicks = queryRows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = queryRows.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgPosition =
    queryRows.length > 0
      ? queryRows.reduce((s, r) => s + r.position, 0) / queryRows.length
      : 0;

  const byClicks = [...queryRows].sort((a, b) => b.clicks - a.clicks);
  const byImpressions = [...queryRows].sort((a, b) => b.impressions - a.impressions);

  return {
    dateRangeStart: startDate,
    dateRangeEnd: endDate,
    totals: {
      clicks: totalClicks,
      impressions: totalImpressions,
      avgCtr: Math.round(avgCtr * 10000) / 100, // as percent
      avgPosition: Math.round(avgPosition * 10) / 10,
    },
    topQueriesByClicks: byClicks.slice(0, 20),
    topQueriesByImpressions: byImpressions.slice(0, 20),
    highImpLowCtrQueries: queryRows
      .filter(r => r.impressions >= 50 && r.ctr < 0.02)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20),
    nearPageOneQueries: queryRows
      .filter(r => r.position >= 4 && r.position <= 20)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 30),
    zeroClickQueries: queryRows
      .filter(r => r.impressions >= 10 && r.clicks === 0)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20),
    topPagesByClicks: [...pageRows].sort((a, b) => b.clicks - a.clicks).slice(0, 20),
    topPagesByImpressions: [...pageRows].sort((a, b) => b.impressions - a.impressions).slice(0, 20),
    highImpLowCtrPages: pageRows
      .filter(r => r.impressions >= 50 && r.ctr < 0.02)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20),
    localIntentQueries: queryRows
      .filter(r => isLocalIntent(r.query))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20),
    serviceKeywordQueries: queryRows
      .filter(r => isServiceKeyword(r.query))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20),
  };
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncSearchConsoleData(
  db: SupabaseClient,
  integration: {
    id: string;
    project_id: string;
    user_id: string;
    site_url: string | null;
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    token_expires_at: string | null;
  },
  daysBack = 28
): Promise<GscSummary> {
  if (!integration.site_url) throw new Error("No Search Console property selected");

  const accessToken = await getValidAccessToken(integration);
  const { startDate, endDate } = dateRange(daysBack);

  logger.info({ projectId: integration.project_id, siteUrl: integration.site_url, startDate, endDate }, "Syncing GSC data");

  // Pull query-level data
  const rawQueryRows = await fetchGscData(accessToken, integration.site_url, ["query"], startDate, endDate);
  const queryRows: GscQueryRow[] = rawQueryRows.map(r => ({
    ...r,
    query: r.keys[0] ?? "",
  }));

  // Pull page-level data
  const rawPageRows = await fetchGscData(accessToken, integration.site_url, ["page"], startDate, endDate);
  const pageRows: GscPageRow[] = rawPageRows.map(r => ({
    ...r,
    page: r.keys[0] ?? "",
  }));

  const summary = buildGscSummary(queryRows, pageRows, startDate, endDate);

  // Delete old data for this integration before storing fresh data
  await db.from("search_console_data").delete().eq("integration_id", integration.id);

  // Store queries (chunked to avoid huge single rows)
  const queriesChunks: GscQueryRow[][] = [];
  for (let i = 0; i < queryRows.length; i += 500) {
    queriesChunks.push(queryRows.slice(i, i + 500));
  }

  for (let i = 0; i < queriesChunks.length; i++) {
    await db.from("search_console_data").insert({
      project_id: integration.project_id,
      user_id: integration.user_id,
      integration_id: integration.id,
      date_range_start: startDate,
      date_range_end: endDate,
      data_type: `queries_chunk_${i}`,
      raw_json: queriesChunks[i],
    });
  }

  // Store pages
  await db.from("search_console_data").insert({
    project_id: integration.project_id,
    user_id: integration.user_id,
    integration_id: integration.id,
    date_range_start: startDate,
    date_range_end: endDate,
    data_type: "pages",
    raw_json: pageRows,
  });

  // Store summary (this is what dashboard + reports read)
  await db.from("search_console_data").insert({
    project_id: integration.project_id,
    user_id: integration.user_id,
    integration_id: integration.id,
    date_range_start: startDate,
    date_range_end: endDate,
    data_type: "summary",
    raw_json: summary,
  });

  // Update integration sync status
  await db.from("project_integrations").update({
    last_sync_at: new Date().toISOString(),
    last_sync_status: "success",
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", integration.id);

  logger.info({ projectId: integration.project_id, totalQueries: queryRows.length }, "GSC sync complete");
  return summary;
}

// ── Load latest summary ───────────────────────────────────────────────────────

export async function loadGscSummary(
  db: SupabaseClient,
  projectId: string
): Promise<GscSummary | null> {
  const { data } = await db
    .from("search_console_data")
    .select("raw_json, date_range_start, date_range_end")
    .eq("project_id", projectId)
    .eq("data_type", "summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data?.raw_json as GscSummary | null ?? null;
}
