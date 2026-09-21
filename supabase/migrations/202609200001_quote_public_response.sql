alter table public.quotes add column if not exists public_token text;
alter table public.quotes add column if not exists public_locale text not null default 'en';
alter table public.quotes add column if not exists last_response_at timestamptz;

create unique index if not exists quotes_public_token_uidx
  on public.quotes(public_token)
  where public_token is not null;

create or replace function public.get_public_quote(p_token text)
returns table (
  id uuid,
  organization_name text,
  status text,
  service_type text,
  price numeric,
  currency text,
  customer_name text,
  notes text,
  frequency text,
  public_locale text,
  shared_at timestamptz,
  last_response_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select q.id, o.name, q.status, q.service_type, q.price, q.currency,
         q.customer_name, q.notes, q.frequency, q.public_locale,
         q.shared_at, q.last_response_at
  from public.quotes q
  join public.organizations o on o.id = q.organization_id
  where q.public_token = p_token
  limit 1;
$$;

create or replace function public.respond_public_quote(p_token text, p_status text)
returns table (
  status text,
  last_response_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if p_status not in ('accepted','declined') then
    raise exception 'invalid_status';
  end if;

  return query
  update public.quotes
  set status = p_status,
      accepted_at = case when p_status = 'accepted' then v_now else null end,
      declined_at = case when p_status = 'declined' then v_now else null end,
      last_response_at = v_now,
      updated_at = v_now
  where public_token = p_token
  returning quotes.status, quotes.last_response_at;
end;
$$;

revoke all on function public.get_public_quote(text) from public;
revoke all on function public.respond_public_quote(text,text) from public;
grant execute on function public.get_public_quote(text) to anon, authenticated;
grant execute on function public.respond_public_quote(text,text) to anon, authenticated;
