-- RLS for EverittOS user-owned tables and job-photos storage bucket

alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.workers enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_timeline enable row level security;
alter table public.everittos_subscriptions enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);

-- business_profiles
drop policy if exists business_profiles_own on public.business_profiles;
create policy business_profiles_own on public.business_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- customers
drop policy if exists customers_own on public.customers;
create policy customers_own on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- workers (crew)
drop policy if exists workers_own on public.workers;
create policy workers_own on public.workers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- jobs
drop policy if exists jobs_own on public.jobs;
create policy jobs_own on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- job_assignments
drop policy if exists job_assignments_own on public.job_assignments;
create policy job_assignments_own on public.job_assignments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- job_photos
drop policy if exists job_photos_own on public.job_photos;
create policy job_photos_own on public.job_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- job_timeline
drop policy if exists job_timeline_own on public.job_timeline;
create policy job_timeline_own on public.job_timeline
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- subscriptions: users read own row by user_id or email
drop policy if exists everittos_subscriptions_select on public.everittos_subscriptions;
create policy everittos_subscriptions_select on public.everittos_subscriptions
  for select using (
    auth.uid() = user_id
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Storage bucket for job photos (private; path: userId/jobId/file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists job_photos_storage_select on storage.objects;
create policy job_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'job-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists job_photos_storage_insert on storage.objects;
create policy job_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'job-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists job_photos_storage_update on storage.objects;
create policy job_photos_storage_update on storage.objects
  for update using (
    bucket_id = 'job-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists job_photos_storage_delete on storage.objects;
create policy job_photos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'job-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
