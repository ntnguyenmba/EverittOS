'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MetricCard } from '@/components/metric-card';
import { SimpleBarChart, SimpleTrendChart } from '@/components/charts/simple-bar-chart';
import { formatCurrency } from '@/lib/finance-format';
import type { BusinessPerformanceSummary } from '@/lib/finance-types';

export function BusinessPerformanceSection() {
  const [data, setData] = useState<BusinessPerformanceSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <p className="loading-state">Loading business performance...</p>;
  }

  if (error) {
    return <p className="auth-message auth-message-error">{error}</p>;
  }

  if (!data) return null;

  const hasCharts =
    data.revenueByMonth.some((p) => p.value > 0) ||
    data.revenueByCustomer.length > 0 ||
    data.expensesByCategory.length > 0;
  // Prefer shared dashboard cash definition: payments − contractor cash paid − expenses.
  const cashAfterExpenses =
    typeof data.cashAfterPaidCosts === 'number'
      ? data.cashAfterPaidCosts
      : data.paymentsThisMonth - data.expensesThisMonth;

  return (
    <section className="finance-performance-section">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <h2>Business performance</h2>
          <p className="muted">Revenue, expenses, and cash tracking. Simple tracking, not full bookkeeping.</p>
        </div>
        <Link className="btn" href="/expenses">
          View expenses
        </Link>
      </div>

      <div className="finance-summary-grid">
        <MetricCard label="Revenue this month" value={formatCurrency(data.revenueThisMonth)} loading={loading} />
        <MetricCard label="Payments received" value={formatCurrency(data.paymentsThisMonth)} loading={loading} />
        <MetricCard label="Outstanding invoices" value={formatCurrency(data.outstandingInvoices)} loading={loading} />
        <MetricCard label="Expenses this month" value={formatCurrency(data.expensesThisMonth)} loading={loading} />
        <MetricCard
          label="Cash after paid costs"
          value={formatCurrency(cashAfterExpenses)}
          hint="Payments received minus contractor payments and expenses this month"
          loading={loading}
        />
        <MetricCard
          label="Top customer"
          value={data.topCustomer ? data.topCustomer.name : 'None yet'}
          hint={data.topCustomer ? formatCurrency(data.topCustomer.revenue) : undefined}
          loading={loading}
        />
        <MetricCard
          label="Top team member"
          value={data.topWorker ? data.topWorker.name : 'None yet'}
          hint={data.topWorker ? formatCurrency(data.topWorker.revenue) : undefined}
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

      {!hasCharts ? (
        <div className="card finance-empty-block">
          <p>No financial data yet.</p>
          <Link className="btn btn-primary" href="/expenses">
            Add your first expense
          </Link>
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
