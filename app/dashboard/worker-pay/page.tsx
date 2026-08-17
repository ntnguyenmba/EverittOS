'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import {
  calculateContractorCashPaid,
  filterValidJobsInPeriod,
  formatCurrency,
  inRange,
  num,
  rangeBounds,
  type DashboardDateRange,
  type DashboardJobFinanceRow,
  type LaborCostRow
} from '@/lib/dashboard-metrics';
import { canAccessFinancials } from '@/lib/finance-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

const RANGE_STORAGE_KEY = 'everittos-dashboard-range';
const VALID_RANGES: DashboardDateRange[] = ['today', 'week', 'month', 'year', 'all_time'];

type LaborRow = LaborCostRow & {
  id?: string | null;
  worker_name?: string | null;
  hours?: number | string | null;
  hourly_cost?: number | string | null;
};

type JobRow = DashboardJobFinanceRow & {
  id?: string | null;
  title?: string | null;
  customer_name?: string | null;
};

type CostRow = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  href: string;
};

const copy = {
  en: {
    title: 'Worker pay',
    subtitle: 'See worker costs and payments behind the owner dashboard numbers.',
    period: 'Period',
    today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', allTime: 'All Time',
    workerCosts: 'Worker Costs', workersPaid: 'Workers paid',
    workerCostsHelp: 'Worker cost tied to jobs in this period, whether paid yet or not.',
    workersPaidHelp: 'Worker payments actually paid in this period.',
    costDetails: 'Worker cost details', paidDetails: 'Paid worker details',
    noCosts: 'No worker costs in this period.', noPaid: 'No worker payments in this period.',
    planned: 'Planned worker cost', recorded: 'Recorded labor', paid: 'Paid',
    permission: 'You do not have access to financial details.', loading: 'Loading…'
  },
  es: {
    title: 'Pago de trabajadores',
    subtitle: 'Consulta los costos y pagos de trabajadores detrás de los números del panel del propietario.',
    period: 'Período',
    today: 'Hoy', week: 'Esta semana', month: 'Este mes', year: 'Este año', allTime: 'Todo el tiempo',
    workerCosts: 'Costos de trabajadores', workersPaid: 'Trabajadores pagados',
    workerCostsHelp: 'Costo de trabajadores vinculado a trabajos en este período, esté pagado o no.',
    workersPaidHelp: 'Pagos a trabajadores realmente pagados en este período.',
    costDetails: 'Detalle de costos de trabajadores', paidDetails: 'Detalle de trabajadores pagados',
    noCosts: 'No hay costos de trabajadores en este período.', noPaid: 'No hay pagos a trabajadores en este período.',
    planned: 'Costo de trabajador planificado', recorded: 'Trabajo registrado', paid: 'Pagado',
    permission: 'No tienes acceso a los detalles financieros.', loading: 'Cargando…'
  },
  vi: {
    title: 'Tiền công nhân sự',
    subtitle: 'Xem chi phí và khoản đã trả cho nhân sự đứng sau các số trên bảng điều khiển chủ doanh nghiệp.',
    period: 'Khoảng thời gian',
    today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', year: 'Năm nay', allTime: 'Tất cả thời gian',
    workerCosts: 'Chi phí nhân sự', workersPaid: 'Đã trả nhân sự',
    workerCostsHelp: 'Chi phí nhân sự gắn với công việc trong khoảng thời gian này, dù đã trả hay chưa.',
    workersPaidHelp: 'Khoản thanh toán nhân sự đã thực sự trả trong khoảng thời gian này.',
    costDetails: 'Chi tiết chi phí nhân sự', paidDetails: 'Chi tiết khoản đã trả',
    noCosts: 'Không có chi phí nhân sự trong khoảng thời gian này.', noPaid: 'Không có khoản thanh toán nhân sự trong khoảng thời gian này.',
    planned: 'Chi phí nhân sự dự kiến', recorded: 'Công lao động đã ghi', paid: 'Đã trả',
    permission: 'Bạn không có quyền xem chi tiết tài chính.', loading: 'Đang tải…'
  }
} as const;

