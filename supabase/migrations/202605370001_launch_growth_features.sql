-- Launch growth features: API keys, workflows, departments, scheduling columns, client portal tokens

-- ---------------------------------------------------------------------------
-- API keys (Growth and Enterprise)
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  scopes text[] not null default array['read:jobs', 'write:jobs', 'read:customers', 'read:workers'],
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_keys_org_idx on public.api_keys (organization_id);
create index if not exists api_keys_prefix_idx on public.api_keys (key_prefix);
create index if not exists api_keys_hash_idx on public.api_keys (key_hash);

alter table public.api_keys enable row level security;

drop policy if exists api_keys_org_manage on public.api_keys;
create policy api_keys_org_manage on public.api_keys
  for all using (
    public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager')
  )
  with check (
    public.member_role_in_org(organization_id) in ('owner', 'admin', 'manager')
  );

-- ---------------------------------------------------------------------------
-- Workflow templates and steps
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_templates (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  required boolean not null default true,
  step_type text not null default 'checklist'
    check (step_type in ('checklist', 'photo', 'note', 'approval')),
  created_at timestamptz not null default now()
);

create table if not exists public.job_workflow_progress (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  note text,
  photo_path text,
  created_at timestamptz not null default now(),
  unique (job_id, workflow_step_id)
);

create index if not exists workflow_templates_org_idx on public.workflow_templates (organization_id);
create index if not exists workflow_steps_workflow_idx on public.workflow_steps (workflow_id, sort_order);
create index if not exists job_workflow_progress_job_idx on public.job_workflow_progress (job_id);

alter table public.workflow_templates enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.job_workflow_progress enable row level security;

drop policy if exists workflow_templates_org on public.workflow_templates;
create policy workflow_templates_org on public.workflow_templates
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists workflow_steps_org on public.workflow_steps;
create policy workflow_steps_org on public.workflow_steps
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists job_workflow_progress_org on public.job_workflow_progress;
create policy job_workflow_progress_org on public.job_workflow_progress
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.department_memberships (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (department_id, user_id)
);

create index if not exists departments_org_idx on public.departments (organization_id);
create index if not exists department_memberships_user_idx on public.department_memberships (user_id);
create index if not exists department_memberships_dept_idx on public.department_memberships (department_id);

alter table public.departments enable row level security;
alter table public.department_memberships enable row level security;

drop policy if exists departments_org on public.departments;
create policy departments_org on public.departments
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists department_memberships_org on public.department_memberships;
create policy department_memberships_org on public.department_memberships
  for all using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

-- ---------------------------------------------------------------------------
-- Job / customer / worker department and scheduling columns
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists workflow_template_id uuid references public.workflow_templates (id) on delete set null,
  add column if not exists department_id uuid references public.departments (id) on delete set null,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz;

alter table public.customers
  add column if not exists department_id uuid references public.departments (id) on delete set null;

alter table public.workers
  add column if not exists department_id uuid references public.departments (id) on delete set null;

create index if not exists jobs_department_idx on public.jobs (department_id);
create index if not exists jobs_scheduled_start_idx on public.jobs (scheduled_start);
create index if not exists jobs_workflow_template_idx on public.jobs (workflow_template_id);
create index if not exists customers_department_idx on public.customers (department_id);

-- ---------------------------------------------------------------------------
-- Org settings: report contact fields
-- ---------------------------------------------------------------------------
alter table public.organization_settings
  add column if not exists company_address text;

-- ---------------------------------------------------------------------------
-- Client portal: invitation job link and portal token
-- ---------------------------------------------------------------------------
alter table public.organization_invitations
  add column if not exists job_id uuid references public.jobs (id) on delete set null;

alter table public.job_client_access
  add column if not exists portal_token text unique default encode(gen_random_bytes(18), 'hex'),
  add column if not exists granted_at timestamptz default now(),
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

create index if not exists job_client_access_token_idx on public.job_client_access (portal_token);
