-- Referral tracking, contractor-only workers, and simple job revenue inputs.

alter table public.profiles add column if not exists referral_source text;
alter table public.profiles add column if not exists referral_detail text;
alter table public.profiles add column if not exists referred_by text;

alter table public.organization_settings add column if not exists referral_source text;
alter table public.organization_settings add column if not exists referral_detail text;
alter table public.organization_settings add column if not exists referred_by text;

alter table public.workers add column if not exists email text;
alter table public.workers add column if not exists worker_type text not null default 'team';
alter table public.workers add column if not exists company_name text;
alter table public.workers add column if not exists hourly_rate numeric(12, 2);
alter table public.workers add column if not exists active boolean not null default true;
alter table public.workers add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.workers add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

alter table public.workers drop constraint if exists workers_worker_type_check;
alter table public.workers add constraint workers_worker_type_check check (worker_type in ('team', 'contractor'));

create index if not exists workers_organization_id_idx on public.workers (organization_id);
create index if not exists workers_worker_type_idx on public.workers (worker_type);
create index if not exists workers_active_idx on public.workers (active);

alter table public.jobs add column if not exists revenue_amount numeric(12, 2);
alter table public.jobs add column if not exists revenue_notes text;
