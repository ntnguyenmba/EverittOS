-- Harden invoice payment ledger reconciliation:
-- row locks, org ownership validation, positive amounts, rounded paid checks,
-- explicit partial+overdue status rules, clear stale summary fields, void/cancelled
-- exclusion, dual-invoice reconcile on payment moves, and revoke public execute.

-- ---------------------------------------------------------------------------
-- 1) Audit zero/negative payment amounts (report only; do not delete)
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.invoice_payments
  where coalesce(amount, 0) <= 0;

  if v_bad > 0 then
    raise notice
      'invoice_payments amount audit: % row(s) have amount <= 0. Constraint not applied until cleaned.',
      v_bad;
  else
    raise notice 'invoice_payments amount audit: no zero or negative amounts found.';
  end if;
end;
$$;

-- Prefer a named positive-amount constraint when the table is clean.
do $$
begin
  if not exists (
    select 1
    from public.invoice_payments
    where coalesce(amount, 0) <= 0
  ) then
    begin
      alter table public.invoice_payments
        drop constraint if exists invoice_payments_amount_check;
    exception when undefined_object then
      null;
    end;

    begin
      alter table public.invoice_payments
        add constraint invoice_payments_amount_positive check (amount > 0);
    exception when duplicate_object then
      null;
    end;
  else
    raise notice
      'Skipping invoice_payments_amount_positive constraint because invalid amounts exist. Repair those rows first.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Ownership validation before insert/update
-- ---------------------------------------------------------------------------
create or replace function public.validate_invoice_payment_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_org uuid;
begin
  if new.invoice_id is null then
    raise exception 'Invoice payment requires an invoice_id.';
  end if;

  if new.organization_id is null then
    raise exception 'Invoice payment requires an organization_id.';
  end if;

  if tg_op = 'UPDATE' then
    if old.organization_id is distinct from new.organization_id then
      raise exception
        'Cannot move an invoice payment to another organization (payment %, from %, to %).',
        new.id, old.organization_id, new.organization_id;
    end if;
  end if;

  select i.organization_id
  into v_invoice_org
  from public.invoices i
  where i.id = new.invoice_id
  for share;

  if v_invoice_org is null then
    raise exception
      'Invoice payment references a missing invoice (%).',
      new.invoice_id;
  end if;

  if v_invoice_org is distinct from new.organization_id then
    raise exception
      'Invoice payment organization (%) does not match invoice organization (%) for invoice %.',
      new.organization_id, v_invoice_org, new.invoice_id;
  end if;

  return new;
end;
$$;

drop trigger if exists invoice_payments_validate_ownership on public.invoice_payments;
create trigger invoice_payments_validate_ownership
before insert or update on public.invoice_payments
for each row
execute function public.validate_invoice_payment_ownership();

