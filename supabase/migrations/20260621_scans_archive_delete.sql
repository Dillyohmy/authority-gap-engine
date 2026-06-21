-- Add archive support and update/delete RLS policies for scans

alter table scans
  add column if not exists archived_at timestamptz;

-- Allow users to update their own scans (for archiving)
do $$ begin
  create policy "Users can update their own scans"
    on scans for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- Allow users to delete their own scans
do $$ begin
  create policy "Users can delete their own scans"
    on scans for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
