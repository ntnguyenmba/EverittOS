-- Customer address fields (production may not have legacy `address` column).

alter table public.customers
  add column if not exists address_line1 text;

alter table public.customers
  add column if not exists address_line2 text;

alter table public.customers
  add column if not exists city text;

alter table public.customers
  add column if not exists state text;

alter table public.customers
  add column if not exists postal_code text;

alter table public.customers
  add column if not exists country text;

alter table public.customers
  add column if not exists service_address text;

alter table public.customers
  add column if not exists property_address text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'address'
  ) then
    execute $sql$
      update public.customers
      set address_line1 = coalesce(nullif(trim(address_line1), ''), nullif(trim(address), ''))
      where address_line1 is null or trim(address_line1) = ''
    $sql$;
  end if;
end $$;
