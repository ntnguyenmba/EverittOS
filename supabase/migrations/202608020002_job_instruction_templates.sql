-- Reusable multilingual job instructions.
-- Templates can apply to every job, selected customers, or selected jobs.
-- Step position supports drag-and-drop ordering in the app.

create table if not exists public.job_instruction_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  applies_to_all_jobs boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_instruction_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.job_instruction_templates(id) on delete cascade,
  position integer not null default 0,
  required boolean not null default true,
  photo_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_instruction_step_translations (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.job_instruction_steps(id) on delete cascade,
  locale text not null,
  instruction text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(step_id, locale)
);

create table if not exists public.job_instruction_customer_links (
  template_id uuid not null references public.job_instruction_templates(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  primary key (template_id, customer_id)
);

create table if not exists public.job_instruction_job_links (
  template_id uuid not null references public.job_instruction_templates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  primary key (template_id, job_id)
);

create index if not exists job_instruction_templates_org_idx
  on public.job_instruction_templates(organization_id, active);

create index if not exists job_instruction_steps_template_idx
  on public.job_instruction_steps(template_id, position);

alter table public.job_instruction_templates enable row level security;
alter table public.job_instruction_steps enable row level security;
alter table public.job_instruction_step_translations enable row level security;
alter table public.job_instruction_customer_links enable row level security;
alter table public.job_instruction_job_links enable row level security;

create policy "workspace members can view instruction templates"
on public.job_instruction_templates for select
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = job_instruction_templates.organization_id
      and m.user_id = auth.uid()
      and m.active = true
  )
);

create policy "workspace managers can manage instruction templates"
on public.job_instruction_templates for all
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = job_instruction_templates.organization_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = job_instruction_templates.organization_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
);

create policy "workspace members can view instruction steps"
on public.job_instruction_steps for select
using (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_steps.template_id
      and m.user_id = auth.uid()
      and m.active = true
  )
);

create policy "workspace managers can manage instruction steps"
on public.job_instruction_steps for all
using (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_steps.template_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_steps.template_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
);

create policy "workspace members can view instruction translations"
on public.job_instruction_step_translations for select
using (
  exists (
    select 1
    from public.job_instruction_steps s
    join public.job_instruction_templates t on t.id = s.template_id
    join public.organization_members m on m.organization_id = t.organization_id
    where s.id = job_instruction_step_translations.step_id
      and m.user_id = auth.uid()
      and m.active = true
  )
);

create policy "workspace managers can manage instruction translations"
on public.job_instruction_step_translations for all
using (
  exists (
    select 1
    from public.job_instruction_steps s
    join public.job_instruction_templates t on t.id = s.template_id
    join public.organization_members m on m.organization_id = t.organization_id
    where s.id = job_instruction_step_translations.step_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.job_instruction_steps s
    join public.job_instruction_templates t on t.id = s.template_id
    join public.organization_members m on m.organization_id = t.organization_id
    where s.id = job_instruction_step_translations.step_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
);

create policy "workspace managers can manage customer instruction links"
on public.job_instruction_customer_links for all
using (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_customer_links.template_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_customer_links.template_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
);

create policy "workspace managers can manage job instruction links"
on public.job_instruction_job_links for all
using (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_job_links.template_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_job_links.template_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
);
