-- Playbook visibility: managers can manage all items; workers can read only assigned items.

drop policy if exists knowledge_documents_org on public.knowledge_documents;
drop policy if exists knowledge_documents_select on public.knowledge_documents;
drop policy if exists knowledge_documents_insert on public.knowledge_documents;
drop policy if exists knowledge_documents_update on public.knowledge_documents;
drop policy if exists knowledge_documents_delete on public.knowledge_documents;

create policy knowledge_documents_select
on public.knowledge_documents
for select
using (
  public.can_manage_organization(organization_id)
  or (
    public.is_org_member(organization_id)
    and (
      'assigned:all' = any(tags)
      or ('assigned:' || auth.uid()::text) = any(tags)
    )
  )
);

create policy knowledge_documents_insert
on public.knowledge_documents
for insert
with check (public.can_manage_organization(organization_id));

create policy knowledge_documents_update
on public.knowledge_documents
for update
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

create policy knowledge_documents_delete
on public.knowledge_documents
for delete
using (public.can_manage_organization(organization_id));
