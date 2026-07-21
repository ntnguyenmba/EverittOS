import { NextResponse } from 'next/server';
import {
  fetchDashboardMetricDetails,
  isDashboardDetailMetric
} from '@/lib/dashboard-metric-details';
import type { DashboardDateRange } from '@/lib/dashboard-metrics';
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
    return NextResponse.json({ details });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load metric details.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
