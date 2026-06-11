-- Tighten organization_settings RLS: members read, owner/admin write only.
-- Managers, workers, contractors, viewers, and clients cannot mutate org settings.

drop policy if exists organization_settings_member on public.organization_settings;

drop policy if exists organization_settings_select on public.organization_settings;
create policy organization_settings_select on public.organization_settings
  for select
  using (public.is_org_member(organization_id));

drop policy if exists organization_settings_insert on public.organization_settings;
create policy organization_settings_insert on public.organization_settings
  for insert
  with check (public.member_role_in_org(organization_id) in ('owner', 'admin'));

drop policy if exists organization_settings_update on public.organization_settings;
create policy organization_settings_update on public.organization_settings
  for update
  using (public.member_role_in_org(organization_id) in ('owner', 'admin'))
  with check (public.member_role_in_org(organization_id) in ('owner', 'admin'));

drop policy if exists organization_settings_delete on public.organization_settings;
create policy organization_settings_delete on public.organization_settings
  for delete
  using (public.member_role_in_org(organization_id) in ('owner', 'admin'));
