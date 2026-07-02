import { NextResponse } from 'next/server';
import { quickbooksConfigured, quickbooksMissingCredentialsMessage } from '@/lib/quickbooks';
import { isValidUuid } from '@/lib/input-validation';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { invoice_id?: string };
  const invoiceId = body.invoice_id?.trim();
  if (!invoiceId || !isValidUuid(invoiceId)) {
    return NextResponse.json({ error: 'Valid invoice id is required.' }, { status: 400 });
  }

  const { data: invoice } = await ctx.supabase
    .from('invoices')
    .select('id, amount, status, description')
    .eq('id', invoiceId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const configured = quickbooksConfigured();
  const { data: connection } = await ctx.supabase
    .from('quickbooks_connections')
    .select('status')
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  let status = 'queued';
  let errorMessage: string | null = null;

  if (!configured) {
    status = 'failed';
    errorMessage = quickbooksMissingCredentialsMessage();
  } else if (!connection || connection.status !== 'connected') {
    status = 'failed';
    errorMessage = 'QuickBooks is not connected for this workspace.';
  }

  await ctx.supabase.from('quickbooks_sync_logs').insert({
    organization_id: ctx.organizationId,
    user_id: ctx.userId,
    entity_type: 'invoice',
    entity_id: invoiceId,
    action: 'export_invoice',
    direction: 'export',
    status,
    error_message: errorMessage
  });

  if (status === 'failed') {
    return NextResponse.json({ error: errorMessage }, { status: status === 'failed' && !configured ? 503 : 400 });
  }

  await ctx.supabase
    .from('quickbooks_connections')
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('organization_id', ctx.organizationId);

  return NextResponse.json({
    ok: true,
    message: 'Invoice export logged. Review sync history in Settings → Integrations. QuickBooks remains your accounting system of record.'
  });
}
