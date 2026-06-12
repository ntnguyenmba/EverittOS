-- EVERITTTEAM shared AI budget pool (manual reset tracking)

create table if not exists public.everittteam_ai_pool (
  id int primary key default 1 check (id = 1),
  manual_reset_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.everittteam_ai_pool (id)
values (1)
on conflict (id) do nothing;

alter table public.everittteam_ai_pool enable row level security;

drop policy if exists everittteam_ai_pool_deny_all on public.everittteam_ai_pool;
create policy everittteam_ai_pool_deny_all on public.everittteam_ai_pool
  for all using (false) with check (false);

create index if not exists ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at desc);

create index if not exists profiles_stripe_promotion_code_idx
  on public.profiles (stripe_promotion_code)
  where stripe_promotion_code is not null;
