-- EverittOS manual demo seed (development / investor walkthrough only).
-- NEVER run this in production for new signups. It inserts fake customers, workers, and jobs.
-- New accounts must start with a clean workspace via normal signup bootstrap only.
-- Run manually in Supabase SQL editor. Do NOT run automatically in production.

-- Replace with your demo owner auth user id after creating a demo account in Supabase Auth.
-- Example: select id from auth.users where email = 'demo@everittventures.com';

do $$
declare
  demo_user uuid;
  demo_org uuid;
  demo_customer uuid;
  demo_worker uuid;
  demo_job uuid;
  demo_dept uuid;
  demo_workflow uuid;
begin
  select id into demo_user from auth.users where email = 'demo@everittventures.com' limit 1;
  if demo_user is null then
    raise notice 'Create demo@everittventures.com in Supabase Auth first, then re-run this script.';
    return;
  end if;

  insert into public.organizations (name, owner_user_id)
  values ('Everitt Demo Services', demo_user)
  on conflict do nothing
  returning id into demo_org;

  if demo_org is null then
    select id into demo_org from public.organizations where owner_user_id = demo_user limit 1;
  end if;

  update public.profiles set organization_id = demo_org, plan = 'growth', role = 'owner' where id = demo_user;

  insert into public.organization_settings (organization_id, company_email, company_phone, website, company_address)
  values (demo_org, 'demo@everittventures.com', '512-555-0100', 'https://everittventures.com', 'Austin, TX')
  on conflict (organization_id) do update set website = excluded.website;

  insert into public.customers (user_id, organization_id, company_name, phone, email, address)
  values (demo_user, demo_org, 'Riverfront Property Group', '512-555-0188', 'ops@riverfront.example', '1200 Congress Ave')
  returning id into demo_customer;

  insert into public.workers (user_id, organization_id, name, role, phone)
  values (demo_user, demo_org, 'Jordan Lee', 'technician', '512-555-0199')
  returning id into demo_worker;

  insert into public.departments (organization_id, name, description)
  values (demo_org, 'Operations', 'Field service and inspections')
  returning id into demo_dept;

  insert into public.jobs (user_id, organization_id, customer_id, title, customer_name, status, assigned_to, department_id, start_date, due_date, scheduled_start, scheduled_end)
  values (
    demo_user,
    demo_org,
    demo_customer,
    'Quarterly HVAC inspection',
    'Riverfront Property Group',
    'scheduled',
    demo_worker,
    demo_dept,
    current_date,
    current_date + 2,
    now(),
    now() + interval '2 days'
  )
  returning id into demo_job;

  insert into public.workflow_templates (organization_id, name, description, active, created_by)
  values (demo_org, 'Inspection checklist', 'Standard inspection workflow', true, demo_user)
  returning id into demo_workflow;

  insert into public.workflow_steps (workflow_id, organization_id, title, sort_order, step_type, required)
  values
    (demo_workflow, demo_org, 'Arrive on site', 0, 'checklist', true),
    (demo_workflow, demo_org, 'Capture before photos', 1, 'photo', true),
    (demo_workflow, demo_org, 'Manager approval', 2, 'approval', false);

  update public.jobs set workflow_template_id = demo_workflow where id = demo_job;

  insert into public.job_reports (user_id, organization_id, job_id, title)
  values (demo_user, demo_org, demo_job, 'Inspection report draft');

  raise notice 'Demo org % seeded with customer, worker, job, department, and workflow.', demo_org;
end $$;
