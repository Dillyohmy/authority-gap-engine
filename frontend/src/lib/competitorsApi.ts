import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export type CompetitorType = "map_pack" | "organic" | "both";
export type CrawlStatus = "not_started" | "queued" | "processing" | "completed" | "failed";
export type AnalysisStatus = "not_started" | "queued" | "processing" | "completed" | "failed";

export interface Competitor {
  id: string;
  project_id: string;
  business_name: string;
  website_url: string | null;
  gbp_url: string | null;
  competitor_type: CompetitorType;
  search_phrase: string | null;
  city_searched_from: string | null;
  observed_map_pack_rank: number | null;
  observed_organic_rank: number | null;
  review_count: number | null;
  star_rating: number | null;
  primary_gbp_category: string | null;
  secondary_gbp_categories: string[] | null;
  notes: string | null;
  crawl_status: CrawlStatus;
  crawl_job_id: string | null;
  analysis_status: AnalysisStatus;
  last_crawled_at: string | null;
  last_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CompetitorFormData = Omit<Competitor, "id" | "project_id" | "crawl_status" | "crawl_job_id" | "analysis_status" | "last_crawled_at" | "last_analyzed_at" | "created_at" | "updated_at">;

export interface CompetitorCrawlSummary {
  page_count: number;
  service_page_count: number;
  location_page_count: number;
  blog_or_resource_count: number;
  has_clear_phone: boolean;
  has_contact_form: boolean;
  has_booking_link: boolean;
  has_reviews_or_testimonials: boolean;
  has_provider_or_team_bios: boolean;
  has_schema: boolean;
  schema_types: string[];
  primary_ctas: string[];
  detected_services: string[];
  detected_locations: string[];
  detected_trust_signals: string[];
  detected_faqs: boolean;
  estimated_content_depth: "shallow" | "moderate" | "deep";
  local_relevance_signals: string[];
  conversion_signals: string[];
  avg_word_count: number;
  total_ctas: number;
}

export interface CompetitiveGapAnalysis {
  overall_competitive_summary: string;
  competitive_strength_score: number;
  gap_label: "Strong Advantage" | "Competitive" | "Moderate Gap" | "Major Gap";
  major_gaps: string[];
  moderate_gaps: string[];
  target_advantages: string[];
  competitor_advantages: string[];
  target_scores: Record<string, number>;
  competitor_avg_scores: Record<string, number>;
  strongest_competitor_scores: Record<string, number>;
  service_coverage_comparison: ComparisonRow;
  local_authority_comparison: ComparisonRow;
  trust_signal_comparison: ComparisonRow;
  conversion_comparison: ComparisonRow;
  content_depth_comparison: ComparisonRow;
  schema_comparison: ComparisonRow;
  review_comparison: ComparisonRow;
  recommended_priority_actions: PriorityAction[];
  analyzed_competitors: number;
  data_completeness: "full" | "partial" | "minimal";
  generated_at: string;
}

export interface ComparisonRow {
  category: string;
  target: string | number;
  competitor_avg: string | number;
  strongest_competitor: string | number;
  gap_status: "advantage" | "competitive" | "moderate_gap" | "major_gap";
  recommended_action: string;
}

export interface PriorityAction {
  title: string;
  description: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  estimated_impact: string;
  difficulty: "easy" | "medium" | "hard";
  supporting_observation: string;
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

export const competitorsApi = {
  list: (projectId: string) =>
    apiFetch<Competitor[]>(`/api/projects/${projectId}/competitors`),

  get: (projectId: string, competitorId: string) =>
    apiFetch<Competitor>(`/api/projects/${projectId}/competitors/${competitorId}`),

  create: (projectId: string, data: Partial<CompetitorFormData>) =>
    apiFetch<Competitor>(`/api/projects/${projectId}/competitors`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (projectId: string, competitorId: string, data: Partial<CompetitorFormData>) =>
    apiFetch<Competitor>(`/api/projects/${projectId}/competitors/${competitorId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (projectId: string, competitorId: string) =>
    apiFetch<void>(`/api/projects/${projectId}/competitors/${competitorId}`, { method: "DELETE" }),

  startCrawl: (projectId: string, competitorId: string) =>
    apiFetch<{ job_id: string; status: string }>(`/api/projects/${projectId}/competitors/${competitorId}/crawl`, { method: "POST" }),

  getCrawlStatus: (projectId: string, competitorId: string) =>
    apiFetch<{ crawl_status: CrawlStatus; crawl_job_id: string | null; last_crawled_at: string | null }>(`/api/projects/${projectId}/competitors/${competitorId}/crawl-status`),

  getCrawlResult: (projectId: string, competitorId: string) =>
    apiFetch<{ summary_json: CompetitorCrawlSummary; pages_crawled: number }>(`/api/projects/${projectId}/competitors/${competitorId}/crawl-result`),

  startAnalysis: (projectId: string) =>
    apiFetch<{ analysis_id: string; status: string }>(`/api/projects/${projectId}/competitive-analysis/start`, { method: "POST" }),

  getAnalysis: (projectId: string) =>
    apiFetch<{ status: string; analysis_json: CompetitiveGapAnalysis | null; error_message: string | null }>(`/api/projects/${projectId}/competitive-analysis`),
};
