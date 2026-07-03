-- Optional assignee email on jobs (no worker or org member record required).

alter table public.jobs add column if not exists assigned_email text;

create index if not exists jobs_assigned_email_idx
  on public.jobs (organization_id, assigned_email)
  where assigned_email is not null;

comment on column public.jobs.assigned_email is
  'Optional assignee contact email. Does not require a linked worker or organization member.';

-- Staff may update job status without touching assigned_email.
create or replace function public.enforce_job_edit_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if coalesce(new.organization_id, old.organization_id) is not null
    and public.member_role_in_org(coalesce(new.organization_id, old.organization_id)) in ('owner', 'admin', 'manager') then
    return new;
  end if;

  if old.id is not distinct from new.id
    and old.user_id is not distinct from new.user_id
    and old.customer_id is not distinct from new.customer_id
    and old.title is not distinct from new.title
    and old.customer_name is not distinct from new.customer_name
    and old.phone is not distinct from new.phone
    and old.address is not distinct from new.address
    and old.notes is not distinct from new.notes
    and old.service_type is not distinct from new.service_type
    and old.assigned_to is not distinct from new.assigned_to
    and old.assigned_email is not distinct from new.assigned_email
    and old.scheduled_at is not distinct from new.scheduled_at
    and old.price_estimate is not distinct from new.price_estimate
    and old.before_photo_url is not distinct from new.before_photo_url
    and old.after_photo_url is not distinct from new.after_photo_url
    and old.completion_notes is not distinct from new.completion_notes
    and old.created_at is not distinct from new.created_at
    and old.completed_at is not distinct from new.completed_at
    and old.organization_id is not distinct from new.organization_id
    and old.priority is not distinct from new.priority
    and old.internal_notes is not distinct from new.internal_notes
    and old.customer_notes is not distinct from new.customer_notes
    and old.completion_verified is not distinct from new.completion_verified
    and old.property_id is not distinct from new.property_id
    and old.start_date is not distinct from new.start_date
    and old.due_date is not distinct from new.due_date
    and old.scheduled_start is not distinct from new.scheduled_start
    and old.scheduled_end is not distinct from new.scheduled_end
    and old.status is distinct from new.status then
    return new;
  end if;

  raise exception 'JOB_EDIT_REQUIRES_MANAGER';
end;
$$;
