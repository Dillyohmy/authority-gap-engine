import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface ReportListItem {
  id: string;
  report_type: string;
  report_status: "queued" | "processing" | "completed" | "failed";
  authority_score: number | null;
  audit_readiness_score: number | null;
  foundation_score: number | null;
  local_authority_score: number | null;
  service_authority_score: number | null;
  trust_conversion_score: number | null;
  competitive_ai_score: number | null;
  confidence_level: "low" | "medium" | "high" | null;
  report_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportFinding {
  id: string;
  label: string;
  severity: "critical" | "high" | "medium" | "low" | "positive";
  description: string;
  source: string;
  inferred?: boolean;
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

export interface PriorityAction {
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

export interface FullReportJson {
  report_version: string;
  report_type: string;
  project: {
    id: string;
    name: string;
    website_url: string;
    clinic_type: string;
    location: string;
    business_name: string;
  };
  generated_at: string;
  scores: {
    authority_score: number;
    audit_readiness_score: number;
    foundation_score: number;
    local_authority_score: number;
    service_authority_score: number;
    trust_conversion_score: number;
    competitive_ai_score: number;
    opportunity_score: number;
  };
  confidence: {
    level: "low" | "medium" | "high";
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
  priority_actions: PriorityAction[];
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

export interface FullReportRow extends ReportListItem {
  report_json: FullReportJson | null;
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

export const reportsApi = {
  startFull: (projectId: string) =>
    apiFetch<{ report_id: string; status: string }>(`/api/projects/${projectId}/reports/full/start`, { method: "POST" }),

  list: (projectId: string) =>
    apiFetch<ReportListItem[]>(`/api/projects/${projectId}/reports`),

  getStatus: (projectId: string, reportId: string) =>
    apiFetch<{ id: string; report_status: string; error_message: string | null }>(`/api/projects/${projectId}/reports/${reportId}/status`),

  get: (projectId: string, reportId: string) =>
    apiFetch<FullReportRow>(`/api/projects/${projectId}/reports/${reportId}`),

  delete: (projectId: string, reportId: string) =>
    apiFetch<void>(`/api/projects/${projectId}/reports/${reportId}`, { method: "DELETE" }),
};
