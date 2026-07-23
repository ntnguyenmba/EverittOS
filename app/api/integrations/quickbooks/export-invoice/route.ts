import { NextResponse } from 'next/server';
import { QuickBooksApiError, exportInvoiceToQuickBooks } from '@/lib/quickbooks';
import { quickbooksConfigured, quickbooksMissingCredentialsMessage } from '@/lib/quickbooks/config';
import { writeQuickBooksSyncLog } from '@/lib/quickbooks/logging';
import { isValidUuid } from '@/lib/input-validation';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { createAdminSupabase } from '@/lib/supabase-admin';

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
    .select('id')
    .eq('id', invoiceId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  if (!quickbooksConfigured()) {
    await writeQuickBooksSyncLog(ctx.supabase, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'export_invoice',
      status: 'failed',
      errorMessage: quickbooksMissingCredentialsMessage()
    });
    return NextResponse.json({ error: quickbooksMissingCredentialsMessage() }, { status: 503 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 503 });
  }

  try {
    const result = await exportInvoiceToQuickBooks({
      admin,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      invoiceId
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      updated: result.updated,
      externalId: result.externalId,
      customerExternalId: result.customerExternalId,
      message: result.created
        ? 'Invoice created in QuickBooks.'
        : 'Invoice updated in QuickBooks.'
    });
  } catch (error) {
    if (error instanceof QuickBooksApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.parsed.userMessage,
          reconnectRequired: error.parsed.reconnectRequired
        },
        { status: error.parsed.httpStatus >= 400 && error.parsed.httpStatus < 600 ? error.parsed.httpStatus : 400 }
      );
    }
    return NextResponse.json({ success: false, error: 'Invoice export failed.' }, { status: 500 });
  }
}
