import { NextResponse } from 'next/server';
import {
  fetchDashboardMetricDetails,
  isDashboardDetailMetric
} from '@/lib/dashboard-metric-details';
import {
  buildJobOperationalDateMap,
  inRange,
  num,
  rangeBounds,
  type DashboardDateRange
} from '@/lib/dashboard-metrics';
import { formatCurrency } from '@/lib/finance-format';
import { formatLaborPaymentLabel } from '@/lib/job-labor-basis';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';

const RANGES = new Set<DashboardDateRange>(['month', 'quarter', 'year', 'last_year', 'all_time']);

export async function GET(request: Request) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(request.url);
  const metricParam = url.searchParams.get('metric');
  const rangeParam = (url.searchParams.get('range') || 'month') as DashboardDateRange;
  const localeParam = url.searchParams.get('locale');

  if (!isDashboardDetailMetric(metricParam)) {
    return NextResponse.json({ error: 'Unknown dashboard metric.' }, { status: 400 });
  }

  const range = RANGES.has(rangeParam) ? rangeParam : 'month';

  try {
    const details = await fetchDashboardMetricDetails(
      ctx.supabase,
      ctx.organizationId,
      metricParam,
      range,
      localeParam
    );

    // Worker Pay must use the job's operational work date, matching the
    // dashboard finance calculations. Filtering job_labor.created_at here
    // can incorrectly show $0 when labor was entered on a different date.
    if (metricParam === 'contractor-pay') {
      const [{ data: labor }, { data: jobs }] = await Promise.all([
        ctx.supabase
          .from('job_labor')
          .select('id, job_id, worker_name, hours, hourly_cost, total_cost, payment_status, paid_at, created_at, payment_basis')
          .eq('organization_id', ctx.organizationId)
          .order('created_at', { ascending: false }),
        ctx.supabase
          .from('jobs')
          .select('id, status, completed_at, start_date, scheduled_start, created_at')
          .eq('organization_id', ctx.organizationId)
      ]);

      const { start, end } = rangeBounds(range);
      const jobDates = buildJobOperationalDateMap(jobs || []);
      const rows = (labor || []).filter((row) => {
        if (range === 'all_time') return true;
        const jobId = String(row.job_id || '');
        if (jobId) {
          const jobDate = jobDates.get(jobId);
          return Boolean(jobDate && inRange(jobDate, start, end));
        }
        return inRange(row.created_at, start, end);
      });
      const total = Number(rows.reduce((sum, row) => sum + num(row.total_cost), 0).toFixed(2));

      details.total = total;
      details.formula = 'Worker pay = labor costs for jobs worked in the selected period.';
      details.sections = [
        {
          id: 'contractor-pay',
          title: details.title,
          formula: 'Labor grouped by the job work date',
          total,
          totalLabel: formatCurrency(total),
          rows: rows.map((row) => ({
            id: String(row.id),
            title: row.worker_name || 'Worker',
            subtitle: [
              formatLaborPaymentLabel({
                paymentBasis: row.payment_basis,
                quantity: row.hours,
                rate: row.hourly_cost,
                total: row.total_cost
              }),
              row.payment_status || 'unpaid'
            ].join(' · '),
            amount: num(row.total_cost),
            amountLabel: formatCurrency(num(row.total_cost)),
            href: row.job_id ? `/jobs/${row.job_id}` : '/contractor-pay',
            badge: String(row.payment_status || 'unpaid')
          }))
        }
      ];
    }

    return NextResponse.json({ details });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load metric details.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
