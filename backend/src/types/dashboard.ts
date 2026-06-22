// Priority 6: Authority Improvement Dashboard — view model types

export type DashboardState =
  | "no_data"
  | "intake_incomplete"
  | "intake_complete"
  | "scan_complete"
  | "report_complete"
  | "growth_plan_active"
  | "all_complete";

export interface DashboardScores {
  authority: number | null;
  audit_readiness: number | null;
  foundation: number | null;
  local_authority: number | null;
  service_authority: number | null;
  trust_conversion: number | null;
  competitive_ai_visibility: number | null;
  provisional: boolean; // true if derived from scan, not full report
}

export interface NextBestAction {
  title: string;
  description: string;
  action_type:
    | "complete_intake"
    | "add_gbp"
    | "add_competitors"
    | "run_scan"
    | "upload_gsc"
    | "upload_ga"
    | "generate_report"
    | "generate_growth_plan"
    | "update_tasks"
    | "fix_critical";
  href: string;
  priority: "critical" | "high" | "medium";
}

export interface BiggestGap {
  phase: string;
  score: number;
  label: string;
}

export interface DashboardMissingInput {
  name: string;
  why_it_matters: string;
  recommended_format: string;
  required_or_optional: "required" | "recommended" | "optional";
  action_href: string;
  action_label: string;
  phase: string;
}

export interface DashboardPriorityFix {
  id: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  difficulty: "easy" | "moderate" | "advanced";
  estimated_impact: string;
  source: string;
  phase: string;
  status: "not_started" | "in_progress" | "completed" | "blocked" | "skipped";
}

export interface DashboardTask {
  id: string;
  title: string;
  description?: string;
  priority: string;
  difficulty: string;
  due_window: string;
  status: string;
  phase: string;
  estimated_effort?: string;
  sort_order: number;
}

export interface DashboardPhaseData {
  phase: string;
  phase_label: string;
  score: number | null;
  score_status: "strong" | "good" | "needs_work" | "critical" | "unknown";
  why_it_matters: string;
  summary: string;
  findings: Array<{
    id: string;
    label: string;
    severity: string;
    description: string;
  }>;
  missing_inputs: DashboardMissingInput[];
  priority_fixes: DashboardPriorityFix[];
  growth_plan_tasks: DashboardTask[];
  estimated_impact: string;
  recommended_next_step: string;
}

export interface DashboardRecentActivity {
  type: "scan" | "report" | "growth_plan" | "upload" | "competitor";
  label: string;
  date: string;
  href?: string;
}

export interface DashboardAvailableAction {
  label: string;
  description: string;
  href: string;
  action_type: string;
  variant: "primary" | "secondary" | "outline";
}

export interface DashboardScanSummary {
  id: string;
  authority_gap_score: number;
  visibility_score: number;
  conversion_score: number;
  created_at: string;
}

export interface DashboardReportSummary {
  id: string;
  report_status: string;
  authority_score: number | null;
  audit_readiness_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardGrowthPlanSummary {
  id: string;
  plan_status: string;
  authority_score_start: number | null;
  target_authority_score: number | null;
  created_at: string;
  total_tasks: number;
  completed_tasks: number;
}

export interface DashboardViewModel {
  project: {
    id: string;
    name: string;
    website_url: string;
    clinic_type: string;
    location: string;
    business_name: string;
    status: string;
  };
  dashboard_state: DashboardState;
  scores: DashboardScores;
  biggest_gap: BiggestGap | null;
  next_best_action: NextBestAction;
  phases: {
    foundation: DashboardPhaseData;
    local_authority: DashboardPhaseData;
    service_authority: DashboardPhaseData;
    trust_conversion: DashboardPhaseData;
    competitive_ai_visibility: DashboardPhaseData;
  };
  latest_scan: DashboardScanSummary | null;
  latest_report: DashboardReportSummary | null;
  latest_growth_plan: DashboardGrowthPlanSummary | null;
  recent_activity: DashboardRecentActivity[];
  available_actions: DashboardAvailableAction[];
  intake_progress: {
    total_questions: number;
    answered_questions: number;
    required_total: number;
    required_answered: number;
    pct: number;
  };
  data_completeness: {
    level: "low" | "medium" | "high";
    score: number;
  };
}
