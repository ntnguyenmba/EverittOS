-- Real user activity tracking: profiles.last_seen_at
-- updated_at (when present) continues to represent profile edits only.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
  'Last time the authenticated user was actively using EverittOS (heartbeat). Independent of profile.updated_at.';

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc nulls last);

-- Authoritative server-clock touch; callable by the signed-in user only.
create or replace function public.touch_profile_last_seen()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ts timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
  set last_seen_at = now()
  where id = auth.uid()
  returning last_seen_at into v_ts;

  if v_ts is null then
    -- Profile row may not exist yet during early bootstrap; do not fail the client.
    return null;
  end if;

  return v_ts;
end;
$$;

revoke all on function public.touch_profile_last_seen() from public;
grant execute on function public.touch_profile_last_seen() to authenticated;
grant execute on function public.touch_profile_last_seen() to service_role;
