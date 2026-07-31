-- Automatically link jobs to workspace-scoped customers.
-- This covers jobs created from the UI, imports, integrations, and legacy records.

create or replace function public.normalize_customer_match_value(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(regexp_replace(trim(coalesce(value, '')), '\s+', ' ', 'g')), '');
$$;

create or replace function public.ensure_job_customer_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_customer_id uuid;
  normalized_name text;
  normalized_email text;
  normalized_phone text;
begin
  if new.customer_id is not null then
    return new;
  end if;

  normalized_name := public.normalize_customer_match_value(new.customer_name);
  normalized_email := public.normalize_customer_match_value(new.customer_email);
  normalized_phone := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');

  if normalized_name is null and normalized_email is null and normalized_phone is null then
    return new;
  end if;

  select c.id
    into matched_customer_id
  from public.customers c
  where c.organization_id = new.organization_id
    and (
      (normalized_email is not null and public.normalize_customer_match_value(c.email) = normalized_email)
      or
      (normalized_phone is not null and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = normalized_phone)
      or
      (normalized_name is not null and public.normalize_customer_match_value(c.company_name) = normalized_name)
    )
  order by
    case
      when normalized_email is not null and public.normalize_customer_match_value(c.email) = normalized_email then 1
      when normalized_phone is not null and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = normalized_phone then 2
      else 3
    end,
    c.created_at asc
  limit 1;

  if matched_customer_id is null then
    insert into public.customers (
      organization_id,
      user_id,
      company_id,
      company_name,
      email,
      phone,
      service_address,
      property_address,
      record_type,
      pipeline_stage
    )
    values (
      new.organization_id,
      new.user_id,
      new.company_id,
      coalesce(nullif(trim(new.customer_name), ''), nullif(trim(new.customer_email), ''), 'Customer'),
      nullif(trim(new.customer_email), ''),
      nullif(trim(new.phone), ''),
      nullif(trim(new.address), ''),
      nullif(trim(new.address), ''),
      'customer',
      'active'
    )
    returning id into matched_customer_id;
  end if;

  new.customer_id := matched_customer_id;
  return new;
end;
$$;

drop trigger if exists jobs_ensure_customer_link on public.jobs;
create trigger jobs_ensure_customer_link
before insert or update of customer_id, customer_name, customer_email, phone, organization_id
on public.jobs
for each row
execute function public.ensure_job_customer_link();

-- Backfill existing jobs that have customer details but no customer_id.
-- Updating a watched column invokes the trigger without changing the displayed name.
update public.jobs
set customer_name = customer_name
where customer_id is null
  and organization_id is not null
  and (
    nullif(trim(coalesce(customer_name, '')), '') is not null
    or nullif(trim(coalesce(customer_email, '')), '') is not null
    or nullif(trim(coalesce(phone, '')), '') is not null
  );

create index if not exists customers_organization_company_name_lower_idx
  on public.customers (organization_id, lower(company_name));

create index if not exists customers_organization_email_lower_idx
  on public.customers (organization_id, lower(email));
