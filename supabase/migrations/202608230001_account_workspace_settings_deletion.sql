-- Profile + workspace settings columns and workspace soft-delete support.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists phone text;

alter table public.organizations
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz;

create index if not exists organizations_deleted_at_idx
  on public.organizations (deleted_at)
  where deleted_at is not null;

alter table public.organization_settings
  add column if not exists legal_business_name text,
  add column if not exists tax_id text,
  add column if not exists invoice_footer text,
  add column if not exists default_customer_message text,
  add column if not exists team_display_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists profile_avatars_own_select on storage.objects;
create policy profile_avatars_own_select on storage.objects
  for select using (bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists profile_avatars_own_insert on storage.objects;
create policy profile_avatars_own_insert on storage.objects
  for insert with check (bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists profile_avatars_own_update on storage.objects;
create policy profile_avatars_own_update on storage.objects
  for update using (bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists profile_avatars_own_delete on storage.objects;
create policy profile_avatars_own_delete on storage.objects
  for delete using (bucket_id = 'profile-avatars' and auth.uid()::text = (storage.foldername(name))[1]);
