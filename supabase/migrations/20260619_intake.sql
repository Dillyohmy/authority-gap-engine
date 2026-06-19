-- Authority Gap Engine — Intake Phase Schema
-- Run this in your Supabase SQL editor

create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  website_url  text,
  clinic_type  text,
  location     text,
  status       text not null default 'intake',
  -- status: 'intake' | 'ready' | 'auditing' | 'complete'
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists intake_answers (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade not null,
  question_id  text not null,
  value        jsonb,
  updated_at   timestamptz default now(),
  unique (project_id, question_id)
);

-- RLS
alter table projects enable row level security;
alter table intake_answers enable row level security;

create policy "Users can manage their own projects"
  on projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage answers for their own projects"
  on intake_answers for all
  using (
    exists (
      select 1 from projects p
      where p.id = intake_answers.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = intake_answers.project_id
        and p.user_id = auth.uid()
    )
  );

-- Auto-update updated_at on projects
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on projects
  for each row execute procedure update_updated_at();

create trigger intake_answers_updated_at
  before update on intake_answers
  for each row execute procedure update_updated_at();
