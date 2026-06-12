-- Full job photo metadata + org-wide storage read + bucket ensure

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.job_photos
  add column if not exists photo_type text;

alter table public.job_photos
  add column if not exists uploaded_by uuid references auth.users (id) on delete set null;

alter table public.job_photos
  add column if not exists file_name text;

alter table public.job_photos
  add column if not exists public_url text;

update public.job_photos
set photo_type = label
where photo_type is null and label is not null;

update public.job_photos
set photo_type = 'progress'
where photo_type is null;

update public.job_photos
set uploaded_by = user_id
where uploaded_by is null and user_id is not null;

update public.job_photos
set file_name = split_part(storage_path, '/', -1)
where file_name is null and storage_path is not null;

alter table public.job_photos drop constraint if exists job_photos_photo_type_check;
alter table public.job_photos add constraint job_photos_photo_type_check
  check (photo_type in ('before', 'progress', 'after'));

create index if not exists job_photos_job_id_photo_type_idx on public.job_photos (job_id, photo_type);

comment on column public.job_photos.photo_type is 'before | progress | after';
comment on column public.job_photos.uploaded_by is 'User who uploaded the photo (mirrors user_id)';
comment on column public.job_photos.file_name is 'Original or sanitized filename at upload';
comment on column public.job_photos.public_url is 'Optional public URL when bucket object is public';

-- Keep label in sync with photo_type for legacy readers
create or replace function public.sync_job_photo_type()
returns trigger
language plpgsql
as $$
begin
  if new.photo_type is not null then
    new.label := new.photo_type;
  elsif new.label is not null then
    new.photo_type := new.label;
  end if;
  if new.uploaded_by is null and new.user_id is not null then
    new.uploaded_by := new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists job_photos_sync_type on public.job_photos;
create trigger job_photos_sync_type
  before insert or update on public.job_photos
  for each row execute function public.sync_job_photo_type();

-- Org members and clients with photo access can read storage objects
drop policy if exists job_photos_storage_select on storage.objects;
create policy job_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'job-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1
        from public.job_photos jp
        join public.jobs j on j.id = jp.job_id
        where jp.storage_path = name
          and (
            (jp.organization_id is not null and public.is_org_member(jp.organization_id))
            or public.is_assigned_to_job(j.id)
            or (
              exists (
                select 1
                from public.job_client_access jca
                where jca.job_id = jp.job_id
                  and jca.client_user_id = auth.uid()
                  and jca.can_view_photos = true
              )
            )
          )
      )
    )
  );
