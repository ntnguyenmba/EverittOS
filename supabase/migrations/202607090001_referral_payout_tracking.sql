-- Referral payout tracking for EverittOS signup referrals.

create table if not exists public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  referral_source text,
  referral_detail text,
  referred_by text,
  payout_status text not null default 'unpaid',
  payout_amount numeric(12, 2),
  payout_date date,
  payout_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id)
);

alter table public.referral_payouts drop constraint if exists referral_payouts_status_check;
alter table public.referral_payouts add constraint referral_payouts_status_check check (payout_status in ('unpaid', 'pending', 'paid'));

create index if not exists referral_payouts_profile_id_idx on public.referral_payouts(profile_id);
create index if not exists referral_payouts_status_idx on public.referral_payouts(payout_status);
create index if not exists referral_payouts_referred_by_idx on public.referral_payouts(referred_by);

alter table public.referral_payouts enable row level security;

drop policy if exists referral_payouts_owner_select on public.referral_payouts;
create policy referral_payouts_owner_select on public.referral_payouts
  for select using (
    auth.uid() = profile_id
    or auth.email() in ('team@everittventures.com', 'tien@everittventures.com', 'ntnguyenmba@gmail.com')
  );

drop policy if exists referral_payouts_admin_write on public.referral_payouts;
create policy referral_payouts_admin_write on public.referral_payouts
  for all using (
    auth.email() in ('team@everittventures.com', 'tien@everittventures.com', 'ntnguyenmba@gmail.com')
  ) with check (
    auth.email() in ('team@everittventures.com', 'tien@everittventures.com', 'ntnguyenmba@gmail.com')
  );
