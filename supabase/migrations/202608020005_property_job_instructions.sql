-- Allow reusable instruction templates to be assigned to specific properties.

create table if not exists public.job_instruction_property_links (
  template_id uuid not null references public.job_instruction_templates(id) on delete cascade,
  property_id uuid not null references public.customer_properties(id) on delete cascade,
  primary key (template_id, property_id)
);

alter table public.job_instruction_property_links enable row level security;

create policy "workspace members can view property instruction links"
on public.job_instruction_property_links for select
using (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_property_links.template_id
      and m.user_id = auth.uid()
      and m.active = true
  )
);

create policy "workspace managers can manage property instruction links"
on public.job_instruction_property_links for all
using (
  exists (
    select 1
    from public.job_instruction_templates t
    join public.organization_members m on m.organization_id = t.organization_id
    where t.id = job_instruction_property_links.template_id
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
    where t.id = job_instruction_property_links.template_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin', 'manager')
  )
);

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
      or (
        new.property_id is not null
        and exists (
          select 1
          from public.job_instruction_property_links property_link
          where property_link.template_id = t.id
            and property_link.property_id = new.property_id
        )
      )
    )
  on conflict (template_id, job_id) do nothing;

  return new;
end;
$$;
