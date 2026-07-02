-- Customer messaging foundation without visual changes.

create extension if not exists "pgcrypto";

create table if not exists public.customer_message_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  subject text,
  status text not null default 'open',
  last_message_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  thread_id uuid not null references public.customer_message_threads (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  direction text not null default 'outbound',
  sender_email text,
  recipient_email text,
  subject text,
  body text not null default '',
  status text not null default 'draft',
  sent_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_message_threads_org_idx on public.customer_message_threads (organization_id, status, updated_at desc);
create index if not exists customer_messages_thread_idx on public.customer_messages (thread_id, created_at asc);
create index if not exists customer_messages_org_idx on public.customer_messages (organization_id, created_at desc);

alter table public.customer_message_threads enable row level security;
alter table public.customer_messages enable row level security;
