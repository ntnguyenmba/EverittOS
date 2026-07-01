create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  color text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('lead', 'member')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.jobs add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists teams_org_idx on public.teams (organization_id, active);
create index if not exists team_members_org_user_idx on public.team_members (organization_id, user_id);
create index if not exists jobs_team_id_idx on public.jobs (organization_id, team_id);
