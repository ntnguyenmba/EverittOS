-- Customer display-name compatibility repair.
-- Production uses company_name as the canonical customer/lead label.
-- This keeps legacy code or cached deployments that still read/write display_name from failing.

begin;

alter table public.customers
  add column if not exists display_name text;

update public.customers
set display_name = coalesce(nullif(display_name, ''), nullif(company_name, ''), nullif(name, ''), nullif(full_name, ''), email, phone)
where display_name is null or display_name = '';

update public.customers
set company_name = coalesce(nullif(company_name, ''), nullif(display_name, ''), nullif(name, ''), nullif(full_name, ''), email, phone)
where company_name is null or company_name = '';

create or replace function public.sync_customer_display_labels()
returns trigger
language plpgsql
as $$
begin
  if new.company_name is null or new.company_name = '' then
    new.company_name := coalesce(nullif(new.display_name, ''), nullif(new.name, ''), nullif(new.full_name, ''), new.email, new.phone);
  end if;

  if new.display_name is null or new.display_name = '' then
    new.display_name := coalesce(nullif(new.company_name, ''), nullif(new.name, ''), nullif(new.full_name, ''), new.email, new.phone);
  end if;

  if new.name is null or new.name = '' then
    new.name := coalesce(nullif(new.company_name, ''), nullif(new.display_name, ''), nullif(new.full_name, ''), new.email, new.phone);
  end if;

  if new.full_name is null or new.full_name = '' then
    new.full_name := coalesce(nullif(new.company_name, ''), nullif(new.display_name, ''), nullif(new.name, ''), new.email, new.phone);
  end if;

  return new;
end;
$$;

drop trigger if exists customers_sync_display_labels on public.customers;
create trigger customers_sync_display_labels
  before insert or update on public.customers
  for each row execute function public.sync_customer_display_labels();

commit;
