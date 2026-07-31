-- Repair invoices whose summary says money was paid but whose payment ledger is empty.
-- Dashboard cash and outstanding calculations prefer invoice_payments, so these
-- legacy/missed rows must be represented in the ledger.

insert into public.invoice_payments (
  organization_id,
  invoice_id,
  amount,
  paid_at,
  payment_method,
  payment_reference,
  notes,
  source
)
select
  i.organization_id,
  i.id,
  least(
    greatest(coalesce(i.amount_paid, 0), 0),
    greatest(coalesce(i.amount, 0), coalesce(i.amount_paid, 0))
  ),
  coalesce(i.last_payment_at, i.paid_at, i.updated_at, i.created_at, now()),
  i.payment_method,
  i.payment_reference,
  'Repaired missing invoice payment ledger row',
  'legacy_backfill'
from public.invoices i
where coalesce(i.amount_paid, 0) > 0
  and lower(coalesce(i.payment_status, '')) not in ('cancelled', 'canceled', 'void', 'voided', 'deleted')
  and lower(coalesce(i.status, '')) not in ('cancelled', 'canceled', 'void', 'voided', 'deleted')
  and not exists (
    select 1
    from public.invoice_payments p
    where p.invoice_id = i.id
  )
on conflict do nothing;

-- Reconcile all affected invoice summaries from the ledger after repair.
do $$
declare
  v_invoice_id uuid;
begin
  for v_invoice_id in
    select distinct i.id
    from public.invoices i
    join public.invoice_payments p on p.invoice_id = i.id
    where coalesce(i.amount_paid, 0) > 0
  loop
    perform public.reconcile_invoice_payment_summary(v_invoice_id);
  end loop;
end;
$$;

comment on table public.invoice_payments is
  'Per-payment ledger for invoice cash; missing legacy rows are repaired by migration 202609180001.';
