-- Automatically attach reusable instructions whenever a job is created.
-- Applies organization-wide templates and templates linked to the selected customer.

create or replace function public.apply_instruction_templates_to_new_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_instruction_job_links (template_id, job_id)
  select t.id, new.id
  from public.job_instruction_templates t
  where t.organization_id = new.organization_id
    and t.active = true
    and (
      t.applies_to_all_jobs = true
      or (
        new.customer_id is not null
        and exists (
          select 1
          from public.job_instruction_customer_links customer_link
          where customer_link.template_id = t.id
            and customer_link.customer_id = new.customer_id
        )
      )
    )
  on conflict (template_id, job_id) do nothing;

  return new;
end;
$$;

drop trigger if exists apply_instruction_templates_after_job_insert on public.jobs;

create trigger apply_instruction_templates_after_job_insert
after insert on public.jobs
for each row
execute function public.apply_instruction_templates_to_new_job();

-- Let active workspace members read the templates linked to jobs and customers.
create policy "workspace members can view customer instruction links"
on public.job_instruction_customer_links for select
using (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_customer_links.template_id
      and m.user_id = auth.uid()
      and m.active = true
  )
);

create policy "workspace members can view job instruction links"
on public.job_instruction_job_links for select
using (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_job_links.template_id
      and m.user_id = auth.uid()
      and m.active = true
  )
);
