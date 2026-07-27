import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { fetchBusinessPerformance } from '@/lib/finance-server';
import { fetchDashboardRevenueMetrics } from '@/lib/dashboard-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const [performance, dashboardMetrics] = await Promise.all([
    fetchBusinessPerformance(ctx.supabase, ctx.organizationId),
    fetchDashboardRevenueMetrics(ctx.supabase, ctx.organizationId, 'month')
  ]);

  const contractorPaymentsThisMonth = dashboardMetrics.contractorPaymentsPaid || 0;
  const expensesThisMonth = dashboardMetrics.otherExpensesThisMonth || performance.expensesThisMonth || 0;
  const totalPaidCostsThisMonth = contractorPaymentsThisMonth + expensesThisMonth;
  const cashAfterPaidCosts = dashboardMetrics.cashAfterPaidCosts ?? performance.paymentsThisMonth - totalPaidCostsThisMonth;

  return NextResponse.json({
    ...performance,
    expensesThisMonth: Number(expensesThisMonth.toFixed(2)),
    contractorPaymentsThisMonth: Number(contractorPaymentsThisMonth.toFixed(2)),
    totalPaidCostsThisMonth: Number(totalPaidCostsThisMonth.toFixed(2)),
    cashAfterPaidCosts: Number(cashAfterPaidCosts.toFixed(2))
  });
}
