import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValidUuid } from '@/lib/input-validation';
import { runRecurringInvoiceTemplate } from '@/lib/recurring-invoice-run';
import type { RecurringInvoiceTemplate } from '@/lib/recurring-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { sendEmail?: boolean };
  const sendEmail = body.sendEmail === true;

  const { data: template, error: readError } = await ctx.supabase
    .from('recurring_invoice_templates')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }
  if (!template) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  }

  const result = await runRecurringInvoiceTemplate({
    supabase: ctx.supabase,
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    template: template as RecurringInvoiceTemplate,
    sendEmail
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    invoiceId: result.invoiceId,
    runId: result.runId,
    deliveryMode: result.deliveryMode,
    message: sendEmail
      ? 'Invoice generated and marked sent. Email delivery uses your outbound invoice flow when configured.'
      : 'Invoice generated as draft. Review it in your invoice list before sending.'
  });
}
