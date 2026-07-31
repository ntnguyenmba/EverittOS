alter table public.workers
  add column if not exists account_status text not null default 'no_account',
  add column if not exists invited_at timestamptz,
  add column if not exists account_linked_at timestamptz;

alter table public.workers
  drop constraint if exists workers_account_status_check;

alter table public.workers
  add constraint workers_account_status_check
  check (account_status in ('no_account', 'invitation_sent', 'active_account'));

update public.workers
set
  account_status = case
    when auth_user_id is not null then 'active_account'
    when invited_at is not null then 'invitation_sent'
    else 'no_account'
  end,
  account_linked_at = case
    when auth_user_id is not null then coalesce(account_linked_at, now())
    else account_linked_at
  end
where worker_type = 'contractor';

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

drop trigger if exists profiles_link_contractor_account on public.profiles;
create trigger profiles_link_contractor_account
after insert or update of email on public.profiles
for each row
execute function public.link_contractor_account_by_email();

create index if not exists workers_contractor_email_account_idx
  on public.workers (organization_id, lower(email), account_status)
  where worker_type = 'contractor' and email is not null;
