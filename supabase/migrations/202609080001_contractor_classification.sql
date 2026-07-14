-- Contractor classification for owner-operators vs independent contractors.

alter table public.workers
  add column if not exists contractor_classification text;

update public.workers
set contractor_classification = 'contractor'
where worker_type = 'contractor'
  and contractor_classification is null;

alter table public.workers drop constraint if exists workers_contractor_classification_check;
alter table public.workers add constraint workers_contractor_classification_check
  check (
    contractor_classification is null
    or contractor_classification in ('contractor', 'owner_operator')
  );

create index if not exists workers_contractor_classification_idx
  on public.workers (contractor_classification)
  where worker_type = 'contractor';
