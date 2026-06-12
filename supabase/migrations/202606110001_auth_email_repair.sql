-- Repair profile emails that were stored with mixed case or stray whitespace before
-- server-side normalizeEmail() was enforced at signup and login.
-- Auth passwords live in auth.users and cannot be repaired here; affected users must
-- complete forgot-password after this deploy so update-password runs on the server.

update public.profiles
set email = lower(trim(email))
where email is not null
  and email <> lower(trim(email));

update public.business_profiles
set email = lower(trim(email))
where email is not null
  and email <> lower(trim(email));
