-- Allow authorized staff to correct invoice payment ledger entries while keeping
-- invoice and outbound document summary fields synchronized automatically.

alter table public.invoice_payments
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_invoice_payment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoice_payments_set_updated_at on public.invoice_payments;
create trigger invoice_payments_set_updated_at
before update on public.invoice_payments
for each row
execute function public.set_invoice_payment_updated_at();

-- Owners, administrators, and managers may correct or remove payment entries.
-- Organization membership and invoice ownership cannot be moved during an edit.
drop policy if exists invoice_payments_update_member on public.invoice_payments;
create policy invoice_payments_update_member
  on public.invoice_payments
  for update
  to authenticated
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager')
    )
  )
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager')
    )
  );

drop policy if exists invoice_payments_delete_member on public.invoice_payments;
create policy invoice_payments_delete_member
  on public.invoice_payments
  for delete
  to authenticated
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager')
    )
  );

-- Recompute invoice and outbound summary fields from the payment ledger.
create or replace function public.reconcile_invoice_payment_summary(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_amount numeric;
  v_due_date date;
  v_status text;
  v_payment_status text;
  v_paid numeric;
  v_last_paid_at timestamptz;
  v_method text;
  v_reference text;
  v_balance numeric;
  v_next_status text;
  v_next_payment_status text;
  v_paid_at timestamptz;
begin
  if p_invoice_id is null then
    return;
  end if;

  select
    i.organization_id,
    greatest(coalesce(i.amount, 0), 0),
    i.due_date,
    coalesce(i.status, ''),
    coalesce(i.payment_status, '')
  into v_org, v_amount, v_due_date, v_status, v_payment_status
  from public.invoices i
  where i.id = p_invoice_id;

  if v_org is null then
    return;
  end if;

  -- Preserve cancelled invoices; do not rewrite payment status from the ledger.
  if lower(v_payment_status) in ('cancelled', 'canceled')
     or lower(v_status) in ('cancelled', 'canceled') then
    return;
  end if;

  select
    coalesce(sum(p.amount), 0),
    max(p.paid_at),
    (array_agg(p.payment_method order by p.paid_at desc nulls last))[1],
    (array_agg(p.payment_reference order by p.paid_at desc nulls last))[1]
  into v_paid, v_last_paid_at, v_method, v_reference
  from public.invoice_payments p
  where p.invoice_id = p_invoice_id
    and p.organization_id = v_org;

  v_paid := greatest(coalesce(v_paid, 0), 0);
  v_balance := greatest(v_amount - v_paid, 0);

  if v_paid <= 0 then
    v_next_payment_status := 'unpaid';
    v_next_status := case when lower(v_status) = 'paid' then 'sent' else coalesce(nullif(v_status, ''), 'sent') end;
    v_paid_at := null;
  elsif v_amount > 0 and v_paid + 0.009 >= v_amount then
    v_next_payment_status := 'paid';
    v_next_status := 'paid';
    v_paid_at := v_last_paid_at;
  elsif v_due_date is not null and v_due_date < current_date then
    v_next_payment_status := 'overdue';
    v_next_status := case when lower(v_status) in ('paid', 'partial') then 'partial' else coalesce(nullif(v_status, ''), 'sent') end;
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
    payment_method = coalesce(v_method, payment_method),
    payment_reference = coalesce(v_reference, payment_reference),
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
    payment_method = coalesce(v_method, payment_method),
    payment_reference = coalesce(v_reference, payment_reference),
    updated_at = now()
  where organization_id = v_org
    and doc_type = 'invoice'
    and source_entity_id = p_invoice_id
    and lower(coalesce(payment_status, status, '')) not in ('cancelled', 'canceled');
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
grant execute on function public.reconcile_invoice_payment_summary(uuid) to authenticated, service_role;

comment on function public.reconcile_invoice_payment_summary(uuid) is
  'Recomputes invoice and outbound invoice summary fields from invoice_payments ledger totals.';
