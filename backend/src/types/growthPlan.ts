import type { FullReport, PhaseAnalysis } from "./fullReport.js";

export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskDifficulty = "easy" | "moderate" | "advanced";
export type TaskImpact = "high" | "medium" | "low";
export type DueWindow = "30_days" | "60_days" | "90_days" | "ongoing";
export type TaskStatus = "not_started" | "in_progress" | "completed" | "blocked" | "skipped";

export interface GrowthPlanTask {
  id: string;
  phase: string;
  title: string;
  description: string;
  priority: TaskPriority;
  difficulty: TaskDifficulty;
  estimated_impact: TaskImpact;
  suggested_owner: string;
  estimated_effort: string;
  due_window: DueWindow;
  completion_criteria: string;
  dependencies: string[];
  status: TaskStatus;
  sort_order: number;
}

export interface PhaseRoadmap {
  phase: string;
  phase_label: string;
  current_score: number;
  target_score: number;
  main_weakness: string;
  main_opportunity: string;
  actions: GrowthPlanTask[];
  expected_impact: string;
  difficulty: TaskDifficulty;
  suggested_owner: string;
  timeline: string;
  data_needed: string[];
  completion_criteria: string;
}

export interface GrowthStrategy {
  headline: string;
  approach: string;
  sequencing_rationale: string;
  primary_focus: string;
  secondary_focus: string;
  revenue_alignment: string;
  confidence_note: string;
}

export interface ComplianceReviewItem {
  item: string;
  reason: string;
  recommendation: string;
  severity: "flag" | "review" | "info";
}

export interface GrowthPlanJson {
  plan_version: "1.0";
  plan_type: "personal_authority_growth_plan";
  project: {
    id: string;
    name: string;
    website_url: string;
    clinic_type: string;
    location: string;
  };
  source_report_id: string;
  generated_at: string;
  current_scores: {
    authority_score: number;
    foundation_score: number;
    local_authority_score: number;
    service_authority_score: number;
    trust_conversion_score: number;
    competitive_ai_score: number;
  };
  target_scores: {
    authority_score: number;
    foundation_score: number;
    local_authority_score: number;
    service_authority_score: number;
    trust_conversion_score: number;
    competitive_ai_score: number;
  };
  confidence: {
    level: "low" | "medium" | "high";
    score: number;
    limitations: string[];
  };
  executive_summary: string;
  growth_strategy: GrowthStrategy;
  phase_roadmap: {
    foundation: PhaseRoadmap;
    local_authority: PhaseRoadmap;
    service_authority: PhaseRoadmap;
    trust_conversion: PhaseRoadmap;
    competitive_ai_visibility: PhaseRoadmap;
  };
  thirty_day_plan: GrowthPlanTask[];
  sixty_day_plan: GrowthPlanTask[];
  ninety_day_plan: GrowthPlanTask[];
  priority_actions: GrowthPlanTask[];
  quick_wins: GrowthPlanTask[];
  high_impact_projects: GrowthPlanTask[];
  content_plan: GrowthPlanTask[];
  local_seo_plan: GrowthPlanTask[];
  conversion_plan: GrowthPlanTask[];
  ai_visibility_plan: GrowthPlanTask[];
  compliance_review_items: ComplianceReviewItem[];
  missing_data: string[];
  implementation_notes: string[];
  disclaimers: string[];
}

export interface GrowthPlanContext {
  project: Record<string, unknown>;
  report: FullReport;
  intakeAnswers: Record<string, unknown>;
  revenueServices: string[];
  profitableTreatments: string[];
  preferredCta: string;
  serviceArea: string;
  hasGsc: boolean;
  hasGa: boolean;
  hasCompetitorAnalysis: boolean;
  hasGbp: boolean;
  hipaaRequired: boolean;
  complianceNotes: string;
  missingOptionalData: string[];
}
