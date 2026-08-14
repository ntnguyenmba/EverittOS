'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { canAccessFinancials } from '@/lib/finance-access';
import { UNASSIGNED_CONTRACTOR_LABEL } from '@/lib/finance/contractor-cost';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { formatDashboardCopy, getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { formatLaborPaymentLabel } from '@/lib/job-labor-basis';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type LaborRow = {
  id: string;
  job_id: string;
  worker_name: string | null;
  hours: number | string | null;
  hourly_cost: number | string | null;
  total_cost: number | string | null;
  payment_basis?: string | null;
  payment_status: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string | null;
};

type JobSummary = {
  id: string;
  title: string;
  customer_name: string | null;
  expected_contractor_cost?: number | null;
  assigned_to?: string | null;
};

type Filter = 'unpaid' | 'pending' | 'paid' | 'all';

function money(value: unknown) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function paymentCountLabel(count: number) {
  return `${count} payment${count === 1 ? '' : 's'}`;
}

function ContractorPayContent() {
  const { locale } = useTranslation();
  const copy = getDashboardFinanceCopy(locale).contractorPayPage;
  const exportCopy = getExportCopy(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get('status');
  const jobIdFilter = searchParams.get('jobId') || '';
  const initialFilter: Filter =
    requestedFilter === 'pending' || requestedFilter === 'paid' || requestedFilter === 'all'
      ? requestedFilter
      : 'unpaid';
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [rows, setRows] = useState<LaborRow[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobSummary>>({});
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingJob, setPendingJob] = useState<{
    id: string;
    title: string;
    customer_name: string | null;
    expected_contractor_cost: number;
    assigned_name: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    setPendingJob(null);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      router.push('/login?next=/worker-pay');
      return;
    }

    const [{ data: profile }, org] = await Promise.all([
      supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
      fetchOrganizationContext(user.id)
    ]);
    const resolvedRole = normalizeRole(org?.role || profile?.role);
    const resolvedPlan = normalizePlan(profile?.plan);
    setPlan(resolvedPlan);
    setRole(resolvedRole);
    const allowed = canAccessFinancials(resolvedRole, resolvedPlan);
    setCanManage(allowed);

    if (!org?.organizationId || !allowed) {
      setRows([]);
      setJobs({});
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('job_labor')
      .select(
        'id, job_id, worker_name, hours, hourly_cost, total_cost, payment_basis, payment_status, paid_at, payment_method, payment_reference, created_at'
      )
      .eq('organization_id', org.organizationId)
      .order('created_at', { ascending: false });

    let laborRows: LaborRow[] = [];
    if (error) {
      if (/payment_basis/i.test(error.message || '')) {
        const fallback = await supabase
          .from('job_labor')
          .select(
            'id, job_id, worker_name, hours, hourly_cost, total_cost, payment_status, paid_at, payment_method, payment_reference, created_at'
          )
          .eq('organization_id', org.organizationId)
          .order('created_at', { ascending: false });
        if (fallback.error) {
          setMessage(fallback.error.message);
          setLoading(false);
          return;
        }
        laborRows = (fallback.data || []) as LaborRow[];
      } else {
        setMessage(error.message);
        setLoading(false);
        return;
      }
    } else {
      laborRows = (data || []) as LaborRow[];
    }
    setRows(laborRows);

    const jobIds = Array.from(new Set(laborRows.map((row) => row.job_id).filter(Boolean)));
    if (jobIdFilter && !jobIds.includes(jobIdFilter)) jobIds.push(jobIdFilter);

    if (jobIds.length) {
      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id, title, customer_name, expected_worker_cost, assigned_to')
        .eq('organization_id', org.organizationId)
        .in('id', jobIds);
      const map: Record<string, JobSummary> = {};
      for (const job of (jobRows || []) as JobSummary[]) map[job.id] = job;
      setJobs(map);

      if (jobIdFilter) {
        const job = map[jobIdFilter];
        const existingForJob = laborRows.filter((row) => row.job_id === jobIdFilter);
        if (job && existingForJob.length === 0 && Number(job.expected_contractor_cost || 0) > 0) {
          let assignedName = UNASSIGNED_CONTRACTOR_LABEL;
          if (job.assigned_to) {
            const { data: worker } = await supabase
              .from('workers')
              .select('name')
              .eq('organization_id', org.organizationId)
              .eq('auth_user_id', job.assigned_to)
              .maybeSingle();
            assignedName = worker?.name || assignedName;
          }
          setPendingJob({
            id: job.id,
            title: job.title,
            customer_name: job.customer_name,
            expected_contractor_cost: Number(job.expected_contractor_cost || 0),
            assigned_name: assignedName
          });
        }
      }
    } else {
      setJobs({});
    }
    setLoading(false);
  }, [jobIdFilter, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const result = { unpaid: 0, pending: 0, paid: 0, all: rows.length };
    for (const row of rows) {
      const status = String(row.payment_status || 'unpaid').toLowerCase();
      if (status === 'paid') result.paid += 1;
      else if (status === 'pending') result.pending += 1;
      else result.unpaid += 1;
    }
    return result;
  }, [rows]);

  const totals = useMemo(() => {
    const result = { unpaid: 0, pending: 0, paid: 0, all: 0 };
    for (const row of rows) {
      const amount = Number(row.total_cost || 0);
      const status = String(row.payment_status || 'unpaid').toLowerCase();
      result.all += amount;
      if (status === 'paid') result.paid += amount;
      else if (status === 'pending') result.pending += amount;
      else result.unpaid += amount;
    }
    return result;
  }, [rows]);

  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (jobIdFilter && row.job_id !== jobIdFilter) return false;
        return filter === 'all' || String(row.payment_status || 'unpaid').toLowerCase() === filter;
      }),
    [filter, jobIdFilter, rows]
  );

  async function initializeFromJob() {
    if (!pendingJob || initializing) return;
    setInitializing(true);
    setMessage('');
    const res = await fetch(`/api/jobs/${pendingJob.id}/labor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_name: pendingJob.assigned_name,
        hours: 1,
        hourly_cost: pendingJob.expected_contractor_cost,
        payment_basis: 'flat',
        payment_status: 'unpaid',
        notes: null
      })
    });
    const json = await res.json().catch(() => ({}));
    setInitializing(false);
    if (!res.ok) {
      setMessage(json.error || copy.updateError);
      return;
    }
    setMessage(copy.initializeFromJob);
    await load();
  }

  async function setPaymentStatus(row: LaborRow, paymentStatus: 'unpaid' | 'pending' | 'paid') {
    if (updatingId) return;
    if (String(row.payment_status || '').toLowerCase() === 'paid' && paymentStatus !== 'paid') {
      // Allow reopening paid only via explicit still-owed action; do not overwrite silently elsewhere.
    }
    setUpdatingId(row.id);
    setMessage('');
    const res = await fetch(`/api/jobs/${row.job_id}/labor/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: paymentStatus })
    });
    const json = await res.json().catch(() => ({}));
    setUpdatingId(null);
    if (!res.ok) {
      setMessage(json.error || copy.updateError);
      return;
    }
    setMessage(
      paymentStatus === 'paid'
        ? copy.markedPaid
        : formatDashboardCopy(copy.markedStatus, { status: paymentStatus })
    );
    await load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        action={
          canManage ? (
            <ExportMenu
              endpoint="/api/exports/worker-pay"
              query={{ status: filter, jobId: jobIdFilter }}
              locale={locale}
              disabled={loading}
              onError={(message) => setMessage(message || exportCopy.exportFailed)}
              onSuccess={(format) => {
                if (format === 'share') setMessage(exportCopy.shareSent);
              }}
            />
          ) : undefined
        }
      />
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        {copy.privacyNotice}
      </p>

      {!canManage && !loading ? <div className="card">{copy.permissionDenied}</div> : null}

      {canManage ? (
        <>
          {pendingJob ? (
            <div className="card" style={{ marginBottom: 18 }}>
              <h3>{copy.reviewPayment}</h3>
              <p className="muted">{copy.initializeFromJob}</p>
              <p>
                <strong>{pendingJob.title}</strong>
                {pendingJob.customer_name ? ` · ${pendingJob.customer_name}` : ''}
              </p>
              <p className="muted">
                {pendingJob.assigned_name} · {copy.flatRate} · {money(pendingJob.expected_contractor_cost)}
              </p>
              <button type="button" className="btn btn-primary" disabled={initializing} onClick={() => void initializeFromJob()}>
                {initializing ? copy.refreshing : copy.reviewPayment}
              </button>
            </div>
          ) : null}

          <div className="dashboard-stats-grid" style={{ marginBottom: 18 }}>
            <button type="button" className={`card stat-card ${filter === 'unpaid' ? 'is-active' : ''}`} onClick={() => setFilter('unpaid')}>
              <span className="stat-label">{copy.stillOwed}</span>
              <strong className="stat-value">{money(totals.unpaid)}</strong>
              <span className="muted">{paymentCountLabel(counts.unpaid)}</span>
            </button>
            <button type="button" className={`card stat-card ${filter === 'pending' ? 'is-active' : ''}`} onClick={() => setFilter('pending')}>
              <span className="stat-label">{copy.pending}</span>
              <strong className="stat-value">{money(totals.pending)}</strong>
              <span className="muted">{paymentCountLabel(counts.pending)}</span>
            </button>
            <button type="button" className={`card stat-card ${filter === 'paid' ? 'is-active' : ''}`} onClick={() => setFilter('paid')}>
              <span className="stat-label">{copy.paid}</span>
              <strong className="stat-value">{money(totals.paid)}</strong>
              <span className="muted">{paymentCountLabel(counts.paid)}</span>
            </button>
          </div>

          <div className="card">
            <div className="dashboard-section-head">
              <div>
                <h2>
                  {filter === 'all'
                    ? copy.allPayments
                    : formatDashboardCopy(copy.statusPayments, { status: filter })}
                </h2>
                <p className="muted">{copy.changesHint}</p>
              </div>
              <div className="inline-actions">
                <button type="button" className="btn" onClick={() => setFilter('all')}>
                  {copy.showAll}
                </button>
                <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
                  {loading ? copy.refreshing : copy.refresh}
                </button>
              </div>
            </div>
            {message ? <p className="auth-message">{message}</p> : null}
            {loading ? <p className="loading-state">{copy.loading}</p> : null}
            {!loading && visibleRows.length === 0 && !pendingJob ? <p className="muted">{copy.empty}</p> : null}
            {visibleRows.map((row) => {
              const job = jobs[row.job_id];
              const status = String(row.payment_status || 'unpaid').toLowerCase();
              return (
                <div key={row.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <strong>
                      {row.worker_name || copy.unnamed} · {money(row.total_cost)}
                    </strong>
                    <p className="muted">
                      {job?.title || copy.jobFallback}
                      {job?.customer_name ? ` · ${job.customer_name}` : ''}
                    </p>
                    <p className="muted">
                      {formatLaborPaymentLabel({
                        paymentBasis: row.payment_basis,
                        quantity: row.hours,
                        rate: row.hourly_cost,
                        total: row.total_cost,
                        locale
                      })}{' '}
                      · {status}
                    </p>
                    {row.paid_at ? (
                      <p className="muted">
                        {copy.paid} {new Date(row.paid_at).toLocaleDateString(locale)}
                      </p>
                    ) : null}
                  </div>
                  <div className="inline-actions">
                    <Link className="btn btn-sm" href={`/jobs/${row.job_id}`}>
                      {copy.openJob}
                    </Link>
                    {status !== 'pending' ? (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={updatingId === row.id}
                        onClick={() => void setPaymentStatus(row, 'pending')}
                      >
                        {copy.markPending}
                      </button>
                    ) : null}
                    {status !== 'paid' ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={updatingId === row.id}
                        onClick={() => void setPaymentStatus(row, 'paid')}
                      >
                        {copy.markPaid}
                      </button>
                    ) : null}
                    {status === 'paid' ? (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={updatingId === row.id}
                        onClick={() => void setPaymentStatus(row, 'unpaid')}
                      >
                        {copy.stillOwed}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

export default function ContractorPayPage() {
  return (
    <Suspense>
      <ContractorPayContent />
    </Suspense>
  );
}
