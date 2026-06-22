-- Authority Gap Engine — Priority 5: Personal Authority Growth Plan
-- Run this in your Supabase SQL editor

create table if not exists growth_plans (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid references projects(id) on delete cascade not null,
  user_id               uuid references auth.users(id) on delete cascade not null,
  source_report_id      uuid references reports(id) on delete set null,
  plan_type             text not null default 'personal_authority_growth_plan',
  plan_version          text not null default '1.0',
  plan_status           text not null default 'queued',
  -- plan_status: queued | processing | completed | failed
  plan_json             jsonb,
  summary               text,
  authority_score_start integer,
  target_authority_score integer,
  confidence_level      text,
  error_message         text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create table if not exists growth_plan_tasks (
  id                  uuid primary key default gen_random_uuid(),
  growth_plan_id      uuid references growth_plans(id) on delete cascade not null,
  project_id          uuid references projects(id) on delete cascade not null,
  user_id             uuid references auth.users(id) on delete cascade not null,
  phase               text not null,
  title               text not null,
  description         text,
  priority            text not null default 'medium',
  -- priority: critical | high | medium | low
  difficulty          text not null default 'moderate',
  -- difficulty: easy | moderate | advanced
  estimated_impact    text,
  suggested_owner     text,
  estimated_effort    text,
  status              text not null default 'not_started',
  -- status: not_started | in_progress | completed | blocked | skipped
  due_window          text,
  -- due_window: 30_days | 60_days | 90_days | ongoing
  completion_criteria text,
  dependencies        text[],
  sort_order          integer default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Indexes
create index if not exists growth_plans_project_id_idx on growth_plans(project_id);
create index if not exists growth_plans_user_id_idx on growth_plans(user_id);
create index if not exists growth_plan_tasks_plan_id_idx on growth_plan_tasks(growth_plan_id);
create index if not exists growth_plan_tasks_project_id_idx on growth_plan_tasks(project_id);

-- RLS
alter table growth_plans enable row level security;
alter table growth_plan_tasks enable row level security;

create policy "Users can manage their own growth plans"
  on growth_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own growth plan tasks"
  on growth_plan_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update timestamps
create trigger growth_plans_updated_at
  before update on growth_plans
  for each row execute procedure update_updated_at();

create trigger growth_plan_tasks_updated_at
  before update on growth_plan_tasks
  for each row execute procedure update_updated_at();
