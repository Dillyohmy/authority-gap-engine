export type ReportStatus = "queued" | "processing" | "completed" | "failed";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface ReportFinding {
  id: string;
  label: string;
  severity: "critical" | "high" | "medium" | "low" | "positive";
  description: string;
  source: string;
  inferred?: boolean;
}

export interface ReportPriorityAction {
  title: string;
  description: string;
  phase: string;
  priority: "critical" | "high" | "medium" | "low";
  estimated_impact: string;
  difficulty: "easy" | "moderate" | "advanced";
  why_it_matters: string;
  supporting_data: string;
  recommended_owner: string;
}

export interface MissingDataItem {
  item_name: string;
  phase: string;
  why_it_matters: string;
  recommended_input_format: string;
  required_or_optional: "required" | "recommended" | "optional";
}

export interface PhaseAnalysis {
  score: number;
  summary: string;
  findings: ReportFinding[];
  missing_data: string[];
  priority_fixes: string[];
  estimated_impact: string;
  supporting_observations: string[];
  recommended_next_steps: string[];
}

export interface FullReportScores {
  authority_score: number;
  audit_readiness_score: number;
  foundation_score: number;
  local_authority_score: number;
  service_authority_score: number;
  trust_conversion_score: number;
  competitive_ai_score: number;
  opportunity_score: number;
}

export interface FullReport {
  report_version: "1.0";
  report_type: "full_authority_gap_report";
  project: {
    id: string;
    name: string;
    website_url: string;
    clinic_type: string;
    location: string;
    business_name: string;
  };
  generated_at: string;
  scores: FullReportScores;
  confidence: {
    level: ConfidenceLevel;
    score: number;
    data_sources_available: string[];
    data_sources_missing: string[];
  };
  executive_summary: string;
  five_phase_analysis: {
    foundation: PhaseAnalysis;
    local_authority: PhaseAnalysis;
    service_authority: PhaseAnalysis;
    trust_conversion: PhaseAnalysis;
    competitive_ai_visibility: PhaseAnalysis;
  };
  priority_actions: ReportPriorityAction[];
  missing_data: MissingDataItem[];
  opportunity_summary: {
    summary: string;
    estimated_revenue_low: number;
    estimated_revenue_high: number;
    top_opportunities: string[];
  };
  data_sources_used: string[];
  methodology: string;
  disclaimers: string[];
}

// Context object assembled before scoring/AI
export interface ReportContext {
  project: {
    id: string;
    name: string;
    website_url: string;
    clinic_type: string;
    location: string;
    business_name: string;
  };
  intakeAnswers: Record<string, unknown>;
  scanReport: Record<string, unknown> | null;
  siteExtraction: Record<string, unknown> | null;
  uploadedFiles: Array<{ file_category: string; file_label: string; parse_status: string }>;
  parsedSummaries: Record<string, unknown>;   // category -> summary_json
  competitors: Array<Record<string, unknown>>;
  competitorCrawlSummaries: Record<string, unknown>; // competitorId -> summary
  gapAnalysis: Record<string, unknown> | null;
}
