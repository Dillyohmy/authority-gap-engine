-- Priority 4: Full Authority Gap Report

create table if not exists reports (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references projects(id) on delete cascade,
  user_id                   uuid not null references auth.users(id) on delete cascade,
  report_type               text not null default 'full_authority_gap_report'
                              check (report_type in ('quick_scan', 'full_authority_gap_report', 'authority_growth_plan')),
  report_version            text not null default '1.0',
  report_status             text not null default 'queued'
                              check (report_status in ('queued', 'processing', 'completed', 'failed')),
  report_json               jsonb,
  report_summary            text,
  authority_score           int,
  audit_readiness_score     int,
  foundation_score          int,
  local_authority_score     int,
  service_authority_score   int,
  trust_conversion_score    int,
  competitive_ai_score      int,
  confidence_level          text check (confidence_level in ('low', 'medium', 'high')),
  missing_data_json         jsonb,
  priority_actions_json     jsonb,
  error_message             text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table reports enable row level security;

do $$ begin
  create policy "Users can manage their own reports"
    on reports for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create index if not exists idx_reports_project_id on reports(project_id);
create index if not exists idx_reports_user_id on reports(user_id);
