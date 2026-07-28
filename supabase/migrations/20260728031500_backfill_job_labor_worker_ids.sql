-- Repair historical contractor-pay rows that were saved with a worker name
-- but without workers.id. Contractor dashboards intentionally scope earnings
-- by worker_id, so unlinked rows otherwise appear as $0 even when marked paid.

-- 1. Match a labor row when its normalized worker name identifies exactly one
-- worker inside the same organization.
with unique_name_matches as (
  select
    jl.id as labor_id,
    min(w.id::text)::uuid as worker_id
  from public.job_labor jl
  join public.workers w
    on w.organization_id = jl.organization_id
   and lower(trim(w.name)) = lower(trim(jl.worker_name))
  where jl.worker_id is null
    and nullif(trim(jl.worker_name), '') is not null
  group by jl.id
  having count(*) = 1
)
update public.job_labor jl
set worker_id = matches.worker_id
from unique_name_matches matches
where jl.id = matches.labor_id
  and jl.worker_id is null;

-- 2. If a row still has no worker_id, use the job assignment only when the job
-- has exactly one assigned worker. This safely repairs older rows where the
-- display name changed or was entered manually.
with single_job_assignments as (
  select
    ja.job_id,
    min(ja.worker_id::text)::uuid as worker_id
  from public.job_assignments ja
  group by ja.job_id
  having count(distinct ja.worker_id) = 1
)
update public.job_labor jl
set worker_id = assignments.worker_id
from single_job_assignments assignments
where jl.job_id = assignments.job_id
  and jl.worker_id is null;

create index if not exists job_labor_worker_payment_idx
  on public.job_labor (organization_id, worker_id, payment_status, paid_at);

comment on column public.job_labor.worker_id is
  'Worker receiving this contractor payment. Required for contractor earnings visibility.';
