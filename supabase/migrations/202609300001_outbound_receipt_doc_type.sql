-- Add receipt as a first-class outbound document type (idempotent).

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'outbound_documents_doc_type_check'
      and conrelid = 'public.outbound_documents'::regclass
  ) then
    alter table public.outbound_documents
      drop constraint outbound_documents_doc_type_check;
  end if;
end $$;

alter table public.outbound_documents
  add constraint outbound_documents_doc_type_check
  check (doc_type in ('review', 'proposal', 'estimate', 'invoice', 'message', 'receipt'));
