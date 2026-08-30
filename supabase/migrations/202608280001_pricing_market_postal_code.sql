alter table public.pricing_helper_settings
  add column if not exists market_postal_code text not null default '';
