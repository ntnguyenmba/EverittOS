-- Reusable job instructions and SOPs.
-- One template can apply to every job, selected customers, or selected jobs.
-- Step order supports drag-and-drop in the app.

create table if not exists public.job_instruction_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
 