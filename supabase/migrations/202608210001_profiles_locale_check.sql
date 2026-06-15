-- Idempotent locale constraint (en, es, vi). Safe if already applied.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_locale_check') then
    alter table public.profiles
      add constraint profiles_locale_check check (locale in ('en', 'es', 'vi'));
  end if;
end $$;
