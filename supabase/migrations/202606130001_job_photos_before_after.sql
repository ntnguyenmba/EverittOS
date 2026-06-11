-- Before / Progress / After photo documentation enhancements

alter table public.job_photos
  add column if not exists uploader_display_name text;

alter table public.job_photos
  add column if not exists file_size_bytes integer;

alter table public.job_photos
  add column if not exists mime_type text;

-- Normalize legacy labels to before | progress | after
update public.job_photos
set label = 'progress'
where label in ('during', 'other');

alter table public.job_photos drop constraint if exists job_photos_label_check;
alter table public.job_photos add constraint job_photos_label_check
  check (label in ('before', 'progress', 'after'));

create index if not exists job_photos_job_id_label_idx on public.job_photos (job_id, label);

comment on column public.job_photos.uploader_display_name is 'Display name captured at upload time';
comment on column public.job_photos.file_size_bytes is 'Stored object size after client compression';

-- Free tier: limited photo documentation for every workspace
update public.plan_tier_limits
set photos_cap = 20
where plan_id = 'free';

-- Upload/delete policies: org members with job access; managers+ may delete any org photo
drop policy if exists job_photos_delete_role on public.job_photos;
create policy job_photos_delete_role on public.job_photos
  for delete using (
    auth.uid() = user_id
    or (
      organization_id is not null
      and public.is_org_member(organization_id)
      and public.can_manage_organization(organization_id)
    )
    or (
      organization_id is not null
      and public.is_org_member(organization_id)
      and public.current_profile_role() = 'manager'
    )
  );

drop policy if exists job_photos_insert_role on public.job_photos;
create policy job_photos_insert_role on public.job_photos
  for insert with check (
    auth.uid() = user_id
    and (
      organization_id is null
      or public.is_org_member(organization_id)
    )
    and (
      public.current_profile_role() in ('owner', 'admin', 'manager', 'employee', 'contractor')
      or public.is_assigned_to_job(job_id)
    )
  );

drop policy if exists job_photos_select_role on public.job_photos;
create policy job_photos_select_role on public.job_photos
  for select using (
    auth.uid() = user_id
    or (organization_id is not null and public.is_org_member(organization_id))
    or public.is_assigned_to_job(job_id)
    or (
      exists (
        select 1 from public.job_client_access jca
        where jca.job_id = job_photos.job_id
          and jca.client_user_id = auth.uid()
          and jca.can_view_photos = true
      )
    )
  );

-- Storage: org members may read job photos; upload under own uid folder or assigned job path
drop policy if exists job_photos_storage_delete on storage.objects;
create policy job_photos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'job-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.job_photos jp
        where jp.storage_path = name
          and jp.organization_id is not null
          and public.can_manage_organization(jp.organization_id)
      )
    )
  );
