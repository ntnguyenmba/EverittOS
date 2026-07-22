-- Repair production CRM constraints so current lead and customer actions work.
-- Safe to run more than once.

-- Normalize legacy values before replacing constraints.
update public.customers
set record_type = case
  when record_type in ('lead', 'customer', 'contact', 'company', 'staffing') then record_type
  when pipeline_stage in ('open', 'lead', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'negotiating', 'reopened', 'closed_lost', 'lost', 'cancelled', 'canceled') then 'lead'
  else 'customer'
end
where record_type is null
   or record_type not in ('lead', 'customer', 'contact', 'company', 'staffing');

update public.customers
set pipeline_stage = case
  when pipeline_stage = 'lead' then 'open'
  when pipeline_stage = 'negotiating' then 'negotiation'
  when pipeline_stage = 'lost' then 'closed_lost'
  when pipeline_stage = 'canceled' then 'cancelled'
  when pipeline_stage is null or pipeline_stage = '' then
    case when record_type = 'lead' then 'open' else 'active' end
  else pipeline_stage
end;

alter table public.customers drop constraint if exists customers_record_type_check;
alter table public.customers add constraint customers_record_type_check
  check (record_type in ('lead', 'customer', 'contact', 'company', 'staffing'));

alter table public.customers drop constraint if exists customers_pipeline_stage_check;
alter table public.customers add constraint customers_pipeline_stage_check
  check (
    pipeline_stage in (
      -- Lead stages
      'open',
      'contacted',
      'qualified',
      'proposal_sent',
      'negotiation',
      'won',
      'closed_lost',
      'cancelled',
      'reopened',
      -- Customer lifecycle stages
      'active',
      'recurring',
      'inactive',
      'former',
      'archived',
      'past'
    )
  );
