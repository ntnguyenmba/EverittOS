create table if not exists public.job_timezones (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_timezones_timezone_not_blank check (length(trim(timezone)) > 0)
);

create index if not exists job_timezones_organization_id_idx
  on public.job_timezones(organization_id);

alter table public.job_timezones enable row level security;

create policy "Workspace members can view job timezones"
  on public.job_timezones for select
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = job_timezones.organization_id
        and om.user_id = auth.uid()
        and om.active = true
    )
  );

create policy "Workspace managers can manage job timezones"
  on public.job_timezones for all
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = job_timezones.organization_id
        and om.user_id = auth.uid()
        and om.active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = job_timezones.organization_id
        and om.user_id = auth.uid()
        and om.active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  );
