-- Priority 7: Google Data Integrations
-- Tables: project_integrations, integration_sync_jobs, search_console_data, analytics_data

-- ── project_integrations ──────────────────────────────────────────────────────
create table if not exists project_integrations (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references projects(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  provider                text not null default 'google',
  integration_type        text not null, -- 'search_console' | 'google_analytics' | 'google_business_profile'
  status                  text not null default 'not_connected', -- 'not_connected' | 'connected' | 'expired' | 'revoked' | 'error'
  external_account_email  text,
  property_id             text,
  property_name           text,
  site_url                text,
  scopes                  text[],
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz,
  last_sync_at            timestamptz,
  last_sync_status        text, -- 'success' | 'error' | 'running'
  last_sync_error         text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (project_id, integration_type)
);

alter table project_integrations enable row level security;

create policy "users_own_integrations" on project_integrations
  for all using (auth.uid() = user_id);

-- ── integration_sync_jobs ─────────────────────────────────────────────────────
create table if not exists integration_sync_jobs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  integration_id    uuid not null references project_integrations(id) on delete cascade,
  job_type          text not null, -- 'sync_search_console' | 'sync_google_analytics' | 'refresh_tokens'
  status            text not null default 'queued', -- 'queued' | 'running' | 'completed' | 'failed'
  date_range_start  date,
  date_range_end    date,
  started_at        timestamptz,
  completed_at      timestamptz,
  error_message     text,
  created_at        timestamptz not null default now()
);

alter table integration_sync_jobs enable row level security;

create policy "users_own_sync_jobs" on integration_sync_jobs
  for all using (auth.uid() = user_id);

-- ── search_console_data ───────────────────────────────────────────────────────
create table if not exists search_console_data (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  integration_id   uuid not null references project_integrations(id) on delete cascade,
  date_range_start date,
  date_range_end   date,
  data_type        text not null, -- 'summary' | 'queries' | 'pages' | 'devices' | 'countries'
  raw_json         jsonb,
  created_at       timestamptz not null default now()
);

alter table search_console_data enable row level security;

create policy "users_own_gsc_data" on search_console_data
  for all using (auth.uid() = user_id);

-- ── analytics_data ────────────────────────────────────────────────────────────
create table if not exists analytics_data (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  integration_id   uuid not null references project_integrations(id) on delete cascade,
  date_range_start date,
  date_range_end   date,
  data_type        text not null, -- 'summary' | 'landing_pages' | 'channels' | 'events' | 'cities' | 'devices'
  raw_json         jsonb,
  created_at       timestamptz not null default now()
);

alter table analytics_data enable row level security;

create policy "users_own_analytics_data" on analytics_data
  for all using (auth.uid() = user_id);

-- ── indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_project_integrations_project_id on project_integrations(project_id);
create index if not exists idx_integration_sync_jobs_integration_id on integration_sync_jobs(integration_id);
create index if not exists idx_search_console_data_project_id on search_console_data(project_id);
create index if not exists idx_analytics_data_project_id on analytics_data(project_id);
