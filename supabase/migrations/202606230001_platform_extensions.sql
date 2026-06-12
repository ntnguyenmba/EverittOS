-- Platform extensions: forms, templates, reviews, lead sources, integration framework

alter table public.customers
  add column if not exists lead_source text not null default 'manual';

alter table public.customers drop constraint if exists customers_lead_source_check;
alter table public.customers add constraint customers_lead_source_check
  check (lead_source in ('website', 'referral', 'facebook', 'google', 'instagram', 'manual', 'form', 'other'));

-- Public forms
create table if not exists public.everitt_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  form_type text not null default 'contact',
  description text,
  active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.everitt_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.everitt_forms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  field_type text not null default 'text',
  label text not null,
  required boolean not null default false,
  sort_order int not null default 0,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists everitt_form_fields_form_idx on public.everitt_form_fields (form_id, sort_order);

create table if not exists public.everitt_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.everitt_forms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'public',
  customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists everitt_form_submissions_org_idx on public.everitt_form_submissions (organization_id, created_at desc);

-- Template library
create table if not exists public.template_library (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null,
  title text not null,
  body text not null default '',
  version int not null default 1,
  parent_id uuid references public.template_library(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists template_library_org_idx on public.template_library (organization_id, category);

-- Review system
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_email text,
  status text not null default 'pending',
  message text,
  sent_at timestamptz,
  submitted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_request_id uuid references public.review_requests(id) on delete set null,
  rating int check (rating >= 1 and rating <= 5),
  body text,
  status text not null default 'submitted',
  created_at timestamptz not null default now()
);

-- Integration framework (connections only; no vendor SDKs yet)
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

-- RLS
alter table public.everitt_forms enable row level security;
alter table public.everitt_form_fields enable row level security;
alter table public.everitt_form_submissions enable row level security;
alter table public.template_library enable row level security;
alter table public.review_requests enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.integration_connections enable row level security;

drop policy if exists everitt_forms_org on public.everitt_forms;
create policy everitt_forms_org on public.everitt_forms for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists everitt_form_fields_org on public.everitt_form_fields;
create policy everitt_form_fields_org on public.everitt_form_fields for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists everitt_form_submissions_org on public.everitt_form_submissions;
create policy everitt_form_submissions_org on public.everitt_form_submissions for select
  using (public.is_org_member(organization_id));

drop policy if exists everitt_form_submissions_insert on public.everitt_form_submissions;
create policy everitt_form_submissions_insert on public.everitt_form_submissions for insert
  with check (true);

drop policy if exists template_library_org on public.template_library;
create policy template_library_org on public.template_library for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists review_requests_org on public.review_requests;
create policy review_requests_org on public.review_requests for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists customer_reviews_org on public.customer_reviews;
create policy customer_reviews_org on public.customer_reviews for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists integration_connections_org on public.integration_connections;
create policy integration_connections_org on public.integration_connections for all
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- Public read active forms by slug (anon can read form definition for rendering)
drop policy if exists everitt_forms_public_read on public.everitt_forms;
create policy everitt_forms_public_read on public.everitt_forms for select
  using (active = true);

drop policy if exists everitt_form_fields_public_read on public.everitt_form_fields;
create policy everitt_form_fields_public_read on public.everitt_form_fields for select
  using (
    exists (
      select 1 from public.everitt_forms f
      where f.id = form_id and f.active = true
    )
  );
