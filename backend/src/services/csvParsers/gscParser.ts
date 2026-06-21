import { parse } from "csv-parse/sync";
import { findHeader, parseNumber, parsePercent, avg, sum, topN } from "./normalize.js";

export interface GscRow {
  query?: string;
  page?: string;
  device?: string;
  country?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscParseResult {
  rows: GscRow[];
  columnHeaders: string[];
  rowCount: number;
  summary: Record<string, unknown>;
}

type GscType = "queries" | "pages" | "devices" | "countries";

function detectType(headers: string[]): GscType {
  const lower = headers.map((h) => h.toLowerCase());
  if (lower.some((h) => h.includes("query") || h.includes("search query"))) return "queries";
  if (lower.some((h) => h.includes("page") || h.includes("landing"))) return "pages";
  if (lower.some((h) => h.includes("device"))) return "devices";
  if (lower.some((h) => h.includes("country") || h.includes("region"))) return "countries";
  return "queries"; // default
}

export function parseGscCsv(csvText: string, hintType?: GscType): GscParseResult {
  // GSC exports sometimes have a metadata row at the top — skip lines before actual headers
  const lines = csvText.replace(/\r\n/g, "\n").split("\n");
  let startLine = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase();
    if (
      lower.includes("clicks") ||
      lower.includes("query") ||
      lower.includes("page") ||
      lower.includes("device") ||
      lower.includes("country")
    ) {
      startLine = i;
      break;
    }
  }
  const cleanCsv = lines.slice(startLine).join("\n");

  const rawRows = parse(cleanCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  if (rawRows.length === 0) {
    return { rows: [], columnHeaders: [], rowCount: 0, summary: { error: "No data rows found" } };
  }

  const headers = Object.keys(rawRows[0]);
  const type = hintType ?? detectType(headers);

  const clicksKey = findHeader(headers, ["clicks"]);
  const impressionsKey = findHeader(headers, ["impressions"]);
  const ctrKey = findHeader(headers, ["ctr"]);
  const positionKey = findHeader(headers, ["position", "average position"]);
  const dimensionKey = (() => {
    if (type === "queries") return findHeader(headers, ["query", "search query", "top queries"]);
    if (type === "pages") return findHeader(headers, ["page", "landing page", "top pages"]);
    if (type === "devices") return findHeader(headers, ["device"]);
    return findHeader(headers, ["country", "region"]);
  })();

  const rows: GscRow[] = rawRows.map((r) => {
    const clicks = parseNumber(clicksKey ? r[clicksKey] : 0);
    const impressions = parseNumber(impressionsKey ? r[impressionsKey] : 0);
    const ctr = parsePercent(ctrKey ? r[ctrKey] : 0);
    const position = parseNumber(positionKey ? r[positionKey] : 0);
    const dimVal = dimensionKey ? r[dimensionKey] : undefined;

    const row: GscRow = { clicks, impressions, ctr, position };
    if (type === "queries") row.query = dimVal;
    else if (type === "pages") row.page = dimVal;
    else if (type === "devices") row.device = dimVal;
    else row.country = dimVal;
    return row;
  });

  const summary = buildGscSummary(rows, type);

  return { rows, columnHeaders: headers, rowCount: rows.length, summary };
}

function buildGscSummary(rows: GscRow[], type: GscType): Record<string, unknown> {
  const totalClicks = sum(rows.map((r) => r.clicks));
  const totalImpressions = sum(rows.map((r) => r.impressions));
  const avgCtr = avg(rows.map((r) => r.ctr));
  const avgPosition = avg(rows.filter((r) => r.position > 0).map((r) => r.position));

  const base = {
    total_clicks: totalClicks,
    total_impressions: totalImpressions,
    avg_ctr: Math.round(avgCtr * 100) / 100,
    avg_position: Math.round(avgPosition * 10) / 10,
  };

  if (type === "queries") {
    const topByClicks = topN(rows, "clicks", 10).map((r) => ({
      query: r.query,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));
    const topByImpressions = topN(rows, "impressions", 10).map((r) => ({
      query: r.query,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      position: r.position,
    }));
    const highImpLowCtr = rows
      .filter((r) => r.impressions >= 100 && r.ctr < 3)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20)
      .map((r) => ({ query: r.query, impressions: r.impressions, ctr: r.ctr, position: r.position }));
    const positions4to20 = rows
      .filter((r) => r.position >= 4 && r.position <= 20)
      .sort((a, b) => a.position - b.position)
      .slice(0, 30)
      .map((r) => ({ query: r.query, position: r.position, impressions: r.impressions, clicks: r.clicks }));
    const impressionsZeroClicks = rows
      .filter((r) => r.impressions > 0 && r.clicks === 0)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20)
      .map((r) => ({ query: r.query, impressions: r.impressions, position: r.position }));

    return {
      ...base,
      top_queries_by_clicks: topByClicks,
      top_queries_by_impressions: topByImpressions,
      high_impression_low_ctr: highImpLowCtr,
      positions_4_to_20: positions4to20,
      impressions_zero_clicks: impressionsZeroClicks,
    };
  }

  if (type === "pages") {
    const topByClicks = topN(rows, "clicks", 10).map((r) => ({
      page: r.page, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    }));
    const topByImpressions = topN(rows, "impressions", 10).map((r) => ({
      page: r.page, impressions: r.impressions, clicks: r.clicks, ctr: r.ctr, position: r.position,
    }));
    const highImpLowCtr = rows
      .filter((r) => r.impressions >= 50 && r.ctr < 3)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20)
      .map((r) => ({ page: r.page, impressions: r.impressions, ctr: r.ctr, position: r.position }));

    return { ...base, top_pages_by_clicks: topByClicks, top_pages_by_impressions: topByImpressions, high_imp_low_ctr_pages: highImpLowCtr };
  }

  if (type === "devices") {
    return {
      ...base,
      by_device: rows.map((r) => ({
        device: r.device, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
      })),
    };
  }

  // countries
  return {
    ...base,
    top_countries: topN(rows, "clicks", 15).map((r) => ({
      country: r.country, clicks: r.clicks, impressions: r.impressions,
    })),
  };
}
