import { NextResponse } from 'next/server';
import { normalizeRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OwnerFinancialRow = {
  id: string;
  revenue_amount: number | null;
  expected_contractor_cost: number | null;
  expected_additional_expense: number | null;
};

export async function GET(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  if (normalizeRole(ctx.workspace.role) !== 'owner') {
    return NextResponse.json({ error: 'Owner access required.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const ids = Array.from(
    new Set(
      (url.searchParams.get('ids') || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, 250);

  if (!ids.length) {
    return NextResponse.json({ financials: {} });
  }

  let query = ctx.supabase
    .from('jobs')
    .select('id, revenue_amount, expected_contractor_cost, expected_additional_expense')
    .in('id', ids);

  if (ctx.workspace.organizationId) {
    query = query.eq('organization_id', ctx.workspace.organizationId);
  } else {
    query = query.eq('user_id', ctx.userId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Unable to load owner financials.' }, { status: 500 });
  }

  const financials = Object.fromEntries(
    ((data || []) as OwnerFinancialRow[]).map((row) => {
      const customerPay = Number(row.revenue_amount || 0);
      const contractorPay = Number(row.expected_contractor_cost || 0);
      const additionalExpense = Number(row.expected_additional_expense || 0);
      return [
        row.id,
        {
          customerPay,
          contractorPay,
          ownerProfit: customerPay - contractorPay - additionalExpense
        }
      ];
    })
  );

  return NextResponse.json({ financials });
}
