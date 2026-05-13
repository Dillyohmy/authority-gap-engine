/**
 * Opportunity Model — Revenue projection calculator
 *
 * Estimates monthly revenue opportunity range based on:
 * - Local search volume estimates
 * - Current organic click share
 * - Conversion rate benchmarks
 * - Average patient value
 */

import type { ScanScores } from "../types/scanReport.js";
import type { ScanFinding } from "../types/scanReport.js";

export interface OpportunityResult {
  estimated_revenue_low: number;
  estimated_revenue_high: number;
  findings: ScanFinding[];
  model_inputs: string[];
  confidence_level: string;
}

export function calculateOpportunity(
  clinicType: string,
  location: string,
  scores: ScanScores,
  monthlyPatientValue?: number,
  monthlyTraffic?: number
): OpportunityResult {
  // Defaults based on clinic type
  const avgPatientValue = monthlyPatientValue || getDefaultPatientValue(clinicType);
  const estimatedSearchVolume = monthlyTraffic || getEstimatedSearchVolume(clinicType);

  // Current capture rate derived from visibility score
  const currentCaptureRate = Math.max(0.05, scores.visibility_score / 100 * 0.4);

  // Achievable capture rate
  const achievableCaptureRate = 0.25;

  // Conversion rate benchmarks
  const currentConvRate = Math.max(0.01, scores.conversion_score / 100 * 0.06);
  const achievableConvRate = 0.05;

  // Revenue calculations
  const currentMonthlyLeads = estimatedSearchVolume * currentCaptureRate * currentConvRate;
  const achievableMonthlyLeads = estimatedSearchVolume * achievableCaptureRate * achievableConvRate;
  const additionalLeads = achievableMonthlyLeads - currentMonthlyLeads;

  const estimated_revenue_low = Math.round(additionalLeads * 0.6 * avgPatientValue);
  const estimated_revenue_high = Math.round(additionalLeads * 1.2 * avgPatientValue);

  const findings: ScanFinding[] = [
    {
      id: "o1",
      label: "Uncaptured local search demand",
      severity: "high",
      description: `Based on estimated local search volume for ${clinicType} in ${location}, the practice is capturing less than ${Math.round(currentCaptureRate * 100)}% of available organic demand.`,
      signals: [
        `Estimated monthly search volume: ${estimatedSearchVolume.toLocaleString()}`,
        `Current organic click share: <${Math.round(currentCaptureRate * 100)}%`,
      ],
      interpretation: "Significant patient volume is flowing to competitors with stronger search presence.",
      impact: `Potential ${Math.round(additionalLeads)}-${Math.round(additionalLeads * 1.5)} additional patient inquiries per month.`,
    },
  ];

  return {
    estimated_revenue_low: Math.max(5000, estimated_revenue_low),
    estimated_revenue_high: Math.max(15000, estimated_revenue_high),
    findings,
    model_inputs: [
      `Local search volume: ${estimatedSearchVolume.toLocaleString()}/mo (estimated)`,
      `Current organic click share: <${Math.round(currentCaptureRate * 100)}%`,
      `Assumed conversion rate: ${(currentConvRate * 100).toFixed(1)}-${(achievableConvRate * 100).toFixed(1)}%`,
      `Average patient value: $${avgPatientValue}/mo`,
      `Competitive density: ${scores.authority_gap_score < 40 ? "high" : "moderate"}`,
    ],
    confidence_level: scores.confidence_level,
  };
}

function getDefaultPatientValue(clinicType: string): number {
  const values: Record<string, number> = {
    "Functional Medicine": 350,
    "Dental": 250,
    "Chiropractic": 200,
    "Dermatology": 300,
    "Med Spa": 400,
    "Orthopedics": 500,
    "Mental Health": 250,
    "Primary Care": 200,
  };
  return values[clinicType] || 300;
}

function getEstimatedSearchVolume(clinicType: string): number {
  const volumes: Record<string, number> = {
    "Functional Medicine": 4200,
    "Dental": 8500,
    "Chiropractic": 6000,
    "Dermatology": 5500,
    "Med Spa": 3800,
    "Orthopedics": 4000,
    "Mental Health": 7200,
    "Primary Care": 9000,
  };
  return volumes[clinicType] || 4000;
}
