import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/finance-types';
import { parseMoneyInput } from '@/lib/finance-format';
import { isValidUuid } from '@/lib/input-validation';
import { createAdminSupabase } from '@/lib/supabase-admin';

type RouteParams = { params: Promise<{ id: string }> };

function isCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

async function getExpense(ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>, id: string) {
  if (!ctx.ok) return null;
  const { data } = await ctx.supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  return data;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid expense id' }, { status: 400 });
  }

  const existing = await getExpense(ctx, id);
  if (!existing) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  const body = await request.json();
  const patch: Record<string, unknown> = {};

  if (body.date !== undefined) patch.date = String(body.date).trim();
  if (body.category !== undefined) {
    const category = String(body.category).trim();
    if (!isCategory(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    patch.category = category;
  }
  if (body.vendor !== undefined) patch.vendor = body.vendor?.trim() || null;
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.amount !== undefined) {
    const amount = parseMoneyInput(body.amount);
    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }
    patch.amount = amount;
  }
  if (body.payment_method !== undefined) patch.payment_method = body.payment_method?.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;
  if (body.job_id !== undefined) patch.job_id = body.job_id || null;
  if (body.customer_id !== undefined) patch.customer_id = body.customer_id || null;
  if (body.worker_id !== undefined) patch.worker_id = body.worker_id || null;

  const { data, error } = await ctx.supabase
    .from('expenses')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ expense: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid expense id' }, { status: 400 });
  }

  const existing = await getExpense(ctx, id);
  if (!existing) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  const admin = createAdminSupabase();
  if (existing.receipt_url && admin) {
    await admin.storage.from('expense-receipts').remove([existing.receipt_url]);
  }

  const { error } = await ctx.supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
