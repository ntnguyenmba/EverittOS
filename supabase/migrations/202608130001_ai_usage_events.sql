-- Ask Everitt search vs AI usage tracking (staff budget, daily limits, audit)

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_role text not null,
  feature text not null default 'ask_everitt',
  mode text not null check (mode in ('search', 'ai')),
  prompt text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_workspace_created_idx
  on public.ai_usage_events (workspace_id, created_at desc);

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

create index if not exists ai_usage_events_workspace_mode_created_idx
  on public.ai_usage_events (workspace_id, mode, created_at desc);

alter table public.ai_usage_events enable row level security;

drop policy if exists ai_usage_events_org_read on public.ai_usage_events;
create policy ai_usage_events_org_read on public.ai_usage_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_usage_events.workspace_id
        and om.active = true
    )
  );

-- Inserts are server-only (service role); deny client writes
drop policy if exists ai_usage_events_insert_deny on public.ai_usage_events;
create policy ai_usage_events_insert_deny on public.ai_usage_events
  for insert to authenticated
  with check (false);
