-- Authority Gap Engine — File Uploads & CSV Parsing Schema
-- Run this in your Supabase SQL editor after 20260619_intake.sql

-- ── uploaded_files ────────────────────────────────────────────────────────────
create table if not exists uploaded_files (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references projects(id) on delete cascade not null,
  user_id             uuid references auth.users(id) on delete cascade not null,
  file_name           text not null,           -- sanitized storage name
  original_file_name  text not null,           -- original user-provided name
  file_category       text not null,           -- see uploadCategories.ts
  file_type           text not null,           -- csv | pdf | image | document
  mime_type           text not null,
  file_size           bigint not null,         -- bytes
  storage_bucket      text not null default 'project-uploads',
  storage_path        text not null,           -- full path in bucket
  upload_status       text not null default 'pending',
  -- upload_status: pending | uploaded | failed | deleted
  parse_status        text not null default 'not_required',
  -- parse_status: not_required | pending | processing | parsed | failed
  parse_error         text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── parsed_file_data ──────────────────────────────────────────────────────────
create table if not exists parsed_file_data (
  id                  uuid primary key default gen_random_uuid(),
  uploaded_file_id    uuid references uploaded_files(id) on delete cascade not null,
  project_id          uuid references projects(id) on delete cascade not null,
  user_id             uuid references auth.users(id) on delete cascade not null,
  data_type           text not null,           -- gsc_queries | gsc_pages | ga_traffic | etc.
  row_count           integer not null default 0,
  column_headers      jsonb,                   -- array of header strings
  parsed_json         jsonb,                   -- full parsed rows (array of objects)
  summary_json        jsonb,                   -- aggregated insights
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table uploaded_files enable row level security;
alter table parsed_file_data enable row level security;

create policy "Users can manage their own uploaded files"
  on uploaded_files for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own parsed file data"
  on parsed_file_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Auto-update triggers ──────────────────────────────────────────────────────
create trigger uploaded_files_updated_at
  before update on uploaded_files
  for each row execute procedure update_updated_at();

create trigger parsed_file_data_updated_at
  before update on parsed_file_data
  for each row execute procedure update_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_uploaded_files_project_id on uploaded_files(project_id);
create index if not exists idx_uploaded_files_user_id on uploaded_files(user_id);
create index if not exists idx_parsed_file_data_uploaded_file_id on parsed_file_data(uploaded_file_id);
create index if not exists idx_parsed_file_data_project_id on parsed_file_data(project_id);

-- ── Supabase Storage Setup (run manually or via dashboard) ────────────────────
-- 1. Create a PRIVATE storage bucket named: project-uploads
--    insert into storage.buckets (id, name, public)
--    values ('project-uploads', 'project-uploads', false);
--
-- 2. RLS for storage objects (users can only access their own files):
--    create policy "Users can upload their own files"
--      on storage.objects for insert
--      with check (bucket_id = 'project-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
--
--    create policy "Users can view their own files"
--      on storage.objects for select
--      using (bucket_id = 'project-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
--
--    create policy "Users can delete their own files"
--      on storage.objects for delete
--      using (bucket_id = 'project-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- NOTE: The backend uses the service role key to generate signed URLs and
--       download files for parsing. Frontend uploads use signed upload URLs.
