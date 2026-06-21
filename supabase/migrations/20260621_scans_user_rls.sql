-- Fix scans table for frontend saves
-- The scans table was created for backend-only use (job_id required, no user_id, no RLS).
-- This migration adapts it for direct frontend inserts by logged-in users.

-- 1. Add user_id column (nullable so existing backend-written rows are unaffected)
alter table scans
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 2. Make job_id nullable (frontend saves don't have a job_id)
alter table scans
  alter column job_id drop not null;

-- 3. Make clinic_type and location nullable (frontend may omit or they may be blank)
alter table scans
  alter column clinic_type drop not null;

alter table scans
  alter column location drop not null;

-- 4. Add findings_json column for frontend-saved summaries
alter table scans
  add column if not exists findings_json jsonb;

-- 5. Enable RLS
alter table scans enable row level security;

-- 6. Allow logged-in users to insert their own scans
create policy "Users can insert their own scans"
  on scans for insert
  with check (auth.uid() = user_id);

-- 7. Allow logged-in users to read their own scans
create policy "Users can read their own scans"
  on scans for select
  using (auth.uid() = user_id);

-- 8. Allow backend service role to do anything (bypasses RLS by default, no policy needed)

-- 9. Index for dashboard queries
create index if not exists idx_scans_user_id on scans(user_id);
