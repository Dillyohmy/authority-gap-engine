import { parseGscCsv } from "./gscParser.js";
import { parseGaCsv } from "./gaParser.js";
import { parseKeywordCsv } from "./keywordParser.js";
import type { UploadCategory } from "../../config/uploadCategories.js";

export interface ParsedResult {
  dataType: string;
  rows: unknown[];
  columnHeaders: string[];
  rowCount: number;
  summary: Record<string, unknown>;
}

export function parseCsvByCategory(csvText: string, category: UploadCategory): ParsedResult {
  switch (category) {
    case "gsc_queries": {
      const r = parseGscCsv(csvText, "queries");
      return { dataType: category, rows: r.rows, columnHeaders: r.columnHeaders, rowCount: r.rowCount, summary: r.summary };
    }
    case "gsc_pages": {
      const r = parseGscCsv(csvText, "pages");
      return { dataType: category, rows: r.rows, columnHeaders: r.columnHeaders, rowCount: r.rowCount, summary: r.summary };
    }
    case "gsc_devices": {
      const r = parseGscCsv(csvText, "devices");
      return { dataType: category, rows: r.rows, columnHeaders: r.columnHeaders, rowCount: r.rowCount, summary: r.summary };
    }
    case "gsc_countries": {
      const r = parseGscCsv(csvText, "countries");
      return { dataType: category, rows: r.rows, columnHeaders: r.columnHeaders, rowCount: r.rowCount, summary: r.summary };
    }
    case "ga_traffic_acquisition":
    case "ga_landing_pages":
    case "ga_events":
    case "ga_conversions": {
      const r = parseGaCsv(csvText);
      return { dataType: category, rows: r.rows, columnHeaders: r.columnHeaders, rowCount: r.rowCount, summary: r.summary };
    }
    case "keyword_rankings": {
      const r = parseKeywordCsv(csvText);
      return { dataType: category, rows: r.rows, columnHeaders: r.columnHeaders, rowCount: r.rowCount, summary: r.summary };
    }
    default:
      throw new Error(`No parser available for category: ${category}`);
  }
}

export { parseGscCsv, parseGaCsv, parseKeywordCsv };
