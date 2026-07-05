-- Relink team-created records to the user's active profile organization.
-- This repairs accounts that created leads/customers in a personal workspace before
-- or during team invitation setup.

begin;

update public.customers c
set organization_id = p.organization_id
from public.profiles p
where c.user_id = p.id
  and p.organization_id is not null
  and c.organization_id is distinct from p.organization_id
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = c.user_id
      and om.organization_id = p.organization_id
      and om.active = true
  );

update public.jobs j
set organization_id = p.organization_id
from public.profiles p
where j.user_id = p.id
  and p.organization_id is not null
  and j.organization_id is distinct from p.organization_id
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = j.user_id
      and om.organization_id = p.organization_id
      and om.active = true
  );

update public.customers c
set record_type = 'lead'
where c.pipeline_stage in ('lead', 'qualified')
  and (c.record_type is null or c.record_type = '' or c.record_type = 'contact');

notify pgrst, 'reload schema';

commit;
