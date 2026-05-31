-- Role-based access: owner/admin, contractor/staff, client

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'contractor', 'staff', 'client'));

alter table public.workers
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create index if not exists workers_auth_user_id_idx on public.workers (auth_user_id);

create table if not exists public.job_client_access (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  client_user_id uuid not null references auth.users (id) on delete cascade,
  can_view_photos boolean not null default true,
  can_view_notes boolean not null default true,
  can_view_reports boolean not null default true,
  created_at timestamptz default now(),
  unique (job_id, client_user_id)
);

create index if not exists job_client_access_client_idx on public.job_client_access (client_user_id);
create index if not exists job_client_access_job_idx on public.job_client_access (job_id);

alter table public.job_client_access enable row level security;

-- Helpers
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(role, 'owner') from public.profiles where id = auth.uid();
$$;

create or replace function public.is_org_owner(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = target_user_id;
$$;

create or replace function public.is_assigned_to_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_assignments ja
    join public.workers w on w.id = ja.worker_id
    where ja.job_id = target_job_id
      and w.auth_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.jobs j
    join public.workers w on w.id = j.assigned_to
    where j.id = target_job_id
      and w.auth_user_id = auth.uid()
  );
$$;

create or replace function public.client_can_view_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_client_access jca
    where jca.job_id = target_job_id
      and jca.client_user_id = auth.uid()
  );
$$;

-- Jobs: extend policies beyond owner-only
drop policy if exists jobs_select_role on public.jobs;
create policy jobs_select_role on public.jobs
  for select using (
    auth.uid() = user_id
    or public.is_assigned_to_job(id)
    or public.client_can_view_job(id)
  );

drop policy if exists jobs_update_role on public.jobs;
create policy jobs_update_role on public.jobs
  for update using (
    auth.uid() = user_id
    or (
      public.current_profile_role() in ('contractor', 'staff')
      and public.is_assigned_to_job(id)
    )
  );

drop policy if exists jobs_insert_role on public.jobs;
create policy jobs_insert_role on public.jobs
  for insert with check (
    auth.uid() = user_id
    and public.current_profile_role() in ('owner', 'admin')
  );

drop policy if exists jobs_delete_role on public.jobs;
create policy jobs_delete_role on public.jobs
  for delete using (
    auth.uid() = user_id
    and public.current_profile_role() in ('owner', 'admin')
  );

-- job_assignments
drop policy if exists job_assignments_select_role on public.job_assignments;
create policy job_assignments_select_role on public.job_assignments
  for select using (
    auth.uid() = user_id
    or public.is_assigned_to_job(job_id)
    or public.client_can_view_job(job_id)
  );

drop policy if exists job_assignments_write_role on public.job_assignments;
create policy job_assignments_write_role on public.job_assignments
  for all using (
    auth.uid() = user_id
    and public.current_profile_role() in ('owner', 'admin')
  )
  with check (
    auth.uid() = user_id
    and public.current_profile_role() in ('owner', 'admin')
  );

-- job_photos
drop policy if exists job_photos_select_role on public.job_photos;
create policy job_photos_select_role on public.job_photos
  for select using (
    auth.uid() = user_id
    or public.is_assigned_to_job(job_id)
    or (
      public.client_can_view_job(job_id)
      and exists (
        select 1 from public.job_client_access jca
        where jca.job_id = job_photos.job_id
          and jca.client_user_id = auth.uid()
          and jca.can_view_photos = true
      )
    )
  );

drop policy if exists job_photos_insert_role on public.job_photos;
create policy job_photos_insert_role on public.job_photos
  for insert with check (
    auth.uid() = user_id
    or (
      public.current_profile_role() in ('contractor', 'staff')
      and public.is_assigned_to_job(job_id)
    )
  );

drop policy if exists job_photos_update_role on public.job_photos;
create policy job_photos_update_role on public.job_photos
  for update using (
    auth.uid() = user_id
    or (
      public.current_profile_role() in ('contractor', 'staff')
      and public.is_assigned_to_job(job_id)
    )
  );

drop policy if exists job_photos_delete_role on public.job_photos;
create policy job_photos_delete_role on public.job_photos
  for delete using (
    auth.uid() = user_id
    and public.current_profile_role() in ('owner', 'admin')
  );

-- job_timeline / notes visibility
drop policy if exists job_timeline_select_role on public.job_timeline;
create policy job_timeline_select_role on public.job_timeline
  for select using (
    auth.uid() = user_id
    or public.is_assigned_to_job(job_id)
    or (
      public.client_can_view_job(job_id)
      and exists (
        select 1 from public.job_client_access jca
        where jca.job_id = job_timeline.job_id
          and jca.client_user_id = auth.uid()
          and jca.can_view_notes = true
      )
    )
  );

drop policy if exists job_timeline_insert_role on public.job_timeline;
create policy job_timeline_insert_role on public.job_timeline
  for insert with check (
    auth.uid() = user_id
    or (
      public.current_profile_role() in ('contractor', 'staff')
      and public.is_assigned_to_job(job_id)
    )
  );

-- job_client_access policies
drop policy if exists job_client_access_owner on public.job_client_access;
create policy job_client_access_owner on public.job_client_access
  for all using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists job_client_access_client_read on public.job_client_access;
create policy job_client_access_client_read on public.job_client_access
  for select using (auth.uid() = client_user_id);

-- Workers: owners manage; contractors read own row
drop policy if exists workers_select_role on public.workers;
create policy workers_select_role on public.workers
  for select using (
    auth.uid() = user_id
    or auth.uid() = auth_user_id
  );

drop policy if exists workers_write_role on public.workers;
create policy workers_write_role on public.workers
  for all using (
    auth.uid() = user_id
    and public.current_profile_role() in ('owner', 'admin')
  )
  with check (
    auth.uid() = user_id
    and public.current_profile_role() in ('owner', 'admin')
  );

-- Storage: contractors on assigned jobs
drop policy if exists job_photos_storage_select on storage.objects;
create policy job_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'job-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.job_photos jp
        join public.jobs j on j.id = jp.job_id
        where jp.storage_path = name
          and (
            public.is_assigned_to_job(j.id)
            or public.client_can_view_job(j.id)
          )
      )
    )
  );

drop policy if exists job_photos_storage_insert on storage.objects;
create policy job_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'job-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.jobs j
        where j.user_id::text = (storage.foldername(name))[1]
          and j.id::text = (storage.foldername(name))[2]
          and public.is_assigned_to_job(j.id)
      )
    )
  );
