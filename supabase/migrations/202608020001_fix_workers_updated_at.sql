-- Fix contractor account linking trigger on production databases where workers.updated_at is missing.

alter table public.workers
  add column if not exists updated_at timestamptz not null default now();

update public.workers
set updated_at = now()
where updated_at is null;

create or replace function public.link_contractor_account_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  update public.workers
  set
    auth_user_id = new.id,
    account_status = 'active_account',
    account_linked_at = coalesce(account_linked_at, now()),
    updated_at = now()
  where worker_type = 'contractor'
    and auth_user_id is null
    and lower(btrim(email)) = lower(btrim(new.email));

  return new;
end;
$$;
