-- EverittOS operating system foundation: CRM pipeline, tasks, knowledge, proposals, AI memory

-- CRM extensions on customers
alter table public.customers
  add column if not exists record_type text not null default 'contact',
  add column if not exists pipeline_stage text not null default 'lead',
  add column if not exists company_name text,
  add column if not exists deal_value numeric(12, 2);

alter table public.customers drop constraint if exists customers_record_type_check;
alter table public.customers add constraint customers_record_type_check
  check (record_type in ('lead', 'contact', 'company'));

alter table public.customers drop constraint if exists customers_pipeline_stage_check;
alter table public.customers add constraint customers_pipeline_stage_check
  check (pipeline_stage in ('lead', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'));

-- Projects
create table if not exists public.os_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists os_projects_org_idx on public.os_projects (organization_id);

-- Tasks
create table if not exists public.os_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.os_projects(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'normal',
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists os_tasks_org_idx on public.os_tasks (organization_id, status);
create index if not exists os_tasks_due_idx on public.os_tasks (organization_id, due_date);

-- Knowledge documents
create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  category text not null default 'document',
  body text,
  storage_path text,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_documents_org_idx on public.knowledge_documents (organization_id, category);

-- Proposals
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  amount numeric(12, 2),
  body text,
  sent_at timestamptz,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_org_idx on public.proposals (organization_id, status);

-- Automations (foundation)
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  condition_json jsonb not null default '{}'::jsonb,
  action_type text not null,
  action_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automations_org_idx on public.automations (organization_id, active);

-- AI memory per organization
create table if not exists public.organization_ai_memory (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  company_profile text,
  services text,
  team_notes text,
  service_areas text,
  pricing_rules text,
  brand_voice text,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- AI generation log (server-side usage tracking)
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  feature text not null default 'ask_everitt',
  prompt text,
  response text,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists ai_generations_org_month_idx on public.ai_generations (organization_id, created_at desc);

-- RLS
alter table public.os_projects enable row level security;
alter table public.os_tasks enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.proposals enable row level security;
alter table public.automations enable row level security;
alter table public.organization_ai_memory enable row level security;
alter table public.ai_generations enable row level security;

drop policy if exists os_projects_org on public.os_projects;
create policy os_projects_org on public.os_projects for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists os_tasks_org on public.os_tasks;
create policy os_tasks_org on public.os_tasks for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists knowledge_documents_org on public.knowledge_documents;
create policy knowledge_documents_org on public.knowledge_documents for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists proposals_org on public.proposals;
create policy proposals_org on public.proposals for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists automations_org on public.automations;
create policy automations_org on public.automations for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists organization_ai_memory_org on public.organization_ai_memory;
create policy organization_ai_memory_org on public.organization_ai_memory for all
  using (public.is_org_member(organization_id))
  with check (public.can_manage_organization(organization_id));

drop policy if exists ai_generations_org_read on public.ai_generations;
create policy ai_generations_org_read on public.ai_generations for select
  using (public.is_org_member(organization_id));

drop policy if exists ai_generations_deny_write on public.ai_generations;
create policy ai_generations_deny_write on public.ai_generations for insert with check (false);

-- Plan tier AI flags (Business + Enterprise per lib/plan-config.ts)
alter table public.plan_tier_limits
  add column if not exists ai_access boolean not null default false,
  add column if not exists ai_unlimited boolean not null default false;

update public.plan_tier_limits set ai_access = false, ai_unlimited = false;
update public.plan_tier_limits set ai_access = true where plan_id in ('business', 'enterprise');
update public.plan_tier_limits set ai_unlimited = true where plan_id = 'enterprise';
