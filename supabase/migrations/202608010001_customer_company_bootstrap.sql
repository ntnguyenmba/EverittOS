-- Companies bootstrap for customer saves. Safe to re-run.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete cascade,
  company_name text,
  name text,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists company_id uuid references public.companies (id) on delete set null;
alter table public.customers add column if not exists company_id uuid references public.companies (id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'company_id'
  ) then
    execute 'alter table public.customers alter column company_id drop not null';
  end if;
exception when others then
  raise notice 'customers.company_id nullable adjustment skipped: %', sqlerrm;
end $$;

create index if not exists companies_owner_id_idx on public.companies (owner_id);
create index if not exists companies_user_id_idx on public.companies (user_id);
create index if not exists companies_organization_id_idx on public.companies (organization_id);

alter table public.companies enable row level security;

drop policy if exists companies_org_member on public.companies;
create policy companies_org_member on public.companies
  for select using (
    auth.uid() = owner_id
    or auth.uid() = user_id
    or (
      organization_id is not null
      and public.is_org_member(organization_id)
    )
  );

drop policy if exists companies_org_manage on public.companies;
create policy companies_org_manage on public.companies
  for all using (
    auth.uid() = owner_id
    or auth.uid() = user_id
    or (
      organization_id is not null
      and public.can_manage_organization(organization_id)
    )
  )
  with check (
    auth.uid() = owner_id
    or auth.uid() = user_id
    or (
      organization_id is not null
      and public.can_manage_organization(organization_id)
    )
  );
