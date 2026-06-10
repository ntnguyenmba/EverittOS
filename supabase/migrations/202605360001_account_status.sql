-- Account status for soft disable (data retained)

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'disabled'));

create index if not exists profiles_account_status_idx on public.profiles (account_status);

comment on column public.profiles.account_status is
  'active = normal access; disabled = blocked from protected routes until restored';
