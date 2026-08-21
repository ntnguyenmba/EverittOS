create extension if not exists "pgcrypto";

create table if not exists public.pricing_helper_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  currency text not null default 'USD',
  owner_hourly_cost numeric not null default 0 check (owner_hourly_cost >= 0),
  worker_hourly_cost numeric not null default 0 check (worker_hourly_cost >= 0),
  desired_margin numeric not null default 35 check (desired_margin >= 0 and desired_margin < 95),
  range_low_factor numeric not null default 0.90 check (range_low_factor > 0),
  range_high_factor numeric not null default 1.15 check (range_high_factor >= range_low_factor),
  minimum_charge numeric not null default 0 check (minimum_charge >= 0),
  minimum_similar_jobs integer not null default 2 check (minimum_similar_jobs >= 1),
  size_tolerance_pct numeric not null default 25 check (size_tolerance_pct >= 0),
  bedroom_tolerance integer not null default 1 check (bedroom_tolerance >= 0),
  bathroom_tolerance integer not null default 1 check (bathroom_tolerance >= 0),
  market_context_enabled boolean not null default false,
  market_context jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_helper_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  service_type text,
  square_feet numeric,
  bedrooms numeric,
  bathrooms numeric,
  condition text,
  frequency text,
  add_ons jsonb not null default '[]'::jsonb,
  desired_margin numeric,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pricing_helper_templates_org_idx on public.pricing_helper_templates(organization_id, created_at desc);

alter table public.pricing_helper_settings enable row level security;
alter table public.pricing_helper_templates enable row level security;

drop policy if exists "pricing settings org read" on public.pricing_helper_settings;
create policy "pricing settings org read" on public.pricing_helper_settings
for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=pricing_helper_settings.organization_id and m.user_id=(select auth.uid()) and m.active=true));

drop policy if exists "pricing settings org manage" on public.pricing_helper_settings;
create policy "pricing settings org manage" on public.pricing_helper_settings
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=pricing_helper_settings.organization_id and m.user_id=(select auth.uid()) and m.active=true and m.role in ('owner','admin','manager')))
with check (exists (select 1 from public.organization_members m where m.organization_id=pricing_helper_settings.organization_id and m.user_id=(select auth.uid()) and m.active=true and m.role in ('owner','admin','manager')));

drop policy if exists "pricing templates org read" on public.pricing_helper_templates;
create policy "pricing templates org read" on public.pricing_helper_templates
for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=pricing_helper_templates.organization_id and m.user_id=(select auth.uid()) and m.active=true));

drop policy if exists "pricing templates org manage" on public.pricing_helper_templates;
create policy "pricing templates org manage" on public.pricing_helper_templates
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id=pricing_helper_templates.organization_id and m.user_id=(select auth.uid()) and m.active=true and m.role in ('owner','admin','manager')))
with check (exists (select 1 from public.organization_members m where m.organization_id=pricing_helper_templates.organization_id and m.user_id=(select auth.uid()) and m.active=true and m.role in ('owner','admin','manager')));

grant select, insert, update, delete on public.pricing_helper_settings to authenticated;
grant select, insert, update, delete on public.pricing_helper_templates to authenticated;

create or replace function public.touch_pricing_helper_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists pricing_helper_settings_touch on public.pricing_helper_settings;
create trigger pricing_helper_settings_touch before update on public.pricing_helper_settings for each row execute function public.touch_pricing_helper_updated_at();
drop trigger if exists pricing_helper_templates_touch on public.pricing_helper_templates;
create trigger pricing_helper_templates_touch before update on public.pricing_helper_templates for each row execute function public.touch_pricing_helper_updated_at();
