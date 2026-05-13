/**
 * Authority Gap Engine™ — Shared Types
 * MUST match the frontend contract exactly.
 */

export interface ScanReportInput {
  website_url: string;
  clinic_type: string;
  location: string;
}

export interface ScanFinding {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  description: string;
  signals?: string[];
  interpretation?: string;
  impact?: string;
}

export interface ScanReportSection {
  summary: string;
  findings: ScanFinding[];
  system_insight: string;
  strategic_implication: string;
  recommended_directions: string[];
}

export interface ScanOpportunitySection extends ScanReportSection {
  model_inputs: string[];
  confidence_level: string;
}

export interface ScanScores {
  authority_gap_score: number;
  visibility_score: number;
  conversion_score: number;
  opportunity_score: number;
  confidence_level: string;
}

export interface ScanReport {
  scan_id: string;
  input: ScanReportInput;
  scores: ScanScores;
  estimated_revenue_low: number;
  estimated_revenue_high: number;
  executive_summary: string;
  visibility: ScanReportSection;
  conversion: ScanReportSection;
  opportunity: ScanOpportunitySection;
  top_fixes: ScanFinding[];
  methodology: string;
}

export type ScanJobStatus =
  | "queued"
  | "fetching"
  | "extracting"
  | "analyzing"
  | "scoring"
  | "generating_report"
  | "completed"
  | "failed";

export interface StartScanInput {
  website_url: string;
  clinic_type: string;
  location: string;
  monthly_patient_value?: number;
  monthly_traffic?: number;
}

export interface ScanJob {
  id: string;
  input: StartScanInput;
  status: ScanJobStatus;
  error?: string;
  result?: ScanReport;
  created_at: Date;
  updated_at: Date;
}
