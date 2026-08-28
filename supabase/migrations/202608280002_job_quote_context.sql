alter table public.jobs
  add column if not exists quote_service_type text,
  add column if not exists quote_size_value numeric,
  add column if not exists quote_size_unit text,
  add column if not exists quote_primary_units numeric,
  add column if not exists quote_extra_units numeric,
  add column if not exists quote_condition text,
  add column if not exists quote_frequency text,
  add column if not exists quote_add_ons jsonb not null default '[]'::jsonb,
  add column if not exists quote_labor_hours numeric,
  add column if not exists quote_price numeric,
  add column if not exists quote_currency text,
  add column if not exists quote_source_request text,
  add column if not exists quote_created_at timestamptz;

create index if not exists jobs_quote_similarity_idx
  on public.jobs (organization_id, quote_service_type, quote_size_unit, quote_size_value)
  where quote_service_type is not null;
