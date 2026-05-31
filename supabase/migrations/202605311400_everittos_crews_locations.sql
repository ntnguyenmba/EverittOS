-- EverittOS: job locations and named crews (no regional hierarchy)

alter table public.jobs
  add column if not exists location_name text;

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table public.jobs
  add column if not exists crew_id uuid references public.crews (id) on delete set null;

create index if not exists crews_user_id_idx on public.crews (user_id);
create index if not exists jobs_crew_id_idx on public.jobs (crew_id);
create index if not exists jobs_location_name_idx on public.jobs (location_name);

alter table public.crews enable row level security;
alter table public.crews force row level security;

drop policy if exists crews_select_own on public.crews;
create policy crews_select_own on public.crews
  for select using (auth.uid() = user_id);

drop policy if exists crews_insert_own on public.crews;
create policy crews_insert_own on public.crews
  for insert with check (auth.uid() = user_id);

drop policy if exists crews_update_own on public.crews;
create policy crews_update_own on public.crews
  for update using (auth.uid() = user_id);

drop policy if exists crews_delete_own on public.crews;
create policy crews_delete_own on public.crews
  for delete using (auth.uid() = user_id);
