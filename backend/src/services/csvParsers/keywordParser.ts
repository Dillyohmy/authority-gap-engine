import { parse } from "csv-parse/sync";
import { findHeader, parseNumber, topN } from "./normalize.js";

export interface KeywordRow {
  keyword: string;
  position: number;
  url?: string;
  searchVolume?: number;
  difficulty?: number;
  location?: string;
  device?: string;
  previousPosition?: number;
  positionChange?: number;
}

export interface KeywordParseResult {
  rows: KeywordRow[];
  columnHeaders: string[];
  rowCount: number;
  summary: Record<string, unknown>;
}

export function parseKeywordCsv(csvText: string): KeywordParseResult {
  const lines = csvText.replace(/\r\n/g, "\n").split("\n");

  // Find header row
  let startLine = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("keyword") || lower.includes("position") || lower.includes("ranking")) {
      startLine = i;
      break;
    }
  }

  const cleanCsv = lines.slice(startLine).join("\n");

  let rawRows: Record<string, string>[];
  try {
    rawRows = parse(cleanCsv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
  } catch {
    return { rows: [], columnHeaders: [], rowCount: 0, summary: { error: "Failed to parse CSV" } };
  }

  if (rawRows.length === 0) {
    return { rows: [], columnHeaders: [], rowCount: 0, summary: { error: "No data rows" } };
  }

  const headers = Object.keys(rawRows[0]);

  const keywordKey = findHeader(headers, ["keyword", "search term", "query", "term"]);
  const positionKey = findHeader(headers, [
    "position",
    "rank",
    "ranking position",
    "current position",
    "current rank",
    "serp position",
  ]);
  const urlKey = findHeader(headers, ["url", "landing url", "ranking url", "page", "target url"]);
  const volumeKey = findHeader(headers, [
    "search volume",
    "volume",
    "monthly searches",
    "avg monthly searches",
  ]);
  const difficultyKey = findHeader(headers, [
    "keyword difficulty",
    "difficulty",
    "kd",
    "competition",
  ]);
  const locationKey = findHeader(headers, ["location", "city", "region", "geo"]);
  const deviceKey = findHeader(headers, ["device"]);
  const prevPositionKey = findHeader(headers, [
    "previous position",
    "prev position",
    "previous rank",
    "prev rank",
    "last position",
  ]);
  const changeKey = findHeader(headers, [
    "change",
    "position change",
    "rank change",
    "difference",
    "diff",
  ]);

  const rows: KeywordRow[] = rawRows
    .map((r) => {
      const keyword = keywordKey ? r[keywordKey] ?? "" : "";
      const position = positionKey ? parseNumber(r[positionKey]) : 0;
      const previousPosition = prevPositionKey ? parseNumber(r[prevPositionKey]) : undefined;
      const positionChange = changeKey
        ? parseNumber(r[changeKey])
        : previousPosition !== undefined && position > 0
        ? previousPosition - position
        : undefined;

      return {
        keyword,
        position,
        url: urlKey ? r[urlKey] : undefined,
        searchVolume: volumeKey ? parseNumber(r[volumeKey]) : undefined,
        difficulty: difficultyKey ? parseNumber(r[difficultyKey]) : undefined,
        location: locationKey ? r[locationKey] : undefined,
        device: deviceKey ? r[deviceKey] : undefined,
        previousPosition,
        positionChange,
      };
    })
    .filter((r) => r.keyword.trim() !== "");

  const summary = buildKeywordSummary(rows);
  return { rows, columnHeaders: headers, rowCount: rows.length, summary };
}

function buildKeywordSummary(rows: KeywordRow[]): Record<string, unknown> {
  const ranked = rows.filter((r) => r.position > 0);

  const top3 = ranked.filter((r) => r.position <= 3);
  const pos4to10 = ranked.filter((r) => r.position >= 4 && r.position <= 10);
  const pos11to20 = ranked.filter((r) => r.position >= 11 && r.position <= 20);
  const outsideTop20 = ranked.filter((r) => r.position > 20);

  const highVolumeWeakRank = ranked
    .filter((r) => (r.searchVolume ?? 0) >= 100 && r.position > 10)
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
    .slice(0, 20)
    .map((r) => ({ keyword: r.keyword, position: r.position, volume: r.searchVolume }));

  const topByVolume = topN(rows as never[], "searchVolume" as never, 20).map((r: KeywordRow) => ({
    keyword: r.keyword,
    volume: r.searchVolume,
    position: r.position,
  }));

  const improving = rows
    .filter((r) => (r.positionChange ?? 0) > 0)
    .sort((a, b) => (b.positionChange ?? 0) - (a.positionChange ?? 0))
    .slice(0, 10)
    .map((r) => ({ keyword: r.keyword, position: r.position, change: r.positionChange }));

  const declining = rows
    .filter((r) => (r.positionChange ?? 0) < 0)
    .sort((a, b) => (a.positionChange ?? 0) - (b.positionChange ?? 0))
    .slice(0, 10)
    .map((r) => ({ keyword: r.keyword, position: r.position, change: r.positionChange }));

  return {
    total_keywords: rows.length,
    ranked_count: ranked.length,
    top_3_count: top3.length,
    pos_4_to_10_count: pos4to10.length,
    pos_11_to_20_count: pos11to20.length,
    outside_top_20_count: outsideTop20.length,
    top_3_keywords: top3
      .sort((a, b) => a.position - b.position)
      .slice(0, 10)
      .map((r) => ({ keyword: r.keyword, position: r.position, volume: r.searchVolume })),
    pos_4_to_10_keywords: pos4to10
      .slice(0, 20)
      .map((r) => ({ keyword: r.keyword, position: r.position, volume: r.searchVolume })),
    high_volume_weak_rank: highVolumeWeakRank,
    top_by_volume: topByVolume,
    improving,
    declining,
  };
}
