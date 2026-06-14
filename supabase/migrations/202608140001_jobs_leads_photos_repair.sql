-- Safe repair: job_photos metadata, jobs schedule timestamps, lead_source values.

-- job_photos columns used by the app
alter table public.job_photos add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.job_photos add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.job_photos add column if not exists job_id uuid references public.jobs (id) on delete cascade;
alter table public.job_photos add column if not exists storage_path text;
alter table public.job_photos add column if not exists label text default 'progress';
alter table public.job_photos add column if not exists photo_type text;
alter table public.job_photos add column if not exists uploaded_by uuid references auth.users (id) on delete set null;
alter table public.job_photos add column if not exists file_name text;
alter table public.job_photos add column if not exists public_url text;
alter table public.job_photos add column if not exists uploader_display_name text;
alter table public.job_photos add column if not exists file_size_bytes bigint;
alter table public.job_photos add column if not exists mime_type text;
alter table public.job_photos add column if not exists created_at timestamptz not null default now();

update public.job_photos set photo_type = coalesce(photo_type, label, 'progress') where photo_type is null;
update public.job_photos set label = coalesce(label, photo_type, 'progress') where label is null;
update public.job_photos set uploaded_by = user_id where uploaded_by is null and user_id is not null;
update public.job_photos set file_name = split_part(storage_path, '/', -1) where file_name is null and storage_path is not null;

alter table public.job_photos drop constraint if exists job_photos_label_check;
alter table public.job_photos add constraint job_photos_label_check
  check (label in ('before', 'progress', 'after', 'during', 'other'));

alter table public.job_photos drop constraint if exists job_photos_photo_type_check;
alter table public.job_photos add constraint job_photos_photo_type_check
  check (photo_type in ('before', 'progress', 'after', 'during', 'other'));

-- Jobs schedule timestamps
alter table public.jobs add column if not exists start_date date;
alter table public.jobs add column if not exists due_date date;
alter table public.jobs add column if not exists scheduled_start timestamptz;
alter table public.jobs add column if not exists scheduled_end timestamptz;
alter table public.jobs add column if not exists assigned_to uuid references public.workers (id) on delete set null;

-- Expand lead_source to match UI options
alter table public.customers drop constraint if exists customers_lead_source_check;
alter table public.customers add constraint customers_lead_source_check
  check (lead_source in (
    'website', 'referral', 'facebook', 'google', 'instagram', 'manual', 'form', 'other',
    'phone_call', 'google_search', 'google_business_profile', 'repeat_customer',
    'yelp', 'thumbtack', 'angi', 'homeadvisor', 'door_hanger', 'yard_sign', 'vehicle_wrap', 'walk_in'
  ));

-- Sync trigger for photo_type / label (idempotent)
create or replace function public.sync_job_photo_type()
returns trigger
language plpgsql
as $$
begin
  if new.photo_type is not null then
    new.label := new.photo_type;
  elsif new.label is not null then
    new.photo_type := new.label;
  else
    new.photo_type := 'progress';
    new.label := 'progress';
  end if;
  if new.uploaded_by is null and new.user_id is not null then
    new.uploaded_by := new.user_id;
  end if;
  if new.file_name is null and new.storage_path is not null then
    new.file_name := split_part(new.storage_path, '/', -1);
  end if;
  return new;
end;
$$;

drop trigger if exists job_photos_sync_type on public.job_photos;
create trigger job_photos_sync_type
  before insert or update on public.job_photos
  for each row execute function public.sync_job_photo_type();
