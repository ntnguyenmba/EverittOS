import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { parseMoneyInput } from '@/lib/finance-format';
import { assertCustomerInOrganization, assertJobInOrganization } from '@/lib/org-resource-validation';
import {
  isMissingSchemaError,
  SCHEMA_SETUP_HINT,
  schemaEmptyPayload
} from '@/lib/supabase-schema-errors';

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
    if (isMissingSchemaError(error)) {
      return NextResponse.json(schemaEmptyPayload('invoices', { setupHint: SCHEMA_SETUP_HINT }));
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invoices: data || [], schemaReady: true });
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

  const jobError = await assertJobInOrganization(ctx.supabase, ctx.organizationId, body.job_id);
  if (jobError) {
    return NextResponse.json({ error: jobError }, { status: 400 });
  }
  const customerError = await assertCustomerInOrganization(ctx.supabase, ctx.organizationId, body.customer_id);
  if (customerError) {
    return NextResponse.json({ error: customerError }, { status: 400 });
  }

  const { data: profile } = await ctx.supabase.from('profiles').select('locale').eq('id', ctx.userId).maybeSingle();
  const documentLocale =
    body.document_locale === 'es' || body.document_locale === 'vi' || body.document_locale === 'en'
      ? body.document_locale
      : profile?.locale === 'es' || profile?.locale === 'vi'
        ? profile.locale
        : 'en';

  const insertPayload: Record<string, unknown> = {
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
    notes: body.notes?.trim() || null,
    document_locale: documentLocale
  };

  let result = await ctx.supabase.from('invoices').insert(insertPayload).select('*').single();

  if (result.error && /document_locale/i.test(result.error.message || '')) {
    delete insertPayload.document_locale;
    result = await ctx.supabase.from('invoices').insert(insertPayload).select('*').single();
  }

  const { data, error } = result;

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: SCHEMA_SETUP_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    entityType: 'invoice',
    entityId: data.id,
    action: status === 'paid' ? 'invoice_paid' : 'invoice_created',
    message: status === 'paid' ? 'Invoice paid' : 'Invoice sent'
  });

  return NextResponse.json({ invoice: data });
}
