-- AI usage tracking: tokens and estimated cost per generation

alter table public.ai_generations
  add column if not exists prompt_tokens int not null default 0,
  add column if not exists completion_tokens int not null default 0,
  add column if not exists total_tokens int not null default 0,
  add column if not exists estimated_cost_usd numeric(12, 6) not null default 0;

create index if not exists ai_generations_org_feature_idx
  on public.ai_generations (organization_id, feature, created_at desc);
