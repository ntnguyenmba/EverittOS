-- Allow viewer invitations to match the app team role picker.

alter table public.organization_invitations drop constraint if exists organization_invitations_role_check;
alter table public.organization_invitations add constraint organization_invitations_role_check
  check (role in ('manager', 'employee', 'contractor', 'client', 'admin', 'viewer', 'crew_lead', 'staff'));

alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'manager', 'employee', 'contractor', 'client', 'admin', 'viewer', 'crew_lead', 'staff'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'admin', 'manager', 'employee', 'contractor', 'client', 'viewer', 'crew_lead', 'staff'));
