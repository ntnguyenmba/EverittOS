-- Remove demo / manual seed content from real (non-demo) workspaces.
-- Safe to run in production. Demo-only organizations (is_demo = true) are untouched.

delete from public.activity_logs
where organization_id in (select id from public.organizations where coalesce(is_demo, false) = false)
  and (
    actor_name = 'Demo seed'
    or message ilike '%demo workspace seeded%'
    or message ilike '%sample job created for demo%'
  );

delete from public.jobs j
where j.organization_id in (select id from public.organizations where coalesce(is_demo, false) = false)
  and (
    j.title in ('Quarterly HVAC inspection', 'Welcome visit', 'Visita de bienvenida', 'Chuyến thăm chào mừng')
    or j.customer_name in ('Riverfront Property Group', 'Sample customer', 'Cliente de ejemplo', 'Khách hàng mẫu')
  );

delete from public.workers w
where w.organization_id in (select id from public.organizations where coalesce(is_demo, false) = false)
  and (
    w.name in ('Jordan Lee', 'Marcus Reed', 'Sophia Nguyen', 'Daniel Brooks')
    or w.phone like '512-555-%'
    or w.phone like '214-555-%'
  );

delete from public.customers c
where c.organization_id in (select id from public.organizations where coalesce(is_demo, false) = false)
  and (
    c.name in ('Riverfront Property Group', 'Sample customer', 'Cliente de ejemplo', 'Khách hàng mẫu')
    or c.phone like '512-555-%'
    or c.phone like '214-555-%'
    or lower(c.email) like '%@riverfront.example'
  );
