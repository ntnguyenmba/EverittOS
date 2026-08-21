alter table public.pricing_helper_settings add column if not exists market_country_code text not null default 'US';
alter table public.pricing_helper_settings add column if not exists market_region text not null default '';
alter table public.pricing_helper_settings add column if not exists market_city text not null default '';
