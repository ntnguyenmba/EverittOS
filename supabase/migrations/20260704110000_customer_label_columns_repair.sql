-- Customer label column repair for lead/customer save flows.
-- Some production databases were created before the customer label cleanup and may
-- still be missing the legacy `display_name` field that cached clients or older
-- API deployments can reference.

begin;

alter table public.customers
  add column if not exists display_name text,
  add column if not exists name text,
  add column if not exists full_name text,
  add column if not exists company_name text;

update public.customers
set
  company_name = coalesce(nullif(company_name, ''), nullif(display_name, ''), nullif(name, ''), nullif(full_name, ''), email, phone, 'Unnamed contact'),
  display_name = coalesce(nullif(display_name, ''), nullif(company_name, ''), nullif(name, ''), nullif(full_name, ''), email, phone, 'Unnamed contact'),
  name = coalesce(nullif(name, ''), nullif(company_name, ''), nullif(display_name, ''), nullif(full_name, ''), email, phone, 'Unnamed contact'),
  full_name = coalesce(nullif(full_name, ''), nullif(company_name, ''), nullif(display_name, ''), nullif(name, ''), email, phone, 'Unnamed contact')
where
  company_name is null or company_name = '' or
  display_name is null or display_name = '' or
  name is null or name = '' or
  full_name is null or full_name = '';

create or replace function public.sync_customer_display_labels()
returns trigger
language plpgsql
as $$
begin
  new.company_name := coalesce(nullif(new.company_name, ''), nullif(new.display_name, ''), nullif(new.name, ''), nullif(new.full_name, ''), new.email, new.phone, 'Unnamed contact');
  new.display_name := coalesce(nullif(new.display_name, ''), nullif(new.company_name, ''), nullif(new.name, ''), nullif(new.full_name, ''), new.email, new.phone, 'Unnamed contact');
  new.name := coalesce(nullif(new.name, ''), nullif(new.company_name, ''), nullif(new.display_name, ''), nullif(new.full_name, ''), new.email, new.phone, 'Unnamed contact');
  new.full_name := coalesce(nullif(new.full_name, ''), nullif(new.company_name, ''), nullif(new.display_name, ''), nullif(new.name, ''), new.email, new.phone, 'Unnamed contact');

  return new;
end;
$$;

drop trigger if exists customers_sync_display_labels on public.customers;
create trigger customers_sync_display_labels
  before insert or update on public.customers
  for each row execute function public.sync_customer_display_labels();

commit;
