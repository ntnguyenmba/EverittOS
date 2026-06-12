import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { parseMoneyInput } from '@/lib/finance-format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const jobId = new URL(request.url).searchParams.get('jobId');
  let query = ctx.supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false });

  if (jobId) query = query.eq('job_id', jobId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invoices: data || [] });
}

export async function POST(request: Request) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Only managers can create invoices' }, { status: 403 });
  }

  const body = await request.json();
  const amount = parseMoneyInput(body.amount);
  if (amount <= 0) {
    return NextResponse.json({ error: 'Invoice amount must be greater than zero' }, { status: 400 });
  }

  const amountPaid = parseMoneyInput(body.amount_paid ?? body.amountPaid ?? 0);
  const status =
    amountPaid >= amount ? 'paid' : amountPaid > 0 ? 'partial' : String(body.status || 'sent').trim() || 'sent';

  const { data, error } = await ctx.supabase
    .from('invoices')
    .insert({
      organization_id: ctx.organizationId,
      job_id: body.job_id || null,
      customer_id: body.customer_id || null,
      user_id: ctx.userId,
      amount,
      amount_paid: Math.min(amountPaid, amount),
      status,
      due_date: body.due_date || null,
      invoice_date: body.invoice_date || new Date().toISOString().slice(0, 10),
      description: body.description?.trim() || null,
      notes: body.notes?.trim() || null
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invoice: data });
}
