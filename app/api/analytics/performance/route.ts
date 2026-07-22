import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { fetchBusinessPerformance } from '@/lib/finance-server-canonical';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const performance = await fetchBusinessPerformance(ctx.supabase, ctx.organizationId);
  return NextResponse.json(performance);
}
