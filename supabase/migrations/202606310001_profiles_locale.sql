-- profiles.locale mirrors preferred_locale for i18n persistence
alter table public.profiles
  add column if not exists locale text default 'en';

update public.profiles
set locale = coalesce(nullif(trim(preferred_locale), ''), 'en')
where locale is null or trim(locale) = '';

create or replace function public.sync_profiles_locale_from_preferred()
returns trigger
language plpgsql
as $$
begin
  if new.preferred_locale is not null and trim(new.preferred_locale) <> '' then
    new.locale := new.preferred_locale;
  elsif new.locale is not null and trim(new.locale) <> '' then
    new.preferred_locale := new.locale;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_locale_sync on public.profiles;
create trigger profiles_locale_sync
  before insert or update of preferred_locale, locale on public.profiles
  for each row execute function public.sync_profiles_locale_from_preferred();
