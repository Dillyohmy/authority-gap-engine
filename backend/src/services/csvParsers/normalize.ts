/**
 * Column normalization utilities for CSV imports.
 * Handles variations in header names across different export tools and regions.
 */

/** Find a header key case-insensitively, stripping whitespace and BOM */
export function findHeader(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map((h) =>
    h.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s\-_/]+/g, " ")
  );
  for (const candidate of candidates) {
    const c = candidate.toLowerCase().replace(/[\s\-_/]+/g, " ");
    const idx = normalized.indexOf(c);
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

export function parseNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[%,\s]/g, "");
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function parsePercent(val: unknown): number {
  const n = parseNumber(val);
  // If stored as "12.5%" → 0.125 or "12.5" → keep as is; normalise to 0-100
  return n > 1 ? n : n * 100;
}

export function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Top N items by a numeric key */
export function topN<T>(rows: T[], key: keyof T, n = 10): T[] {
  return [...rows].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, n);
}
