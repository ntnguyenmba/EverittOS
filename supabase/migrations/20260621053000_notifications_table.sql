-- Notifications table for contact request inbox items.
-- Idempotent and safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null default 'general',
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_user_id
  on public.notifications(recipient_user_id);

create index if not exists idx_notifications_unread_recipient
  on public.notifications(recipient_user_id, created_at desc)
  where read_at is null;

create index if not exists idx_notifications_contact_request_dedupe
  on public.notifications(type, actor_user_id, recipient_user_id, entity_type, entity_id, created_at desc);

alter table public.notifications enable row level security;

-- Recipients can see their own notifications; admins can see all for support.
drop policy if exists "users can read own notifications" on public.notifications;
create policy "users can read own notifications"
  on public.notifications for select
  to authenticated
  using (recipient_user_id = auth.uid() or public.is_platform_admin());

-- Signed-in users can create a notification as themselves for another user.
drop policy if exists "users can create contact request notifications" on public.notifications;
create policy "users can create contact request notifications"
  on public.notifications for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and recipient_user_id <> auth.uid()
  );

-- Recipients can mark their own notifications read; admins can support updates.
drop policy if exists "users can update own notifications" on public.notifications;
create policy "users can update own notifications"
  on public.notifications for update
  to authenticated
  using (recipient_user_id = auth.uid() or public.is_platform_admin())
  with check (recipient_user_id = auth.uid() or public.is_platform_admin());

-- Keep deletes restricted to admins only.
drop policy if exists "admins can delete notifications" on public.notifications;
create policy "admins can delete notifications"
  on public.notifications for delete
  to authenticated
  using (public.is_platform_admin());
