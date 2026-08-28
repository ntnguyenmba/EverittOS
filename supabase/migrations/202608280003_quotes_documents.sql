create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','shared','accepted','declined','converted')),
  service_type text,
  size_value numeric,
  size_unit text,
  primary_units numeric,
  extra_units numeric,
  condition text,
  frequency text,
  add_ons jsonb not null default '[]'::jsonb,
  labor_hours numeric,
  price numeric not null default 0 check (price >= 0),
  currency text not null default 'USD',
  source_request text,
  customer_name text,
  customer_email text,
  customer_phone text,
  notes text,
  shared_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_org_created_idx on public.quotes(organization_id, created_at desc);
create index if not exists quotes_org_status_idx on public.quotes(organization_id, status);

alter table public.quotes enable row level security;

drop policy if exists quotes_select_org on public.quotes;
create policy quotes_select_org on public.quotes for select
  using (organization_id in (select public.current_user_org_ids()));

drop policy if exists quotes_insert_manage on public.quotes;
create policy quotes_insert_manage on public.quotes for insert
  with check (public.member_role_in_org(organization_id) in ('owner','admin','manager'));

drop policy if exists quotes_update_manage on public.quotes;
create policy quotes_update_manage on public.quotes for update
  using (public.member_role_in_org(organization_id) in ('owner','admin','manager'))
  with check (public.member_role_in_org(organization_id) in ('owner','admin','manager'));

drop policy if exists quotes_delete_manage on public.quotes;
create policy quotes_delete_manage on public.quotes for delete
  using (public.member_role_in_org(organization_id) in ('owner','admin'));
