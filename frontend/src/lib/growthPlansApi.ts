import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "";

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

export interface GrowthStrategy {
  headline: string;
  approach: string;
  sequencing_rationale: string;
  primary_focus: string;
  secondary_focus: string;
  revenue_alignment: string;
  confidence_note: string;
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

export interface ComplianceReviewItem {
  item: string;
  reason: string;
  recommendation: string;
  severity: "flag" | "review" | "info";
}

export interface GrowthPlanJson {
  plan_version: string;
  plan_type: string;
  project: { id: string; name: string; website_url: string; clinic_type: string; location: string };
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
  confidence: { level: "low" | "medium" | "high"; score: number; limitations: string[] };
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

export interface GrowthPlanListItem {
  id: string;
  plan_type: string;
  plan_status: "queued" | "processing" | "completed" | "failed";
  summary: string | null;
  authority_score_start: number | null;
  target_authority_score: number | null;
  confidence_level: string | null;
  source_report_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthPlanRow extends GrowthPlanListItem {
  plan_json: GrowthPlanJson | null;
  error_message: string | null;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...headers, ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const growthPlansApi = {
  start: (projectId: string, reportId: string) =>
    apiFetch<{ plan_id: string; status: string }>(
      `/api/projects/${projectId}/growth-plans/start?reportId=${reportId}`,
      { method: "POST" }
    ),

  list: (projectId: string) =>
    apiFetch<GrowthPlanListItem[]>(`/api/projects/${projectId}/growth-plans`),

  getStatus: (projectId: string, planId: string) =>
    apiFetch<{ id: string; plan_status: string; error_message: string | null }>(
      `/api/projects/${projectId}/growth-plans/${planId}/status`
    ),

  get: (projectId: string, planId: string) =>
    apiFetch<GrowthPlanRow>(`/api/projects/${projectId}/growth-plans/${planId}`),

  getTasks: (projectId: string, planId: string) =>
    apiFetch<GrowthPlanTask[]>(`/api/projects/${projectId}/growth-plans/${planId}/tasks`),

  updateTaskStatus: (projectId: string, planId: string, taskId: string, status: TaskStatus) =>
    apiFetch<GrowthPlanTask>(
      `/api/projects/${projectId}/growth-plans/${planId}/tasks/${taskId}`,
      { method: "PATCH", body: JSON.stringify({ status }) }
    ),

  delete: (projectId: string, planId: string) =>
    apiFetch<void>(`/api/projects/${projectId}/growth-plans/${planId}`, { method: "DELETE" }),
};
