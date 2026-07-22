-- Prevent cross-workspace references in job child tables.
-- RLS scopes rows by organization_id, but foreign keys alone do not prove that
-- job_id, customer_id, or invoice_id belong to the same organization.

create or replace function public.enforce_job_child_organization_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_org_id uuid;
begin
  if new.organization_id is null then
    raise exception 'organization_id is required';
  end if;

  if new.job_id is not null then
    select organization_id into linked_org_id
    from public.jobs
    where id = new.job_id;

    if linked_org_id is null or linked_org_id <> new.organization_id then
      raise exception 'job_id must belong to organization_id';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_job_payment_organization_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_org_id uuid;
begin
  if new.organization_id is null then
    raise exception 'organization_id is required';
  end if;

  select organization_id into linked_org_id
  from public.jobs
  where id = new.job_id;

  if linked_org_id is null or linked_org_id <> new.organization_id then
    raise exception 'job_id must belong to organization_id';
  end if;

  if new.customer_id is not null then
    select organization_id into linked_org_id
    from public.customers
    where id = new.customer_id;

    if linked_org_id is null or linked_org_id <> new.organization_id then
      raise exception 'customer_id must belong to organization_id';
    end if;
  end if;

  if new.invoice_id is not null then
    select organization_id into linked_org_id
    from public.invoices
    where id = new.invoice_id;

    if linked_org_id is null or linked_org_id <> new.organization_id then
      raise exception 'invoice_id must belong to organization_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists job_reports_organization_consistency on public.job_reports;
create trigger job_reports_organization_consistency
before insert or update of organization_id, job_id on public.job_reports
for each row execute function public.enforce_job_child_organization_consistency();

drop trigger if exists job_photos_organization_consistency on public.job_photos;
create trigger job_photos_organization_consistency
before insert or update of organization_id, job_id on public.job_photos
for each row execute function public.enforce_job_child_organization_consistency();

drop trigger if exists job_payments_organization_consistency on public.job_payments;
create trigger job_payments_organization_consistency
before insert or update of organization_id, job_id, customer_id, invoice_id on public.job_payments
for each row execute function public.enforce_job_payment_organization_consistency();

-- Fail the migration rather than silently preserving unsafe historical links.
do $$
begin
  if exists (
    select 1
    from public.job_reports r
    left join public.jobs j on j.id = r.job_id
    where j.id is null or j.organization_id <> r.organization_id
  ) then
    raise exception 'Existing job_reports rows contain cross-organization references';
  end if;

  if exists (
    select 1
    from public.job_photos p
    left join public.jobs j on j.id = p.job_id
    where j.id is null or j.organization_id <> p.organization_id
  ) then
    raise exception 'Existing job_photos rows contain cross-organization references';
  end if;

  if exists (
    select 1
    from public.job_payments p
    left join public.jobs j on j.id = p.job_id
    left join public.customers c on c.id = p.customer_id
    left join public.invoices i on i.id = p.invoice_id
    where j.id is null
       or j.organization_id <> p.organization_id
       or (p.customer_id is not null and (c.id is null or c.organization_id <> p.organization_id))
       or (p.invoice_id is not null and (i.id is null or i.organization_id <> p.organization_id))
  ) then
    raise exception 'Existing job_payments rows contain cross-organization references';
  end if;
end;
$$;
