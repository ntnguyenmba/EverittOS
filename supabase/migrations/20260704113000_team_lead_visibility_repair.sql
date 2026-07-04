-- Team lead visibility repair.
-- Backfills missing workspace links on customer/lead records so managers and owners
-- can see leads created by active team members in the same organization.

begin;

update public.customers c
set organization_id = p.organization_id
from public.profiles p
where c.organization_id is null
  and c.user_id = p.id
  and p.organization_id is not null;

update public.customers c
set organization_id = om.organization_id
from public.organization_members om
where c.organization_id is null
  and c.user_id = om.user_id
  and om.active = true;

update public.customers c
set record_type = 'lead'
where (c.pipeline_stage in ('lead', 'qualified') or c.lead_source is not null)
  and (c.record_type is null or c.record_type = '');

update public.customers c
set pipeline_stage = 'lead'
where c.record_type = 'lead'
  and (c.pipeline_stage is null or c.pipeline_stage = '');

create index if not exists customers_org_record_type_idx on public.customers (organization_id, record_type, created_at desc);
create index if not exists customers_org_pipeline_stage_idx on public.customers (organization_id, pipeline_stage, created_at desc);

notify pgrst, 'reload schema';

commit;
