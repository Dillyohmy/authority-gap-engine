/**
 * Report Composer — Assembles the final ScanReport
 *
 * Merges all analysis layers into the exact JSON shape
 * expected by the Lovable frontend.
 */

import type { ScanReport, ScanFinding } from "../types/scanReport.js";
import type { ScanScores } from "../types/scanReport.js";
import type { RuleEngineResult } from "./ruleEngine.js";
import type { AIInterpretation } from "./aiInterpretationService.js";
import type { OpportunityResult } from "./opportunityModel.js";
import type { StartScanInput } from "../types/scanReport.js";

export function composeReport(
  scanId: string,
  input: StartScanInput,
  scores: ScanScores,
  rules: RuleEngineResult,
  ai: AIInterpretation,
  opportunity: OpportunityResult
): ScanReport {
  // Generate top fixes from highest-severity findings
  const allFindings = [
    ...rules.visibilityFindings,
    ...rules.conversionFindings,
  ];
  const topFixes: ScanFinding[] = allFindings
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 3)
    .map((f, i) => ({
      id: `f${i + 1}`,
      label: f.label,
      severity: f.severity,
      description: f.description,
      impact: f.impact,
    }));

  return {
    scan_id: scanId,
    input: {
      website_url: input.website_url,
      clinic_type: input.clinic_type,
      location: input.location,
    },
    scores,
    estimated_revenue_low: opportunity.estimated_revenue_low,
    estimated_revenue_high: opportunity.estimated_revenue_high,
    executive_summary: ai.executive_summary,
    visibility: {
      summary: ai.visibility_summary,
      findings: rules.visibilityFindings,
      system_insight: ai.visibility_insight,
      strategic_implication: ai.visibility_strategic,
      recommended_directions: ai.visibility_directions,
    },
    conversion: {
      summary: ai.conversion_summary,
      findings: rules.conversionFindings,
      system_insight: ai.conversion_insight,
      strategic_implication: ai.conversion_strategic,
      recommended_directions: ai.conversion_directions,
    },
    opportunity: {
      summary: ai.opportunity_summary,
      findings: opportunity.findings,
      system_insight: ai.opportunity_insight,
      strategic_implication: ai.opportunity_strategic,
      recommended_directions: ai.opportunity_directions,
      model_inputs: opportunity.model_inputs,
      confidence_level: opportunity.confidence_level,
    },
    top_fixes: topFixes,
    methodology:
      "Revenue opportunity ranges are based on live analysis of site structure, estimated local search demand, click-share benchmarks, and assumed conversion rates. These figures represent modeled opportunity ranges and are not audited financial projections.",
  };
}

function severityRank(s: string): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}
