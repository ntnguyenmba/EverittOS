import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { processDueRecurringTemplates } from '@/lib/recurring-invoice-run';

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

  const body = (await request.json().catch(() => ({}))) as { asOfDate?: string };
  const result = await processDueRecurringTemplates({
    supabase: ctx.supabase,
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    asOfDate: body.asOfDate
  });

  return NextResponse.json({
    processed: result.processed,
    errors: result.errors,
    message:
      result.processed > 0
        ? `Generated ${result.processed} draft invoice${result.processed === 1 ? '' : 's'} from due templates.`
        : 'No due recurring templates found.'
  });
}
