import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { parseMoneyInput } from '@/lib/finance-format';
import { isValidUuid } from '@/lib/input-validation';
import {
  calculateBalanceDue,
  calculateInvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';

type RouteParams = { params: Promise<{ id: string }> };

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
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;
  if (body.status !== undefined) patch.status = String(body.status).trim();

  if (patch.amount !== undefined || patch.amount_paid !== undefined) {
    const { data: existing } = await ctx.supabase
      .from('invoices')
      .select('amount, amount_paid')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const amount = Number(patch.amount ?? existing.amount);
    const paid = Number(patch.amount_paid ?? existing.amount_paid);
    const paymentStatus = calculateInvoicePaymentStatus({
      amount,
      amount_paid: paid,
      due_date: typeof body.due_date === 'string' ? body.due_date : undefined
    });
    patch.payment_status = paymentStatus;
    patch.balance_due = calculateBalanceDue(amount, paid);
    if (!body.status) {
      patch.status =
        paymentStatus === 'paid' ? 'paid' : paymentStatus === 'partially_paid' ? 'partial' : paymentStatus === 'cancelled' ? 'cancelled' : 'sent';
    }
    patch.amount_paid = Math.min(paid, amount);
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
