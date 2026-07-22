-- One-time ledger reconciliation repair + mismatch report.
-- Recalculates every non-cancelled/non-void invoice from invoice_payments.
-- Does not silently delete mismatched or invalid rows.

do $$
declare
  r record;
  v_reconciled integer := 0;
  v_skipped integer := 0;
  v_unpaid_but_fully_paid integer := 0;
  v_paid_but_balance integer := 0;
  v_orphan_payments integer := 0;
  v_org_mismatches integer := 0;
  v_bad_amounts integer := 0;
  v_ledger_paid numeric(12, 2);
  v_amount numeric(12, 2);
  v_marked_paid boolean;
  v_marked_unpaid boolean;
begin
  -- Orphan payments (invoice missing)
  select count(*) into v_orphan_payments
  from public.invoice_payments p
  left join public.invoices i on i.id = p.invoice_id
  where i.id is null;

  -- Organization mismatches
  select count(*) into v_org_mismatches
  from public.invoice_payments p
  join public.invoices i on i.id = p.invoice_id
  where p.organization_id is distinct from i.organization_id;

  -- Zero / negative amounts
  select count(*) into v_bad_amounts
  from public.invoice_payments
  where coalesce(amount, 0) <= 0;

  raise notice 'invoice_payment_repair report: orphan_payments=% org_mismatches=% amount_le_zero=%',
    v_orphan_payments, v_org_mismatches, v_bad_amounts;

  for r in
    select
      i.id,
      i.organization_id,
      i.amount,
      i.amount_paid,
      i.balance_due,
      i.payment_status,
      i.status
    from public.invoices i
    order by i.created_at nulls last, i.id
  loop
    if lower(coalesce(r.payment_status, '')) in ('cancelled', 'canceled', 'void', 'voided', 'deleted')
       or lower(coalesce(r.status, '')) in ('cancelled', 'canceled', 'void', 'voided', 'deleted') then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select round(coalesce(sum(p.amount), 0)::numeric, 2)
    into v_ledger_paid
    from public.invoice_payments p
    where p.invoice_id = r.id
      and p.organization_id = r.organization_id
      and coalesce(p.amount, 0) > 0;

    v_amount := round(greatest(coalesce(r.amount, 0), 0)::numeric, 2);
    v_marked_paid := lower(coalesce(r.payment_status, r.status, '')) = 'paid';
    v_marked_unpaid := lower(coalesce(r.payment_status, '')) in ('unpaid', 'overdue')
      or (
        lower(coalesce(r.payment_status, '')) = ''
        and lower(coalesce(r.status, '')) in ('sent', 'draft', 'overdue', '')
      );

    if v_marked_unpaid and v_amount > 0 and round(v_ledger_paid, 2) >= round(v_amount, 2) then
      v_unpaid_but_fully_paid := v_unpaid_but_fully_paid + 1;
      raise notice
        'mismatch unpaid-but-fully-paid invoice=% org=% amount=% ledger_paid=% marked_payment_status=% marked_status=%',
        r.id, r.organization_id, v_amount, v_ledger_paid, r.payment_status, r.status;
    end if;

    if v_marked_paid and round(greatest(v_amount - v_ledger_paid, 0)::numeric, 2) > 0 then
      v_paid_but_balance := v_paid_but_balance + 1;
      raise notice
        'mismatch paid-but-balance invoice=% org=% amount=% ledger_paid=% balance=% marked_payment_status=% marked_status=%',
        r.id, r.organization_id, v_amount, v_ledger_paid,
        round(greatest(v_amount - v_ledger_paid, 0)::numeric, 2),
        r.payment_status, r.status;
    end if;

    perform public.reconcile_invoice_payment_summary(r.id);
    v_reconciled := v_reconciled + 1;
  end loop;

  raise notice
    'invoice_payment_repair complete: reconciled=% skipped_cancelled_or_void=% unpaid_but_fully_paid=% paid_but_remaining_balance=% orphan_payments=% org_mismatches=% amount_le_zero=%',
    v_reconciled,
    v_skipped,
    v_unpaid_but_fully_paid,
    v_paid_but_balance,
    v_orphan_payments,
    v_org_mismatches,
    v_bad_amounts;
end;
$$;
