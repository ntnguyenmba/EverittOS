-- Launch: scheduling, reports, onboarding fields, plan limit enforcement

alter table public.jobs
  add column if not exists start_date date,
  add column if not exists due_date date;

create index if not exists jobs_due_date_idx on public.jobs (due_date);

alter table public.business_profiles
  add column if not exists service_type text,
  add column if not exists booking_url text,
  add column if not exists onboarding_completed boolean not null default false;

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  title text not null,
  created_at timestamptz default now()
);

create index if not exists job_reports_user_id_idx on public.job_reports (user_id);
create index if not exists job_reports_job_id_idx on public.job_reports (job_id);

alter table public.job_reports enable row level security;

drop policy if exists job_reports_owner_all on public.job_reports;
create policy job_reports_owner_all on public.job_reports
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists job_reports_staff_select on public.job_reports;
create policy job_reports_staff_select on public.job_reports
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = job_reports.job_id
        and public.is_assigned_to_job(j.id)
    )
  );

-- Plan limit helpers (server-side)
create or replace function public.profile_plan_for_user(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(plan, 'free') from public.profiles where id = target_user_id;
$$;

create or replace function public.enforce_job_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p text;
  cap int;
  cnt int;
begin
  p := public.profile_plan_for_user(new.user_id);
  cap := case p
    when 'free' then 10
    else -1
  end;
  if cap < 0 then
    return new;
  end if;
  select count(*)::int into cnt
  from public.jobs
  where user_id = new.user_id and status is distinct from 'cancelled';
  if cnt >= cap then
    raise exception 'PLAN_LIMIT_JOBS';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_plan_limit_insert on public.jobs;
create trigger jobs_plan_limit_insert
before insert on public.jobs
for each row execute function public.enforce_job_insert_limit();

create or replace function public.enforce_customer_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p text;
  cap int;
  cnt int;
begin
  p := public.profile_plan_for_user(new.user_id);
  cap := case p
    when 'free' then 25
    else -1
  end;
  if cap < 0 then
    return new;
  end if;
  select count(*)::int into cnt from public.customers where user_id = new.user_id;
  if cnt >= cap then
    raise exception 'PLAN_LIMIT_CUSTOMERS';
  end if;
  return new;
end;
$$;

drop trigger if exists customers_plan_limit_insert on public.customers;
create trigger customers_plan_limit_insert
before insert on public.customers
for each row execute function public.enforce_customer_insert_limit();

create or replace function public.enforce_photo_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p text;
  cap int;
  cnt int;
begin
  p := public.profile_plan_for_user(new.user_id);
  cap := case p
    when 'free' then 100
    else -1
  end;
  if cap < 0 then
    return new;
  end if;
  select count(*)::int into cnt from public.job_photos where user_id = new.user_id;
  if cnt >= cap then
    raise exception 'PLAN_LIMIT_PHOTOS';
  end if;
  return new;
end;
$$;

drop trigger if exists job_photos_plan_limit_insert on public.job_photos;
create trigger job_photos_plan_limit_insert
before insert on public.job_photos
for each row execute function public.enforce_photo_insert_limit();

create or replace function public.enforce_report_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p text;
  cap int;
  cnt int;
begin
  p := public.profile_plan_for_user(new.user_id);
  cap := case p
    when 'free' then 3
    when 'pro' then 25
    else -1
  end;
  if cap < 0 then
    return new;
  end if;
  select count(*)::int into cnt from public.job_reports where user_id = new.user_id;
  if cnt >= cap then
    raise exception 'PLAN_LIMIT_REPORTS';
  end if;
  return new;
end;
$$;

drop trigger if exists job_reports_plan_limit_insert on public.job_reports;
create trigger job_reports_plan_limit_insert
before insert on public.job_reports
for each row execute function public.enforce_report_insert_limit();

create or replace function public.enforce_worker_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p text;
begin
  p := public.profile_plan_for_user(new.user_id);
  if p <> 'business' then
    raise exception 'PLAN_LIMIT_CREW';
  end if;
  return new;
end;
$$;

drop trigger if exists workers_plan_limit_insert on public.workers;
create trigger workers_plan_limit_insert
before insert on public.workers
for each row execute function public.enforce_worker_insert_limit();
