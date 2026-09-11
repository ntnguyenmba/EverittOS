'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MetricCard } from '@/components/metric-card';
import { SimpleBarChart, SimpleTrendChart } from '@/components/charts/simple-bar-chart';
import { useTranslation } from '@/components/locale-provider';
import { formatCurrency } from '@/lib/finance-format';
import type { BusinessPerformanceSummary } from '@/lib/finance-types';

type RangeKey = 'month' | '90d' | 'year' | 'all_time';
type PerformerData = {
  completedJobs: number;
  topCustomer: { name: string; revenue: number; profit: number; jobs: number } | null;
  topCleaner: { name: string; revenue: number; pay: number; profit: number; jobs: number } | null;
  mostProfitableCustomer: { name: string; revenue: number; profit: number; jobs: number } | null;
  mostProfitableService: { name: string; revenue: number; profit: number; jobs: number } | null;
  averageJobValue: number;
  averageProfitPerJob: number;
};

const copy = {
  en: { cashAfterPaidCosts: 'Cash after paid costs' },
  es: { cashAfterPaidCosts: 'Efectivo después de costos pagados' },
  vi: { cashAfterPaidCosts: 'Tiền mặt sau chi phí đã trả' }
} as const;

const ranges: { key: RangeKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
  { key: 'all_time', label: 'All time' }
];

export function BusinessPerformanceSection() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const [data, setData] = useState<BusinessPerformanceSummary | null>(null);
  const [performers, setPerformers] = useState<PerformerData | null>(null);
  const [range, setRange] = useState<RangeKey>('month');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [performersLoading, setPerformersLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/analytics/performance');
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(json.error || 'Unable to load business performance.');
        return;
      }
      setData(json);
    }
    void load();
  }, []);

  useEffect(() => {
    async function loadPerformers() {
      setPerformersLoading(true);
      const res = await fetch(`/api/analytics/top-performers?range=${range}`, { cache: 'no-store' });
      const json = await res.json();
      setPerformersLoading(false);
      if (!res.ok) {
        setError(json.error || 'Unable to load performance metrics.');
        return;
      }
      setPerformers(json);
    }
    void loadPerformers();
  }, [range]);

  if (loading) return <p className="loading-state">Loading business performance...</p>;
  if (error && !data) return <p className="auth-message auth-message-error">{error}</p>;
  if (!data) return null;

  const hasCharts =
    data.revenueByMonth.some((p) => p.value > 0) ||
    data.revenueByCustomer.length > 0 ||
    data.expensesByCategory.length > 0;
  const cashAfterExpenses =
    typeof data.cashAfterPaidCosts === 'number'
      ? data.cashAfterPaidCosts
      : data.paymentsThisMonth - data.expensesThisMonth;

  return (
    <section className="finance-performance-section">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <h2>Business performance</h2>
          <p className="muted">Revenue, expenses, cash, customers, and cleaner performance.</p>
        </div>
        <Link className="btn" href="/expenses">View expenses</Link>
      </div>

      <div className="finance-summary-grid">
        <MetricCard label="Revenue this month" value={formatCurrency(data.revenueThisMonth)} loading={loading} />
        <MetricCard label="Payments received" value={formatCurrency(data.paymentsThisMonth)} loading={loading} />
        <MetricCard label="Outstanding invoices" value={formatCurrency(data.outstandingInvoices)} loading={loading} />
        <MetricCard label="Expenses this month" value={formatCurrency(data.expensesThisMonth)} loading={loading} />
        <MetricCard
          label={c.cashAfterPaidCosts}
          value={formatCurrency(cashAfterExpenses)}
          hint="Payments received minus contractor payments and expenses this month"
          loading={loading}
        />
        <MetricCard
          label="Most profitable job"
          value={data.mostProfitableJob ? data.mostProfitableJob.title : 'None yet'}
          hint={data.mostProfitableJob ? formatCurrency(data.mostProfitableJob.profit) : undefined}
          href={data.mostProfitableJob ? `/jobs/${data.mostProfitableJob.id}` : undefined}
          loading={loading}
        />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="page-head" style={{ marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>Top performers</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>Completed jobs in the selected period.</p>
          </div>
          <label>
            <span className="sr-only">Performance period</span>
            <select value={range} onChange={(event) => setRange(event.target.value as RangeKey)}>
              {ranges.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
        </div>

        {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        <div className="finance-summary-grid">
          <MetricCard
            label="Top customer"
            value={performers?.topCustomer?.name || 'None yet'}
            hint={performers?.topCustomer ? `${formatCurrency(performers.topCustomer.revenue)} · ${performers.topCustomer.jobs} jobs` : undefined}
            loading={performersLoading}
          />
          <MetricCard
            label="Top cleaner"
            value={performers?.topCleaner?.name || 'None yet'}
            hint={performers?.topCleaner ? `${performers.topCleaner.jobs} jobs · ${formatCurrency(performers.topCleaner.pay)} pay · ${formatCurrency(performers.topCleaner.profit)} profit` : undefined}
            loading={performersLoading}
          />
          <MetricCard
            label="Most profitable customer"
            value={performers?.mostProfitableCustomer?.name || 'None yet'}
            hint={performers?.mostProfitableCustomer ? formatCurrency(performers.mostProfitableCustomer.profit) : undefined}
            loading={performersLoading}
          />
          <MetricCard
            label="Most profitable service"
            value={performers?.mostProfitableService?.name || 'None yet'}
            hint={performers?.mostProfitableService ? `${formatCurrency(performers.mostProfitableService.profit)} · ${performers.mostProfitableService.jobs} jobs` : undefined}
            loading={performersLoading}
          />
          <MetricCard label="Average job value" value={formatCurrency(performers?.averageJobValue || 0)} loading={performersLoading} />
          <MetricCard label="Average profit per job" value={formatCurrency(performers?.averageProfitPerJob || 0)} loading={performersLoading} />
        </div>
      </div>

      {!hasCharts ? (
        <div className="card finance-empty-block">
          <p>No financial data yet.</p>
          <Link className="btn btn-primary" href="/expenses">Add your first expense</Link>
        </div>
      ) : (
        <div className="charts-grid">
          <SimpleTrendChart title="Revenue by month" points={data.revenueByMonth} />
          <SimpleBarChart title="Revenue by customer" points={data.revenueByCustomer} valuePrefix="$" />
          <SimpleBarChart title="Revenue by team member" points={data.revenueByWorker} valuePrefix="$" />
          <SimpleBarChart title="Expenses by category" points={data.expensesByCategory} valuePrefix="$" />
          <SimpleBarChart title="Profit by job" points={data.profitByJob} valuePrefix="$" />
        </div>
      )}
    </section>
  );
}
