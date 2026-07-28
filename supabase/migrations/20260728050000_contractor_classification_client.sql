-- Allow Client as a contractor_classification option on workers.

alter table public.workers drop constraint if exists workers_contractor_classification_check;
alter table public.workers add constraint workers_contractor_classification_check
  check (
    contractor_classification is null
    or contractor_classification in ('contractor', 'owner_operator', 'client')
  );
