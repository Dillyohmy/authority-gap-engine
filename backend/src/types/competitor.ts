export type CompetitorType = "map_pack" | "organic" | "both";
export type CrawlStatus = "not_started" | "queued" | "processing" | "completed" | "failed";
export type AnalysisStatus = "not_started" | "queued" | "processing" | "completed" | "failed";

export interface Competitor {
  id: string;
  project_id: string;
  user_id: string;
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

export interface CompetitiveGapAction {
  title: string;
  description: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  estimated_impact: string;
  difficulty: "easy" | "medium" | "hard";
  supporting_observation: string;
}

export interface CompetitorScores {
  service_coverage: number;
  local_authority: number;
  trust_signals: number;
  content_depth: number;
  conversion_clarity: number;
  schema_coverage: number;
  review_strength: number;
  ai_visibility: number;
  overall: number;
}

export interface CompetitiveGapAnalysis {
  overall_competitive_summary: string;
  competitive_strength_score: number;
  gap_label: "Strong Advantage" | "Competitive" | "Moderate Gap" | "Major Gap";
  target_scores: CompetitorScores;
  competitor_avg_scores: CompetitorScores;
  strongest_competitor_scores: CompetitorScores;
  major_gaps: string[];
  moderate_gaps: string[];
  target_advantages: string[];
  competitor_advantages: string[];
  service_coverage_comparison: ComparisonRow;
  local_authority_comparison: ComparisonRow;
  trust_signal_comparison: ComparisonRow;
  conversion_comparison: ComparisonRow;
  content_depth_comparison: ComparisonRow;
  schema_comparison: ComparisonRow;
  review_comparison: ComparisonRow;
  recommended_priority_actions: CompetitiveGapAction[];
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
