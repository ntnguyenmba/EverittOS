create table if not exists public.catch_action_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  state text not null check (state in ('hidden', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, action_id)
);

create index if not exists catch_action_states_user_id_idx
  on public.catch_action_states (user_id);

alter table public.catch_action_states enable row level security;

revoke all on table public.catch_action_states from anon, authenticated;
grant select, insert, update, delete on table public.catch_action_states to authenticated;

drop policy if exists "catch states select own" on public.catch_action_states;
create policy "catch states select own"
  on public.catch_action_states
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "catch states insert own" on public.catch_action_states;
create policy "catch states insert own"
  on public.catch_action_states
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "catch states update own" on public.catch_action_states;
create policy "catch states update own"
  on public.catch_action_states
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "catch states delete own" on public.catch_action_states;
create policy "catch states delete own"
  on public.catch_action_states
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
