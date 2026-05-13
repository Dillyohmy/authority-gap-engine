/**
 * Scoring Engine — Calculates authority gap scores
 *
 * Produces 4 core scores (0-100):
 * - visibility_score
 * - conversion_score
 * - opportunity_score
 * - authority_gap_score (composite)
 */

import type { SiteExtraction } from "./extractService.js";
import type { RuleEngineResult } from "./ruleEngine.js";
import type { ScanScores } from "../types/scanReport.js";

export function calculateScores(
  extraction: SiteExtraction,
  ruleResult: RuleEngineResult
): ScanScores {
  // Visibility score: penalize for each gap found
  let visBase = 100;
  for (const f of ruleResult.visibilityFindings) {
    if (f.severity === "high") visBase -= 30;
    else if (f.severity === "medium") visBase -= 15;
    else visBase -= 5;
  }
  // Bonus for existing schema
  if (extraction.sitewide.hasLocalSchema) visBase += 10;
  if (extraction.sitewide.avgWordCount > 600) visBase += 10;
  const visibility_score = Math.max(0, Math.min(100, visBase));

  // Conversion score: penalize for each gap
  let convBase = 100;
  for (const f of ruleResult.conversionFindings) {
    if (f.severity === "high") convBase -= 30;
    else if (f.severity === "medium") convBase -= 15;
    else convBase -= 5;
  }
  const conversion_score = Math.max(0, Math.min(100, convBase));

  // Opportunity score: inverse of current performance
  const opportunity_score = Math.max(
    0,
    Math.min(100, 100 - Math.round((visibility_score + conversion_score) / 2))
  );

  // Authority gap score: weighted composite (lower = bigger gap)
  const authority_gap_score = Math.round(
    visibility_score * 0.4 +
    conversion_score * 0.4 +
    (100 - opportunity_score) * 0.2
  );

  // Confidence level based on data quality
  const totalFindings =
    ruleResult.visibilityFindings.length + ruleResult.conversionFindings.length;
  const confidence_level =
    extraction.sitewide.totalPages >= 5 && totalFindings >= 3
      ? "high"
      : extraction.sitewide.totalPages >= 2
      ? "moderate"
      : "low";

  return {
    authority_gap_score,
    visibility_score,
    conversion_score,
    opportunity_score,
    confidence_level,
  };
}