-- ---------------------------------------------------------------------------
-- 3) Hardened reconciliation (FOR UPDATE, rounding, status rules, clear stale)
-- ---------------------------------------------------------------------------
create or replace function public.reconcile_invoice_payment_summary(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_amount numeric(12, 2);
  v_due_date date;
  v_status text;
  v_payment_status text;
  v_paid numeric(12, 2);
  v_last_paid_at timestamptz;
  v_method text;
  v_reference text;
  v_balance numeric(12, 2);
  v_next_status text;
  v_next_payment_status text;
  v_paid_at timestamptz;
  v_excluded boolean;
begin
  if p_invoice_id is null then
    return;
  end if;

  select
    i.organization_id,
    round(greatest(coalesce(i.amount, 0), 0)::numeric, 2),
    i.due_date,
    coalesce(i.status, ''),
    coalesce(i.payment_status, '')
  into v_org, v_amount, v_due_date, v_status, v_payment_status
  from public.invoices i
  where i.id = p_invoice_id
  for update;

  if v_org is null then
    return;
  end if;

  v_excluded :=
    lower(v_payment_status) in ('cancelled', 'canceled', 'void', 'voided', 'deleted')
    or lower(v_status) in ('cancelled', 'canceled', 'void', 'voided', 'deleted');

  -- Preserve cancelled / voided / deleted invoices; do not rewrite from ledger.
  if v_excluded then
    return;
  end if;

  select
    round(coalesce(sum(p.amount), 0)::numeric, 2),
    max(p.paid_at),
    (array_agg(p.payment_method order by p.paid_at desc nulls last))[1],
    (array_agg(p.payment_reference order by p.paid_at desc nulls last))[1]
  into v_paid, v_last_paid_at, v_method, v_reference
  from public.invoice_payments p
  where p.invoice_id = p_invoice_id
    and p.organization_id = v_org
    and coalesce(p.amount, 0) > 0;

  v_paid := round(greatest(coalesce(v_paid, 0), 0)::numeric, 2);
  v_balance := round(greatest(v_amount - v_paid, 0)::numeric, 2);

  if v_paid <= 0 then
    v_next_payment_status := 'unpaid';
    if v_due_date is not null and v_due_date < current_date then
      v_next_status := 'overdue';
    else
      v_next_status := case
        when lower(v_status) in ('paid', 'partial', 'overdue') then 'sent'
        else coalesce(nullif(v_status, ''), 'sent')
      end;
    end if;
    v_paid_at := null;
    v_last_paid_at := null;
    v_method := null;
    v_reference := null;
  elsif v_amount > 0 and round(v_paid, 2) >= round(v_amount, 2) then
    v_next_payment_status := 'paid';
    v_next_status := 'paid';
    v_paid_at := v_last_paid_at;
  elsif v_due_date is not null and v_due_date < current_date then
    -- Overdue is a document status, not a payment state.
    v_next_payment_status := 'partially_paid';
    v_next_status := 'overdue';
    v_paid_at := null;
  else
    v_next_payment_status := 'partially_paid';
    v_next_status := 'partial';
    v_paid_at := null;
  end if;

  update public.invoices
  set
    amount_paid = v_paid,
    balance_due = v_balance,
    payment_status = v_next_payment_status,
    status = v_next_status,
    paid_at = v_paid_at,
    last_payment_at = v_last_paid_at,
    payment_method = v_method,
    payment_reference = v_reference,
    updated_at = now()
  where id = p_invoice_id
    and organization_id = v_org;

  update public.outbound_documents
  set
    amount_paid = v_paid,
    balance_due = v_balance,
    payment_status = v_next_payment_status,
    status = v_next_status,
    paid_at = v_paid_at,
    last_payment_at = v_last_paid_at,
    payment_method = v_method,
    payment_reference = v_reference,
    updated_at = now()
  where organization_id = v_org
    and doc_type = 'invoice'
    and source_entity_id = p_invoice_id
    and lower(coalesce(payment_status, '')) not in ('cancelled', 'canceled', 'void', 'voided', 'deleted')
    and lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'void', 'voided', 'deleted');
end;
$$;

create or replace function public.invoice_payments_reconcile_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  if tg_op = 'UPDATE' and old.organization_id is distinct from new.organization_id then
    raise exception
      'Cannot change invoice payment organization (payment %).',
      coalesce(new.id, old.id);
  end if;

  if tg_op = 'DELETE' then
    v_invoice_id := old.invoice_id;
  else
    v_invoice_id := new.invoice_id;
  end if;

  perform public.reconcile_invoice_payment_summary(v_invoice_id);

  if tg_op = 'UPDATE'
     and old.invoice_id is distinct from new.invoice_id
     and old.invoice_id is not null then
    perform public.reconcile_invoice_payment_summary(old.invoice_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_payments_reconcile_after_change on public.invoice_payments;
create trigger invoice_payments_reconcile_after_change
after insert or update or delete on public.invoice_payments
for each row
execute function public.invoice_payments_reconcile_trigger();

revoke all on function public.reconcile_invoice_payment_summary(uuid) from public;
revoke all on function public.validate_invoice_payment_ownership() from public;
grant execute on function public.reconcile_invoice_payment_summary(uuid) to authenticated, service_role;

comment on function public.reconcile_invoice_payment_summary(uuid) is
  'Locks the invoice row and recomputes invoice/outbound summary fields from invoice_payments with rounded balances and explicit partial+overdue document status.';

comment on function public.validate_invoice_payment_ownership() is
  'Rejects invoice_payments rows whose organization_id does not match the invoice, or payment org moves.';
