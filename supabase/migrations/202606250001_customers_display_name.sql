-- Align customer display name with production schema (company_name, not name).

alter table public.customers
  add column if not exists company_name text;

-- Backfill company_name from legacy name column when that column still exists.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'name'
  ) then
    execute $sql$
      update public.customers
      set company_name = coalesce(nullif(trim(company_name), ''), trim(name))
      where company_name is null or trim(company_name) = ''
    $sql$;
  end if;
end $$;
