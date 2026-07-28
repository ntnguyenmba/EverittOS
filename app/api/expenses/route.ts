import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/finance-types';
import { parseMoneyInput } from '@/lib/finance-format';
import { assertCustomerInOrganization, assertJobInOrganization } from '@/lib/org-resource-validation';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const category = url.searchParams.get('category');
  const jobId = url.searchParams.get('jobId');
  const customerId = url.searchParams.get('customerId');
  const workerId = url.searchParams.get('workerId');
  const search = String(url.searchParams.get('q') || '').trim();

  let query = ctx.supabase
    .from('expenses')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (category && isCategory(category)) query = query.eq('category', category);
  if (jobId) query = query.eq('job_id', jobId);
  if (customerId) query = query.eq('customer_id', customerId);
  if (workerId) query = query.eq('worker_id', workerId);
  if (search) {
    const escaped = search.replace(/[%_,]/g, '');
    if (escaped) {
      query = query.or(
        `vendor.ilike.%${escaped}%,description.ilike.%${escaped}%,notes.ilike.%${escaped}%`
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const expenses = await Promise.all(
    (data || []).map(async (row) => {
      if (!row.receipt_url || !admin) return row;
      const { data: signed } = await admin.storage
        .from('expense-receipts')
        .createSignedUrl(row.receipt_url, 3600);
      return { ...row, receipt_signed_url: signed?.signedUrl || null };
    })
  );

  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await request.json();
  const category = String(body.category || '').trim();
  if (!isCategory(category)) {
    return NextResponse.json({ error: 'Valid category is required' }, { status: 400 });
  }

  const amount = parseMoneyInput(body.amount);
  if (amount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
  }

  const date = String(body.date || '').trim() || new Date().toISOString().slice(0, 10);

  const jobError = await assertJobInOrganization(ctx.supabase, ctx.organizationId, body.job_id);
  if (jobError) {
    return NextResponse.json({ error: jobError }, { status: 400 });
  }
  const customerError = await assertCustomerInOrganization(ctx.supabase, ctx.organizationId, body.customer_id);
  if (customerError) {
    return NextResponse.json({ error: customerError }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('expenses')
    .insert({
      organization_id: ctx.organizationId,
      job_id: body.job_id || null,
      customer_id: body.customer_id || null,
      worker_id: body.worker_id || null,
      date,
      category,
      vendor: body.vendor?.trim() || null,
      description: body.description?.trim() || null,
      amount,
      payment_method: body.payment_method?.trim() || null,
      notes: body.notes?.trim() || null,
      created_by: ctx.userId,
      source: 'manual'
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message, 'Unable to save expense. Please try again.') }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.organizationId,
    ctx.userId,
    'expense',
    data.id,
    'expense_created',
    `Expense added: ${category} $${amount.toFixed(2)}`
  );

  return NextResponse.json({ expense: data, message: 'Expense saved successfully.' });
}
