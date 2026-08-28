-- Complete the structured quote snapshot stored on converted jobs.
-- These columns are used by the Quotes pricing-history endpoint so converted
-- jobs remain trustworthy comparable records even if the original quote changes.

alter table public.jobs add column if not exists quote_price numeric;
alter table public.jobs add column if not exists quote_currency text;
alter table public.jobs add column if not exists quote_created_at timestamptz;

update public.jobs
set quote_price = revenue_amount
where quote_id is not null
  and quote_price is null
  and revenue_amount is not null;

update public.jobs
set quote_currency = 'USD'
where quote_id is not null
  and coalesce(trim(quote_currency), '') = '';

create index if not exists jobs_quote_history_idx
  on public.jobs(organization_id, quote_service_type, quote_created_at desc)
  where quote_id is not null;

comment on column public.jobs.quote_price is 'Final price captured from the saved quote at conversion time.';
comment on column public.jobs.quote_currency is 'Currency captured from the saved quote at conversion time.';
comment on column public.jobs.quote_created_at is 'Original quote creation time captured at conversion time.';

notify pgrst, 'reload schema';
