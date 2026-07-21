import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { parseMoneyInput } from '@/lib/finance-format';
import { reconcileInvoiceFromLedger } from '@/lib/finance/edit-invoice-payment';
import { recordInvoicePaymentByInvoiceId } from '@/lib/finance/record-invoice-payment';
import { isValidUuid } from '@/lib/input-validation';
import {
  calculateBalanceDue,
  calculateInvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';

type RouteParams = { params: Promise<{ id: string }> };

function normalizePaymentDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Invoice field updates.
 * Increasing amount_paid is converted into the canonical payment recorder
 * so every payment creates a ledger row and updates all dashboards.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Only managers can update invoices' }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
  }

  const body = await request.json();
  const patch: Record<string, unknown> = {};

  if (body.amount !== undefined) patch.amount = parseMoneyInput(body.amount);
  if (body.due_date !== undefined) patch.due_date = body.due_date || null;
  if (body.invoice_date !== undefined) patch.invoice_date = body.invoice_date || null;
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;
  if (body.status !== undefined) patch.status = String(body.status).trim();
  if (body.payment_method !== undefined) patch.payment_method = body.payment_method?.trim() || null;
  if (body.payment_reference !== undefined) patch.payment_reference = body.payment_reference?.trim() || null;
  if (body.payment_notes !== undefined) patch.payment_notes = body.payment_notes?.trim() || null;
  if (body.paid_at !== undefined || body.paidAt !== undefined || body.paid_date !== undefined) {
    const paidAt = normalizePaymentDate(body.paid_at ?? body.paidAt ?? body.paid_date);
    if ((body.paid_at ?? body.paidAt ?? body.paid_date) && !paidAt) {
      return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 });
    }
    patch.paid_at = paidAt;
  }

  const amountPaidProvided = body.amount_paid !== undefined || body.amountPaid !== undefined;
  const requestedPaid = amountPaidProvided
    ? parseMoneyInput(body.amount_paid ?? body.amountPaid)
    : null;

  const { data: existing } = await ctx.supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Canonical payment path: amount_paid increases become ledger payments.
  if (requestedPaid !== null) {
    const previousPaid = Math.max(0, Number(existing.amount_paid || 0));
    const nextPaid = Math.max(0, Number(requestedPaid));
    if (nextPaid > previousPaid) {
      const paidDateRaw = body.paid_at ?? body.paidAt ?? body.paid_date ?? body.last_payment_at;
      const paidDate =
        typeof paidDateRaw === 'string' && paidDateRaw
          ? String(paidDateRaw).slice(0, 10)
          : new Date().toISOString().slice(0, 10);

      const paymentResult = await recordInvoicePaymentByInvoiceId(ctx.supabase, id, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        amount: nextPaid - previousPaid,
        paidDate,
        paymentMethod: body.payment_method ?? existing.payment_method,
        paymentReference: body.payment_reference ?? existing.payment_reference,
        paymentNotes: body.payment_notes || 'Recorded via invoice update'
      });

      if (!paymentResult.ok) {
        return NextResponse.json({ error: paymentResult.error }, { status: paymentResult.status });
      }

      // Apply any remaining non-payment field updates.
      const remainingKeys = Object.keys(patch).filter(
        (key) =>
          !['amount_paid', 'balance_due', 'payment_status', 'paid_at', 'last_payment_at', 'status'].includes(
            key
          )
      );
      if (remainingKeys.length === 0) {
        return NextResponse.json({ invoice: paymentResult.invoice });
      }

      const remainingPatch: Record<string, unknown> = {};
      for (const key of remainingKeys) remainingPatch[key] = patch[key];
      const { data, error } = await ctx.supabase
        .from('invoices')
        .update(remainingPatch)
        .eq('id', id)
        .eq('organization_id', ctx.organizationId)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ invoice: data });
    }

    if (nextPaid < previousPaid) {
      return NextResponse.json(
        {
          error:
            'To reduce the paid amount, edit or remove payment records from the job payment history.'
        },
        { status: 400 }
      );
    }

    // Same value: refresh summaries from the ledger so dashboards stay accurate.
    if (nextPaid === previousPaid) {
      const reconciled = await reconcileInvoiceFromLedger(ctx.supabase, ctx.organizationId, id);
      return NextResponse.json({ invoice: reconciled.invoice });
    }
  }

  if (patch.amount !== undefined || patch.amount_paid !== undefined || patch.due_date !== undefined) {
    const amount = Number(patch.amount ?? existing.amount);
    const paid = Number(patch.amount_paid ?? existing.amount_paid ?? 0);
    const dueDate = patch.due_date !== undefined ? (patch.due_date as string | null) : existing.due_date;

    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(paid) || paid < 0) {
      return NextResponse.json({ error: 'Invoice amounts must be valid non-negative numbers' }, { status: 400 });
    }

    const cappedPaid = Math.min(paid, amount);
    const paymentStatus = calculateInvoicePaymentStatus({
      amount,
      amount_paid: cappedPaid,
      due_date: dueDate
    });

    patch.amount_paid = cappedPaid;
    patch.payment_status = paymentStatus;
    patch.balance_due = calculateBalanceDue(amount, cappedPaid);

    if (!body.status) {
      patch.status =
        paymentStatus === 'paid'
          ? 'paid'
          : paymentStatus === 'partially_paid'
            ? 'partial'
            : paymentStatus === 'cancelled'
              ? 'cancelled'
              : 'sent';
    }

    if (paymentStatus === 'paid' && patch.paid_at === undefined && !existing.paid_at) {
      patch.paid_at = new Date().toISOString();
    }

    if (paymentStatus !== 'paid' && patch.paid_at === undefined && existing.paid_at && cappedPaid < amount) {
      patch.paid_at = null;
    }
  }

  const { data, error } = await ctx.supabase
    .from('invoices')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invoice: data });
}
