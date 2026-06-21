-- Priority 3: Competitor Gap Analysis
-- Creates competitors, competitor_crawl_results, and competitive_gap_analysis tables

-- ─── COMPETITORS ──────────────────────────────────────────────────────────────

create table if not exists competitors (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references projects(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  business_name           text not null,
  website_url             text,
  gbp_url                 text,
  competitor_type         text not null default 'both'
                            check (competitor_type in ('map_pack', 'organic', 'both')),
  search_phrase           text,
  city_searched_from      text,
  observed_map_pack_rank  int,
  observed_organic_rank   int,
  review_count            int,
  star_rating             numeric(2,1),
  primary_gbp_category    text,
  secondary_gbp_categories text[],
  notes                   text,
  crawl_status            text not null default 'not_started'
                            check (crawl_status in ('not_started','queued','processing','completed','failed')),
  crawl_job_id            text,
  analysis_status         text not null default 'not_started'
                            check (analysis_status in ('not_started','queued','processing','completed','failed')),
  last_crawled_at         timestamptz,
  last_analyzed_at        timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table competitors enable row level security;

do $$ begin
  create policy "Users can manage their own competitors"
    on competitors for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create index if not exists idx_competitors_project_id on competitors(project_id);
create index if not exists idx_competitors_user_id on competitors(user_id);

-- ─── COMPETITOR CRAWL RESULTS ─────────────────────────────────────────────────

create table if not exists competitor_crawl_results (
  id              uuid primary key default gen_random_uuid(),
  competitor_id   uuid not null references competitors(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  crawl_job_id    text,
  pages_crawled   int default 0,
  crawl_limit     int default 5,
  crawl_status    text not null default 'processing'
                    check (crawl_status in ('processing','completed','failed')),
  crawl_error     text,
  extracted_json  jsonb,
  summary_json    jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table competitor_crawl_results enable row level security;

do $$ begin
  create policy "Users can manage their own crawl results"
    on competitor_crawl_results for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create index if not exists idx_competitor_crawl_results_competitor_id
  on competitor_crawl_results(competitor_id);

-- ─── COMPETITIVE GAP ANALYSIS ─────────────────────────────────────────────────

create table if not exists competitive_gap_analysis (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'not_started'
                    check (status in ('not_started','queued','processing','completed','failed')),
  analysis_json   jsonb,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table competitive_gap_analysis enable row level security;

do $$ begin
  create policy "Users can manage their own gap analysis"
    on competitive_gap_analysis for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create index if not exists idx_competitive_gap_analysis_project_id
  on competitive_gap_analysis(project_id);