export default function WorkerPayDashboardPage() {
  const { locale } = useTranslation();
  const c = copy[locale];
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [labor, setLabor] = useState<LaborRow[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(RANGE_STORAGE_KEY) as DashboardDateRange | null;
    if (saved && VALID_RANGES.includes(saved)) setRange(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(RANGE_STORAGE_KEY, range);
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      window.location.href = '/login?next=/dashboard/worker-pay';
      return;
    }

    const [{ data: profile }, org] = await Promise.all([
      supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
      fetchOrganizationContext(user.id)
    ]);

    const resolvedPlan = normalizePlan(profile?.plan);
    const resolvedRole = normalizeRole(org?.role || profile?.role);
    const canView = canAccessFinancials(resolvedRole, resolvedPlan);
    setPlan(resolvedPlan);
    setRole(resolvedRole);
    setAllowed(canView);

    if (!org?.organizationId || !canView) {
      setJobs([]);
      setLabor([]);
      setLoading(false);
      return;
    }

    const [jobsRes, laborRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, title, customer_name, status, created_at, start_date, scheduled_start, completed_at, due_date, is_skipped, recurring_series_id, occurrence_date, expected_contractor_cost')
        .eq('organization_id', org.organizationId),
      supabase
        .from('job_labor')
        .select('id, job_id, worker_name, hours, hourly_cost, total_cost, payment_status, paid_at, created_at')
        .eq('organization_id', org.organizationId)
    ]);

    setJobs((jobsRes.data || []) as JobRow[]);
    setLabor((laborRes.data || []) as LaborRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { start, end } = useMemo(() => rangeBounds(range), [range]);
  const rangeJobs = useMemo(() => filterValidJobsInPeriod(jobs, range), [jobs, range]);

  const costRows = useMemo<CostRow[]>(() => {
    const laborByJob = new Map<string, LaborRow[]>();
    for (const row of labor) {
      const jobId = String(row.job_id || '').trim();
      if (!jobId) continue;
      const current = laborByJob.get(jobId) || [];
      current.push(row);
      laborByJob.set(jobId, current);
    }

    return rangeJobs
      .map((job) => {
        const jobId = String(job.id || '').trim();
        if (!jobId) return null;
        const rows = laborByJob.get(jobId) || [];
        const recorded = rows.reduce((sum, row) => sum + num(row.total_cost), 0);
        const planned = Math.max(0, num(job.expected_contractor_cost));
        const amount = recorded > 0 ? recorded : planned;
        if (amount <= 0) return null;
        const workerNames = Array.from(new Set(rows.map((row) => String(row.worker_name || '').trim()).filter(Boolean)));
        const source = recorded > 0 ? c.recorded : c.planned;
        return {
          id: jobId,
          title: String(job.title || job.customer_name || 'Job'),
          subtitle: [job.customer_name, workerNames.join(', '), source].filter(Boolean).join(' · '),
          amount,
          href: `/jobs/${jobId}`
        };
      })
      .filter((row): row is CostRow => Boolean(row));
  }, [c.planned, c.recorded, labor, rangeJobs]);

  const paidRows = useMemo<CostRow[]>(() => {
    return labor
      .filter((row) => {
        if (String(row.payment_status || '').toLowerCase() !== 'paid' || !row.paid_at) return false;
        return range === 'all_time' || inRange(row.paid_at, start, end);
      })
      .map((row) => {
        const job = jobs.find((item) => String(item.id || '') === String(row.job_id || ''));
        return {
          id: String(row.id || `${row.job_id || 'labor'}-${row.paid_at || ''}`),
          title: String(row.worker_name || 'Worker'),
          subtitle: [job?.title, job?.customer_name, row.paid_at ? new Date(String(row.paid_at)).toLocaleDateString(locale) : null, c.paid]
            .filter(Boolean)
            .join(' · '),
          amount: num(row.total_cost),
          href: row.job_id ? `/jobs/${row.job_id}` : '/contractor-pay'
        };
      });
  }, [c.paid, end, jobs, labor, locale, range, start]);

  const workerCostTotal = useMemo(() => Number(costRows.reduce((sum, row) => sum + row.amount, 0).toFixed(2)), [costRows]);
  const workersPaidTotal = useMemo(() => Number(calculateContractorCashPaid(labor, start, end, range).toFixed(2)), [end, labor, range, start]);

  const rangeOptions: Array<{ id: DashboardDateRange; label: string }> = [
    { id: 'today', label: c.today },
    { id: 'week', label: c.week },
    { id: 'month', label: c.month },
    { id: 'year', label: c.year },
    { id: 'all_time', label: c.allTime }
  ];

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader title={c.title} subtitle={c.subtitle} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <label className="sr-only" htmlFor="worker-pay-period">{c.period}</label>
        <select
          id="worker-pay-period"
          className="input"
          value={range}
          disabled={loading}
          onChange={(event) => setRange(event.target.value as DashboardDateRange)}
          style={{ width: 'auto', minWidth: 150 }}
        >
          {rangeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </div>

      {loading ? <div className="card"><p className="muted">{c.loading}</p></div> : null}
      {!loading && !allowed ? <div className="card"><p>{c.permission}</p></div> : null}

      {!loading && allowed ? (
        <>
          <div className="dashboard-revenue-grid" style={{ marginBottom: 22 }}>
            <div className="dashboard-revenue-metric is-primary" style={{ minHeight: 120 }}>
              <span className="dashboard-revenue-metric-label">{c.workerCosts}</span>
              <strong className="dashboard-revenue-metric-value">{formatCurrency(workerCostTotal)}</strong>
              <span className="muted" style={{ marginTop: 8 }}>{c.workerCostsHelp}</span>
            </div>
            <div className="dashboard-revenue-metric is-primary" style={{ minHeight: 120 }}>
              <span className="dashboard-revenue-metric-label">{c.workersPaid}</span>
              <strong className="dashboard-revenue-metric-value">{formatCurrency(workersPaidTotal)}</strong>
              <span className="muted" style={{ marginTop: 8 }}>{c.workersPaidHelp}</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <h2>{c.costDetails}</h2>
            {costRows.length === 0 ? <p className="muted">{c.noCosts}</p> : null}
            {costRows.map((row) => (
              <Link key={row.id} href={row.href} className="list-row" style={{ textDecoration: 'none' }}>
                <div>
                  <strong>{row.title}</strong>
                  <p className="muted">{row.subtitle}</p>
                </div>
                <strong>{formatCurrency(row.amount)}</strong>
              </Link>
            ))}
          </div>

          <div className="card">
            <h2>{c.paidDetails}</h2>
            {paidRows.length === 0 ? <p className="muted">{c.noPaid}</p> : null}
            {paidRows.map((row) => (
              <Link key={row.id} href={row.href} className="list-row" style={{ textDecoration: 'none' }}>
                <div>
                  <strong>{row.title}</strong>
                  <p className="muted">{row.subtitle}</p>
                </div>
                <strong>{formatCurrency(row.amount)}</strong>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
