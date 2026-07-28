-- Restore historical contractor earnings that were created before job_labor.worker_id
-- was populated reliably.
--
-- The contractor portal scopes earnings by workers.id. Older labor rows retained
-- the amount and payment status but had worker_id = null, so valid earnings were
-- invisible. This migration links those rows without changing any amounts,
-- payment statuses, or paid dates.

-- 1. Prefer the job's direct workers.id assignment when it is valid.
update public.job_labor jl
set worker_id = j.assigned_to
from public.jobs j
join public.workers w on w.id = j.assigned_to
where jl.job_id = j.id
  and jl.worker_id is null;

-- 2. For jobs using job_assignments, link the labor row when the job has exactly
-- one assigned worker. Jobs with multiple assigned workers are intentionally
-- left unchanged to avoid attributing earnings to the wrong person.
with single_assignment as (
  select
    ja.job_id,
    min(ja.worker_id::text)::uuid as worker_id
  from public.job_assignments ja
  join public.workers w on w.id = ja.worker_id
  group by ja.job_id
  having count(distinct ja.worker_id) = 1
)
update public.job_labor jl
set worker_id = sa.worker_id
from single_assignment sa
where jl.job_id = sa.job_id
  and jl.worker_id is null;

-- 3. Legacy rows sometimes stored only worker_name. Use an exact normalized name
-- match inside the job's organization only when that match is unique.
with unique_named_worker as (
  select
    jl.id as labor_id,
    min(w.id::text)::uuid as worker_id
  from public.job_labor jl
  join public.jobs j on j.id = jl.job_id
  join public.workers w on w.organization_id = j.organization_id
  where jl.worker_id is null
    and nullif(btrim(coalesce(jl.worker_name, '')), '') is not null
    and lower(regexp_replace(btrim(w.name), '\s+', ' ', 'g')) =
        lower(regexp_replace(btrim(jl.worker_name), '\s+', ' ', 'g'))
  group by jl.id
  having count(distinct w.id) = 1
)
update public.job_labor jl
set worker_id = unw.worker_id
from unique_named_worker unw
where jl.id = unw.labor_id
  and jl.worker_id is null;

create index if not exists job_labor_worker_id_idx
  on public.job_labor (worker_id);
