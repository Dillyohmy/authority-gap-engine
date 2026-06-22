/**
 * Google Analytics 4 data sync + summary generation.
 * Uses the GA4 Data API (analyticsdata.googleapis.com).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./googleAuthService.js";
import { logger } from "../lib/logger.js";

const GA4_REPORT_URL = (propertyId: string) =>
  `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Ga4LandingPage {
  page: string;
  sessions: number;
  users: number;
  engagedSessions: number;
  engagementRate: number;
  avgEngagementTimeSec: number;
  keyEvents: number;
}

export interface Ga4Channel {
  channel: string;
  sessions: number;
  users: number;
  engagedSessions: number;
  engagementRate: number;
}

export interface Ga4SourceMedium {
  source: string;
  medium: string;
  sessions: number;
  users: number;
}

export interface Ga4City {
  city: string;
  region: string;
  sessions: number;
  users: number;
}

export interface Ga4Device {
  deviceCategory: string;
  sessions: number;
  users: number;
}

export interface Ga4Event {
  eventName: string;
  eventCount: number;
}

export interface Ga4Summary {
  dateRangeStart: string;
  dateRangeEnd: string;
  totals: {
    sessions: number;
    users: number;
    engagedSessions: number;
    avgEngagementRate: number;
  };
  topLandingPages: Ga4LandingPage[];
  lowEngagementPages: Ga4LandingPage[];
  topChannels: Ga4Channel[];
  topSourceMedium: Ga4SourceMedium[];
  topCities: Ga4City[];
  deviceBreakdown: Ga4Device[];
  topEvents: Ga4Event[];
  pagesWithTrafficButWeakConversions: Ga4LandingPage[];
  highEngagementLowConversionPages: Ga4LandingPage[];
}

// ── GA4 API helper ────────────────────────────────────────────────────────────

interface Ga4ReportRequest {
  dimensions: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dateRanges: Array<{ startDate: string; endDate: string }>;
  limit?: number;
  orderBys?: Array<{ metric?: { metricName: string }; desc?: boolean }>;
}

interface Ga4ReportRow {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

interface Ga4ReportResponse {
  rows?: Ga4ReportRow[];
}

async function runGa4Report(
  accessToken: string,
  propertyId: string,
  request: Ga4ReportRequest
): Promise<Ga4ReportRow[]> {
  const res = await fetch(GA4_REPORT_URL(propertyId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof err.error === "object" && err.error !== null
      ? ((err.error as Record<string, unknown>).message as string)
      : res.statusText;
    throw new Error(`GA4 API error: ${msg}`);
  }

  const data = await res.json() as Ga4ReportResponse;
  return data.rows ?? [];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateRange(daysBack: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function n(s: string | undefined): number {
  return parseFloat(s ?? "0") || 0;
}

// ── Summary builder ───────────────────────────────────────────────────────────

export function buildGa4Summary(
  landingPageRows: Ga4ReportRow[],
  channelRows: Ga4ReportRow[],
  sourceMediumRows: Ga4ReportRow[],
  cityRows: Ga4ReportRow[],
  deviceRows: Ga4ReportRow[],
  eventRows: Ga4ReportRow[],
  startDate: string,
  endDate: string
): Ga4Summary {
  const landingPages: Ga4LandingPage[] = landingPageRows.map(r => ({
    page: r.dimensionValues[0]?.value ?? "",
    sessions: n(r.metricValues[0]?.value),
    users: n(r.metricValues[1]?.value),
    engagedSessions: n(r.metricValues[2]?.value),
    engagementRate: n(r.metricValues[3]?.value),
    avgEngagementTimeSec: n(r.metricValues[4]?.value),
    keyEvents: n(r.metricValues[5]?.value),
  }));

  const channels: Ga4Channel[] = channelRows.map(r => ({
    channel: r.dimensionValues[0]?.value ?? "",
    sessions: n(r.metricValues[0]?.value),
    users: n(r.metricValues[1]?.value),
    engagedSessions: n(r.metricValues[2]?.value),
    engagementRate: n(r.metricValues[3]?.value),
  }));

  const sourceMedium: Ga4SourceMedium[] = sourceMediumRows.map(r => ({
    source: r.dimensionValues[0]?.value ?? "",
    medium: r.dimensionValues[1]?.value ?? "",
    sessions: n(r.metricValues[0]?.value),
    users: n(r.metricValues[1]?.value),
  }));

  const cities: Ga4City[] = cityRows.map(r => ({
    city: r.dimensionValues[0]?.value ?? "",
    region: r.dimensionValues[1]?.value ?? "",
    sessions: n(r.metricValues[0]?.value),
    users: n(r.metricValues[1]?.value),
  }));

  const devices: Ga4Device[] = deviceRows.map(r => ({
    deviceCategory: r.dimensionValues[0]?.value ?? "",
    sessions: n(r.metricValues[0]?.value),
    users: n(r.metricValues[1]?.value),
  }));

  const events: Ga4Event[] = eventRows.map(r => ({
    eventName: r.dimensionValues[0]?.value ?? "",
    eventCount: n(r.metricValues[0]?.value),
  }));

  const totalSessions = channels.reduce((s, c) => s + c.sessions, 0);
  const totalUsers = channels.reduce((s, c) => s + c.users, 0);
  const totalEngaged = channels.reduce((s, c) => s + c.engagedSessions, 0);

  return {
    dateRangeStart: startDate,
    dateRangeEnd: endDate,
    totals: {
      sessions: totalSessions,
      users: totalUsers,
      engagedSessions: totalEngaged,
      avgEngagementRate: totalSessions > 0 ? Math.round((totalEngaged / totalSessions) * 1000) / 10 : 0,
    },
    topLandingPages: [...landingPages].sort((a, b) => b.sessions - a.sessions).slice(0, 20),
    lowEngagementPages: landingPages
      .filter(p => p.sessions >= 10 && p.engagementRate < 0.3)
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 15),
    topChannels: [...channels].sort((a, b) => b.sessions - a.sessions),
    topSourceMedium: [...sourceMedium].sort((a, b) => b.sessions - a.sessions).slice(0, 20),
    topCities: [...cities].sort((a, b) => b.sessions - a.sessions).slice(0, 20),
    deviceBreakdown: devices,
    topEvents: [...events].sort((a, b) => b.eventCount - a.eventCount).slice(0, 20),
    pagesWithTrafficButWeakConversions: landingPages
      .filter(p => p.sessions >= 20 && p.keyEvents < 1)
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 15),
    highEngagementLowConversionPages: landingPages
      .filter(p => p.engagementRate >= 0.5 && p.keyEvents < 1 && p.sessions >= 10)
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 15),
  };
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncGoogleAnalyticsData(
  db: SupabaseClient,
  integration: {
    id: string;
    project_id: string;
    user_id: string;
    property_id: string | null;
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    token_expires_at: string | null;
  },
  daysBack = 28
): Promise<Ga4Summary> {
  if (!integration.property_id) throw new Error("No GA4 property selected");

  const accessToken = await getValidAccessToken(integration);
  const { startDate, endDate } = dateRange(daysBack);
  const propertyId = integration.property_id;
  const dateRanges = [{ startDate, endDate }];

  logger.info({ projectId: integration.project_id, propertyId, startDate, endDate }, "Syncing GA4 data");

  const [landingPageRows, channelRows, sourceMediumRows, cityRows, deviceRows, eventRows] = await Promise.all([
    runGa4Report(accessToken, propertyId, {
      dimensions: [{ name: "landingPage" }],
      metrics: [
        { name: "sessions" }, { name: "totalUsers" }, { name: "engagedSessions" },
        { name: "engagementRate" }, { name: "averageSessionDuration" }, { name: "keyEvents" },
      ],
      dateRanges,
      limit: 250,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    runGa4Report(accessToken, propertyId, {
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagedSessions" }, { name: "engagementRate" }],
      dateRanges,
      limit: 50,
    }),
    runGa4Report(accessToken, propertyId, {
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      dateRanges,
      limit: 100,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    runGa4Report(accessToken, propertyId, {
      dimensions: [{ name: "city" }, { name: "region" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      dateRanges,
      limit: 100,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    runGa4Report(accessToken, propertyId, {
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      dateRanges,
      limit: 10,
    }),
    runGa4Report(accessToken, propertyId, {
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dateRanges,
      limit: 100,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    }),
  ]);

  const summary = buildGa4Summary(
    landingPageRows, channelRows, sourceMediumRows, cityRows, deviceRows, eventRows,
    startDate, endDate
  );

  // Delete old data for this integration
  await db.from("analytics_data").delete().eq("integration_id", integration.id);

  // Store summary
  await db.from("analytics_data").insert({
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

  logger.info({ projectId: integration.project_id, totalSessions: summary.totals.sessions }, "GA4 sync complete");
  return summary;
}

// ── Load latest summary ───────────────────────────────────────────────────────

export async function loadGa4Summary(
  db: SupabaseClient,
  projectId: string
): Promise<Ga4Summary | null> {
  const { data } = await db
    .from("analytics_data")
    .select("raw_json")
    .eq("project_id", projectId)
    .eq("data_type", "summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data?.raw_json as Ga4Summary | null ?? null;
}
