-- Track completion for reusable instruction steps on each job.

create table if not exists public.job_instruction_completions (
  job_id uuid not null references public.jobs(id) on delete cascade,
  step_id uuid not null references public.job_instruction_steps(id) on delete cascade,
  completed boolean not null default false,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (job_id, step_id)
);

create index if not exists job_instruction_completions_job_idx
  on public.job_instruction_completions(job_id);

alter table public.job_instruction_completions enable row level security;

create policy "workspace members can view instruction completion"
on public.job_instruction_completions for select
using (
  exists (
    select 1
    from public.jobs j
    join public.organization_members m on m.organization_id = j.organization_id
    where j.id = job_instruction_completions.job_id
      and m.user_id = auth.uid()
      and m.active = true
  )
);

create policy "workspace members can update instruction completion"
on public.job_instruction_completions for all
using (
  exists (
    select 1
    from public.jobs j
    join public.organization_members m on m.organization_id = j.organization_id
    where j.id = job_instruction_completions.job_id
      and m.user_id = auth.uid()
      and m.active = true
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    join public.organization_members m on m.organization_id = j.organization_id
    where j.id = job_instruction_completions.job_id
      and m.user_id = auth.uid()
      and m.active = true
  )
);
