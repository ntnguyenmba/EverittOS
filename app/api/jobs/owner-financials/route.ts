import { NextResponse } from 'next/server';
import { effectiveContractorCost } from '@/lib/finance/contractor-cost';
import { canonicalExpectedJobRevenue } from '@/lib/finance-server';
import { ownerProfitFromAmounts, parseOwnerMoney } from '@/lib/jobs-owner-financials';
import { normalizeRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OwnerFinancialRow = {
  id: string;
  property_id: string | null;
  revenue_amount: number | null;
  expected_contractor_cost: number | null;
  expected_additional_expense: number | null;
};

type InvoiceRow = {
  job_id: string | null;
  amount: number | null;
  amount_paid: number | null;
};

type AmountRow = {
  job_id: string | null;
  amount?: number | null;
  total_cost?: number | null;
};

function addAmount(map: Map<string, number>, jobId: string | null, value: unknown) {
  if (!jobId) return;
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return;
  map.set(jobId, Number(((map.get(jobId) || 0) + amount).toFixed(2)));
}

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

  let jobsQuery = ctx.supabase
    .from('jobs')
    .select('id, property_id, revenue_amount, expected_contractor_cost, expected_additional_expense')
    .in('id', ids);

  if (ctx.workspace.organizationId) {
    jobsQuery = jobsQuery.eq('organization_id', ctx.workspace.organizationId);
  } else {
    jobsQuery = jobsQuery.eq('user_id', ctx.userId);
  }

  const organizationId = ctx.workspace.organizationId;
  const [jobsRes, invoicesRes, laborRes, paymentsRes, expensesRes] = await Promise.all([
    jobsQuery,
    organizationId
      ? ctx.supabase.from('invoices').select('job_id, amount, amount_paid').eq('organization_id', organizationId).in('job_id', ids)
      : Promise.resolve({ data: [], error: null }),
    organizationId
      ? ctx.supabase.from('job_labor').select('job_id, total_cost').eq('organization_id', organizationId).in('job_id', ids)
      : Promise.resolve({ data: [], error: null }),
    organizationId
      ? ctx.supabase.from('job_payments').select('job_id, amount').eq('organization_id', organizationId).in('job_id', ids)
      : Promise.resolve({ data: [], error: null }),
    organizationId
      ? ctx.supabase.from('expenses').select('job_id, amount').eq('organization_id', organizationId).in('job_id', ids)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (jobsRes.error) {
    return NextResponse.json({ error: 'Unable to load owner financials.' }, { status: 500 });
  }

  const invoiceByJob = new Map<string, { amount: number; amountPaid: number }>();
  for (const row of (invoicesRes.data || []) as InvoiceRow[]) {
    if (!row.job_id) continue;
    const current = invoiceByJob.get(row.job_id) || { amount: 0, amountPaid: 0 };
    current.amount += Number(row.amount || 0);
    current.amountPaid += Number(row.amount_paid || 0);
    invoiceByJob.set(row.job_id, current);
  }

  const laborByJob = new Map<string, number>();
  for (const row of (laborRes.data || []) as AmountRow[]) addAmount(laborByJob, row.job_id, row.total_cost);

  const directPaymentsByJob = new Map<string, number>();
  for (const row of (paymentsRes.data || []) as AmountRow[]) addAmount(directPaymentsByJob, row.job_id, row.amount);

  const expensesByJob = new Map<string, number>();
  for (const row of (expensesRes.data || []) as AmountRow[]) addAmount(expensesByJob, row.job_id, row.amount);

  const financials = Object.fromEntries(
    ((jobsRes.data || []) as OwnerFinancialRow[]).map((row) => {
      const invoice = invoiceByJob.get(row.id);
      const directPayments = directPaymentsByJob.get(row.id) || 0;
      const confirmedPayments = Number(((invoice?.amountPaid || 0) + directPayments).toFixed(2));
      const configuredCustomerPay = parseOwnerMoney(row.revenue_amount);
      const customerPayValue = canonicalExpectedJobRevenue({
        quotedRevenue: configuredCustomerPay,
        invoiceTotal: invoice?.amount || 0,
        confirmedPayments
      });
      const hasCustomerPay = configuredCustomerPay != null || Boolean(invoice) || directPayments > 0;
      const customerPay = hasCustomerPay ? customerPayValue : null;

      const expectedContractorPay = parseOwnerMoney(row.expected_contractor_cost);
      const recordedLabor = laborByJob.get(row.id) || 0;
      const contractorPayValue = effectiveContractorCost(expectedContractorPay, recordedLabor);
      const hasContractorPay = expectedContractorPay != null || recordedLabor > 0;
      const contractorPay = hasContractorPay ? contractorPayValue : null;

      const plannedExpense = parseOwnerMoney(row.expected_additional_expense);
      const actualExpenses = expensesByJob.get(row.id) || 0;
      const additionalExpense = actualExpenses > 0 ? actualExpenses : plannedExpense;

      return [
        row.id,
        {
          customerPay,
          contractorPay,
          ownerProfit: ownerProfitFromAmounts(customerPay, contractorPay, additionalExpense)
        }
      ];
    })
  );

  return NextResponse.json({ financials });
}
