alter table public.organization_settings
  add column if not exists preferred_payment_method text,
  add column if not exists payment_link text,
  add column if not exists payment_instructions text;

comment on column public.organization_settings.preferred_payment_method is 'Owner-selected customer invoice payment method label, such as stripe, square, paypal, venmo, zelle, cash_app, or custom.';
comment on column public.organization_settings.payment_link is 'Optional HTTPS payment URL shown as the primary Pay button on invoice emails.';
comment on column public.organization_settings.payment_instructions is 'Optional payment instructions shown below the invoice Pay button or when no payment URL is configured.';
