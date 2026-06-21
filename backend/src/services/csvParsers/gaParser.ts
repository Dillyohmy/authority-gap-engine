import { parse } from "csv-parse/sync";
import { findHeader, parseNumber, avg, sum, topN } from "./normalize.js";

export interface GaRow {
  dimension: string;
  sessions?: number;
  users?: number;
  activeUsers?: number;
  engagedSessions?: number;
  engagementRate?: number;
  avgEngagementTime?: number;
  bounceRate?: number;
  eventCount?: number;
  keyEvents?: number;
  conversions?: number;
}

export interface GaParseResult {
  rows: GaRow[];
  columnHeaders: string[];
  rowCount: number;
  summary: Record<string, unknown>;
  detectedType: string;
}

type GaType = "traffic_acquisition" | "landing_pages" | "events" | "conversions" | "unknown";

function detectGaType(headers: string[]): GaType {
  const lower = headers.map((h) => h.toLowerCase());
  if (lower.some((h) => h.includes("session source") || h.includes("default channel") || h.includes("medium"))) {
    return "traffic_acquisition";
  }
  if (lower.some((h) => h.includes("landing page") || h.includes("first user"))) {
    return "landing_pages";
  }
  if (lower.some((h) => h.includes("event name") || h.includes("event count"))) {
    return "events";
  }
  if (lower.some((h) => h.includes("conversion") || h.includes("key events"))) {
    return "conversions";
  }
  return "unknown";
}

// GA4 exports sometimes have extra header rows — find the real one
function findHeaderRow(lines: string[]): number {
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const lower = lines[i].toLowerCase();
    if (
      lower.includes("session") ||
      lower.includes("users") ||
      lower.includes("event") ||
      lower.includes("landing") ||
      lower.includes("channel") ||
      lower.includes("conversion")
    ) {
      return i;
    }
  }
  return 0;
}

export function parseGaCsv(csvText: string): GaParseResult {
  const lines = csvText.replace(/\r\n/g, "\n").split("\n");
  const headerIdx = findHeaderRow(lines);

  // GA exports sometimes have trailing totals rows — strip lines after blank
  let endIdx = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === "" || lines[i].startsWith("#")) {
      endIdx = i;
      break;
    }
  }

  const cleanCsv = lines.slice(headerIdx, endIdx).join("\n");

  let rawRows: Record<string, string>[];
  try {
    rawRows = parse(cleanCsv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
  } catch {
    return { rows: [], columnHeaders: [], rowCount: 0, summary: { error: "Failed to parse CSV" }, detectedType: "unknown" };
  }

  if (rawRows.length === 0) {
    return { rows: [], columnHeaders: [], rowCount: 0, summary: { error: "No data rows" }, detectedType: "unknown" };
  }

  const headers = Object.keys(rawRows[0]);
  const gaType = detectGaType(headers);

  // Flexible column detection
  const dimensionKey =
    findHeader(headers, [
      "session default channel group",
      "session source / medium",
      "session source/medium",
      "session medium",
      "landing page",
      "landing page + query string",
      "event name",
      "conversion name",
      "page path",
      "page path + query string",
    ]) ?? headers[0];

  const sessionsKey = findHeader(headers, ["sessions"]);
  const usersKey = findHeader(headers, ["total users", "users"]);
  const activeUsersKey = findHeader(headers, ["active users"]);
  const engagedKey = findHeader(headers, ["engaged sessions"]);
  const engagementRateKey = findHeader(headers, ["engagement rate"]);
  const avgEngagementKey = findHeader(headers, [
    "average engagement time per session",
    "average engagement time",
    "avg engagement time",
  ]);
  const eventCountKey = findHeader(headers, ["event count"]);
  const keyEventsKey = findHeader(headers, ["key events", "key events count"]);
  const conversionsKey = findHeader(headers, ["conversions", "total conversions"]);

  const rows: GaRow[] = rawRows.map((r) => ({
    dimension: dimensionKey ? r[dimensionKey] ?? "" : "",
    sessions: sessionsKey ? parseNumber(r[sessionsKey]) : undefined,
    users: usersKey ? parseNumber(r[usersKey]) : undefined,
    activeUsers: activeUsersKey ? parseNumber(r[activeUsersKey]) : undefined,
    engagedSessions: engagedKey ? parseNumber(r[engagedKey]) : undefined,
    engagementRate: engagementRateKey ? parseNumber(r[engagementRateKey]) : undefined,
    avgEngagementTime: avgEngagementKey ? parseNumber(r[avgEngagementKey]) : undefined,
    eventCount: eventCountKey ? parseNumber(r[eventCountKey]) : undefined,
    keyEvents: keyEventsKey ? parseNumber(r[keyEventsKey]) : undefined,
    conversions: conversionsKey ? parseNumber(r[conversionsKey]) : undefined,
  }));

  const summary = buildGaSummary(rows, gaType);

  return { rows, columnHeaders: headers, rowCount: rows.length, summary, detectedType: gaType };
}

function buildGaSummary(rows: GaRow[], type: GaType): Record<string, unknown> {
  const totalSessions = sum(rows.map((r) => r.sessions ?? 0));
  const totalUsers = sum(rows.map((r) => r.users ?? r.activeUsers ?? 0));
  const totalEvents = sum(rows.map((r) => r.eventCount ?? 0));
  const totalConversions = sum(rows.map((r) => r.conversions ?? r.keyEvents ?? 0));

  const base: Record<string, unknown> = {
    total_sessions: totalSessions,
    total_users: totalUsers,
  };

  if (type === "traffic_acquisition") {
    const byChannel = rows
      .sort((a, b) => (b.sessions ?? 0) - (a.sessions ?? 0))
      .slice(0, 15)
      .map((r) => ({
        channel: r.dimension,
        sessions: r.sessions,
        users: r.users ?? r.activeUsers,
        engagement_rate: r.engagementRate,
      }));
    return { ...base, top_channels: byChannel };
  }

  if (type === "landing_pages") {
    const byUsers = topN(rows as never[], "users" as never, 20).map((r: GaRow) => ({
      page: r.dimension,
      users: r.users ?? r.activeUsers,
      sessions: r.sessions,
      engagement_rate: r.engagementRate,
      avg_engagement_time: r.avgEngagementTime,
    }));
    const bySessions = topN(rows as never[], "sessions" as never, 10).map((r: GaRow) => ({
      page: r.dimension,
      sessions: r.sessions,
      engagement_rate: r.engagementRate,
    }));
    return { ...base, top_landing_pages_by_users: byUsers, top_landing_pages_by_sessions: bySessions };
  }

  if (type === "events") {
    const topEvents = topN(rows as never[], "eventCount" as never, 20).map((r: GaRow) => ({
      event: r.dimension,
      count: r.eventCount,
      key_events: r.keyEvents,
    }));
    return { ...base, total_events: totalEvents, top_events: topEvents };
  }

  if (type === "conversions") {
    const topConversions = rows
      .sort((a, b) => (b.conversions ?? 0) - (a.conversions ?? 0))
      .slice(0, 20)
      .map((r) => ({ conversion: r.dimension, count: r.conversions ?? r.keyEvents }));
    return { ...base, total_conversions: totalConversions, top_conversions: topConversions };
  }

  // Unknown — best-effort summary
  const topRows = rows.slice(0, 20).map((r) => ({ dimension: r.dimension, sessions: r.sessions, users: r.users }));
  return { ...base, top_rows: topRows };
}
