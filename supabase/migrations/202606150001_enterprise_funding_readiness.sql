-- Enterprise funding readiness: security events, demo isolation, branding support

alter table public.organizations
  add column if not exists is_demo boolean not null default false;

create index if not exists organizations_is_demo_idx on public.organizations (is_demo) where is_demo = true;

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text not null,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_events_org_created_idx
  on public.security_events (organization_id, created_at desc);

create index if not exists security_events_type_created_idx
  on public.security_events (event_type, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists security_events_org_select on public.security_events;
create policy security_events_org_select on public.security_events
  for select using (
    organization_id is not null
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = security_events.organization_id
        and om.user_id = auth.uid()
        and om.active = true
        and om.role in ('owner', 'admin')
    )
  );

comment on table public.security_events is 'Security and auth audit events for org admins and platform review.';
