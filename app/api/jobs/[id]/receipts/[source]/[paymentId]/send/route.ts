import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValidUuid } from '@/lib/input-validation';
import { sendJobPaymentReceipt } from '@/lib/outbound/send-job-payment-receipt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string; source: string; paymentId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (!ctx.canManage) {
    return NextResponse.json({ error: 'You do not have permission to send receipts.' }, { status: 403 });
  }

  const { id: jobId, source, paymentId } = await context.params;
  if (!isValidUuid(jobId) || !isValidUuid(paymentId) || !['job', 'invoice'].includes(source)) {
    return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
  }

  const result = await sendJobPaymentReceipt({
    supabase: ctx.supabase,
    organizationId: ctx.organizationId,
    jobId,
    source: source as 'job' | 'invoice',
    paymentId
  });

  if (!result.sent) {
    return NextResponse.json(
      { error: result.error || 'Receipt email could not be sent.', recipientEmail: result.recipientEmail || null },
      { status: result.recipientEmail ? 502 : 400 }
    );
  }

  return NextResponse.json({ ok: true, sent: true, recipientEmail: result.recipientEmail });
}
