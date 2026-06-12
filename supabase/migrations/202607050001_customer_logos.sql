-- Customer logo storage (school/client logos in CRM).

alter table public.customers
  add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-logos', 'customer-logos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists customer_logos_select on storage.objects;
create policy customer_logos_select on storage.objects
  for select using (
    bucket_id = 'customer-logos'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

drop policy if exists customer_logos_insert on storage.objects;
create policy customer_logos_insert on storage.objects
  for insert with check (
    bucket_id = 'customer-logos'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

drop policy if exists customer_logos_update on storage.objects;
create policy customer_logos_update on storage.objects
  for update using (
    bucket_id = 'customer-logos'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );

drop policy if exists customer_logos_delete on storage.objects;
create policy customer_logos_delete on storage.objects
  for delete using (
    bucket_id = 'customer-logos'
    and (storage.foldername(name))[1]::uuid in (select public.current_user_org_ids())
  );
