import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { parseMoneyInput } from '@/lib/finance-format';
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
  if (body.amount_paid !== undefined || body.amountPaid !== undefined) {
    patch.amount_paid = parseMoneyInput(body.amount_paid ?? body.amountPaid);
  }
  if (body.due_date !== undefined) patch.due_date = body.due_date || null;
  if (body.invoice_date !== undefined) patch.invoice_date = body.invoice_date || null;
  if (body.paid_at !== undefined || body.paidAt !== undefined || body.paid_date !== undefined) {
    const paidAt = normalizePaymentDate(body.paid_at ?? body.paidAt ?? body.paid_date);
    if ((body.paid_at ?? body.paidAt ?? body.paid_date) && !paidAt) {
      return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 });
    }
    patch.paid_at = paidAt;
  }
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;
  if (body.status !== undefined) patch.status = String(body.status).trim();
  if (body.payment_method !== undefined) patch.payment_method = body.payment_method?.trim() || null;
  if (body.payment_reference !== undefined) patch.payment_reference = body.payment_reference?.trim() || null;
  if (body.payment_notes !== undefined) patch.payment_notes = body.payment_notes?.trim() || null;

  if (patch.amount !== undefined || patch.amount_paid !== undefined || patch.due_date !== undefined) {
    const { data: existing } = await ctx.supabase
      .from('invoices')
      .select('amount, amount_paid, due_date, paid_at')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const amount = Number(patch.amount ?? existing.amount);
    const previousPaid = Number(existing.amount_paid || 0);
    const paid = Number(patch.amount_paid ?? previousPaid);
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

    if (cappedPaid > previousPaid) {
      patch.last_payment_at = normalizePaymentDate(body.last_payment_at ?? body.lastPaymentAt) || new Date().toISOString();
    }

    if (paymentStatus === 'paid' && patch.paid_at === undefined && !existing.paid_at) {
      patch.paid_at = normalizePaymentDate(body.last_payment_at ?? body.lastPaymentAt) || new Date().toISOString();
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
