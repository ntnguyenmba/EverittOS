-- Allow signed-in users to read their own security events (sign-in history in Settings → Security).

drop policy if exists security_events_self_select on public.security_events;
create policy security_events_self_select on public.security_events
  for select using (user_id = auth.uid());
