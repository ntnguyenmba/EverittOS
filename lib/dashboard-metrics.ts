import type { SupabaseClient } from '@supabase/supabase-js';

export type DashboardRevenueMetrics = {
  revenueThisMonth: number;
  outstandingInvoices: number;
  jobsCompleted: number;
  activeCustomers: number;
};

function monthStartDateIso(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchDashboardRevenueMetrics(
  supabase: SupabaseClient,
  organizationId: string | null
): Promise<DashboardRevenueMetrics> {
  const monthStart = monthStartDateIso();
  const empty: DashboardRevenueMetrics = {
    revenueThisMonth: 0,
    outstandingInvoices: 0,
    jobsCompleted: 0,
    activeCustomers: 0
  };

  if (!organizationId) return empty;

  const [invoicesRes, completedJobsRes, customersRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount, amount_paid, invoice_date, created_at')
      .eq('organization_id', organizationId),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'completed'),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('pipeline_stage', 'archived')
  ]);

  const invoices = invoicesRes.data || [];
  const revenueThisMonth = invoices.reduce((sum, inv) => {
    const date = (inv.invoice_date as string | null) || (inv.created_at as string | null)?.slice(0, 10);
    if (!date || date < monthStart) return sum;
    const paid = num(inv.amount_paid);
    return sum + (paid > 0 ? paid : num(inv.amount));
  }, 0);

  const outstandingInvoices = invoices.reduce(
    (sum, inv) => sum + Math.max(0, num(inv.amount) - num(inv.amount_paid)),
    0
  );

  return {
    revenueThisMonth,
    outstandingInvoices,
    jobsCompleted: completedJobsRes.count || 0,
    activeCustomers: customersRes.count || 0
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}
