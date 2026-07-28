-- Expand expense categories, add source tracking, and calendar subscription feed tokens.

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (
  category in (
    'Supplies',
    'Equipment',
    'Fuel and mileage',
    'Software',
    'Advertising',
    'Insurance',
    'Office',
    'Repairs and maintenance',
    'Professional services',
    'Taxes and fees',
    'Other',
    -- Legacy categories kept for existing rows
    'Fuel',
    'Materials',
    'Equipment rental',
    'Subcontractor payment',
    'Tools',
    'Vehicle',
    'Marketing'
  )
);

alter table public.expenses
  add column if not exists source text not null default 'manual';

alter table public.expenses
  add column if not exists quickbooks_expense_id text;

alter table public.expenses drop constraint if exists expenses_source_check;
alter table public.expenses add constraint expenses_source_check check (
  source in ('manual', 'quickbooks')
);

create unique index if not exists expenses_org_quickbooks_expense_id_uidx
  on public.expenses (organization_id, quickbooks_expense_id)
  where quickbooks_expense_id is not null;

create table if not exists public.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  label text,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_feed_tokens_org_user_idx
  on public.calendar_feed_tokens (organization_id, user_id);

create unique index if not exists calendar_feed_tokens_active_user_uidx
  on public.calendar_feed_tokens (organization_id, user_id)
  where revoked_at is null;

alter table public.calendar_feed_tokens enable row level security;

drop policy if exists calendar_feed_tokens_select_own on public.calendar_feed_tokens;
create policy calendar_feed_tokens_select_own on public.calendar_feed_tokens
  for select using (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
  );

drop policy if exists calendar_feed_tokens_insert_own on public.calendar_feed_tokens;
create policy calendar_feed_tokens_insert_own on public.calendar_feed_tokens
  for insert with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
  );

drop policy if exists calendar_feed_tokens_update_own on public.calendar_feed_tokens;
create policy calendar_feed_tokens_update_own on public.calendar_feed_tokens
  for update using (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
  );
