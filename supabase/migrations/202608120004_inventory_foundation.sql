-- Inventory foundation without visual changes.

create extension if not exists "pgcrypto";

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  category text,
  item_type text not null default 'supply',
  quantity numeric(12, 2) not null default 0,
  unit text,
  reorder_level numeric(12, 2),
  location text,
  vendor text,
  active boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  adjustment_type text not null,
  quantity_delta numeric(12, 2) not null,
  reason text,
  job_id uuid references public.jobs (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_items_org_idx on public.inventory_items (organization_id, active, name);
create index if not exists inventory_adjustments_org_idx on public.inventory_adjustments (organization_id, created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_adjustments enable row level security;
