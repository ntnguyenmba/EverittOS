-- EverittOS platform core: profiles, business, customers, crew, jobs, photos

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text default 'owner',
  plan text default 'free',
  subscription_status text default 'free',
  stripe_customer_id text,
  business_name text,
  full_name text,
  phone text,
  reroot_report_access boolean default false,
  reroot_premium_until timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.business_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  phone text,
  email text,
  logo_path text,
  support_email text,
  updated_at timestamptz default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  role text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  title text not null,
  customer_name text,
  phone text,
  address text,
  notes text,
  service_type text,
  status text default 'new',
  assigned_to uuid references public.workers (id) on delete set null,
  scheduled_at timestamptz,
  price_estimate numeric(12, 2),
  before_photo_url text,
  after_photo_url text,
  completion_notes text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  responsibility text,
  created_at timestamptz default now(),
  unique (job_id, worker_id)
);

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null,
  label text not null default 'other' check (label in ('before', 'during', 'after', 'other')),
  created_at timestamptz default now()
);

create table if not exists public.job_timeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  event_type text not null,
  message text,
  created_at timestamptz default now()
);

create table if not exists public.everittos_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  plan text not null check (plan in ('pro', 'business')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_session_id text unique,
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists customers_user_id_idx on public.customers (user_id);
create index if not exists workers_user_id_idx on public.workers (user_id);
create index if not exists jobs_user_id_idx on public.jobs (user_id);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_scheduled_at_idx on public.jobs (scheduled_at);
create index if not exists job_photos_job_id_idx on public.job_photos (job_id);
create index if not exists job_assignments_job_id_idx on public.job_assignments (job_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, plan, subscription_status, business_name)
  values (
    new.id,
    new.email,
    'free',
    'free',
    coalesce(new.raw_user_meta_data->>'business_name', null)
  )
  on conflict (id) do update set email = excluded.email;

  insert into public.business_profiles (user_id, business_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', null),
    new.email
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
