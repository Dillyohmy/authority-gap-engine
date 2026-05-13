-- Authority Gap Engine™ — Database Schema

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  job_id uuid unique not null,
  website_url text not null,
  clinic_type text not null,
  location text not null,
  status text not null default 'queued',
  authority_gap_score integer,
  visibility_score integer,
  conversion_score integer,
  opportunity_score integer,
  estimated_revenue_low integer,
  estimated_revenue_high integer,
  confidence_level text,
  executive_summary text,
  report_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  website_url text,
  clinic_type text,
  location text,
  monthly_patient_value numeric,
  monthly_traffic numeric,
  wants_strategy_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists scan_events (
  id uuid primary key default gen_random_uuid(),
  website_url text,
  event_type text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
