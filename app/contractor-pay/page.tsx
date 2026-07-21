'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { formatLaborPaymentLabel } from '@/lib/job-labor-basis';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
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

type JobSummary = { id: string; title: string; customer_name: string | null };
type Filter = 'unpaid' | 'pending' | 'paid' | 'all';

function money(value: unknown) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function paymentCountLabel(count: number) {
  return `${count} payment${count === 1 ? '' : 's'}`;
}

function ContractorPayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get('status');
  const initialFilter: Filter = requestedFilter === 'pending' || requestedFilter === 'paid' || requestedFilter === 'all' ? requestedFilter : 'unpaid';
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [rows, setRows] = useState<LaborRow[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobSummary>>({});
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      router.push('/login?next=/contractor-pay');
      return;
    }

    const [{ data: profile }, org] = await Promise.all([
      supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
      fetchOrganizationContext(user.id)
    ]);
    const resolvedRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(resolvedRole);
    setCanManage(isManagerRole(resolvedRole));

    if (!org?.organizationId || !isManagerRole(resolvedRole)) {
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

    if (error) {
      // Older databases may not have payment_basis yet.
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
        const laborRows = (fallback.data || []) as LaborRow[];
        setRows(laborRows);
        const jobIds = Array.from(new Set(laborRows.map((row) => row.job_id).filter(Boolean)));
        if (jobIds.length) {
          const { data: jobRows } = await supabase.from('jobs').select('id, title, customer_name').in('id', jobIds);
          const map: Record<string, JobSummary> = {};
          for (const job of (jobRows || []) as JobSummary[]) map[job.id] = job;
          setJobs(map);
        } else {
          setJobs({});
        }
        setLoading(false);
        return;
      }
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const laborRows = (data || []) as LaborRow[];
    setRows(laborRows);
    const jobIds = Array.from(new Set(laborRows.map((row) => row.job_id).filter(Boolean)));
    if (jobIds.length) {
      const { data: jobRows } = await supabase.from('jobs').select('id, title, customer_name').in('id', jobIds);
      const map: Record<string, JobSummary> = {};
      for (const job of (jobRows || []) as JobSummary[]) map[job.id] = job;
      setJobs(map);
    } else {
      setJobs({});
    }
    setLoading(false);
  }, [router]);

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
    () => rows.filter((row) => filter === 'all' || String(row.payment_status || 'unpaid').toLowerCase() === filter),
    [filter, rows]
  );

  async function setPaymentStatus(row: LaborRow, paymentStatus: 'unpaid' | 'pending' | 'paid') {
    if (updatingId) return;
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
      setMessage(json.error || 'Unable to update contractor payment.');
      return;
    }
    setMessage(paymentStatus === 'paid' ? 'Contractor payment marked paid.' : `Contractor payment marked ${paymentStatus}.`);
    await load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader title="Contractor Pay" subtitle="See who needs to be paid, which job the payment belongs to, and whether it is unpaid, pending, or paid." />

      {!canManage && !loading ? <div className="card">Only owners, admins, and managers can view contractor payments.</div> : null}

      {canManage ? (
        <>
          <div className="dashboard-stats-grid" style={{ marginBottom: 18 }}>
            <button type="button" className={`card stat-card ${filter === 'unpaid' ? 'is-active' : ''}`} onClick={() => setFilter('unpaid')}>
              <span className="stat-label">Still owed</span><strong className="stat-value">{money(totals.unpaid)}</strong><span className="muted">{paymentCountLabel(counts.unpaid)}</span>
            </button>
            <button type="button" className={`card stat-card ${filter === 'pending' ? 'is-active' : ''}`} onClick={() => setFilter('pending')}>
              <span className="stat-label">Pending</span><strong className="stat-value">{money(totals.pending)}</strong><span className="muted">{paymentCountLabel(counts.pending)}</span>
            </button>
            <button type="button" className={`card stat-card ${filter === 'paid' ? 'is-active' : ''}`} onClick={() => setFilter('paid')}>
              <span className="stat-label">Paid</span><strong className="stat-value">{money(totals.paid)}</strong><span className="muted">{paymentCountLabel(counts.paid)}</span>
            </button>
          </div>

          <div className="card">
            <div className="dashboard-section-head">
              <div><h2>{filter === 'all' ? 'All contractor payments' : `${filter.charAt(0).toUpperCase()}${filter.slice(1)} contractor payments`}</h2><p className="muted">Changes here automatically update the dashboard totals.</p></div>
              <div className="inline-actions"><button type="button" className="btn" onClick={() => setFilter('all')}>Show all</button><button type="button" className="btn" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button></div>
            </div>
            {message ? <p className="auth-message">{message}</p> : null}
            {loading ? <p className="loading-state">Loading contractor payments...</p> : null}
            {!loading && visibleRows.length === 0 ? <p className="muted">No contractor payments match this status.</p> : null}
            {visibleRows.map((row) => {
              const job = jobs[row.job_id];
              const status = String(row.payment_status || 'unpaid').toLowerCase();
              return (
                <div key={row.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <strong>{row.worker_name || 'Unnamed contractor'} · {money(row.total_cost)}</strong>
                    <p className="muted">{job?.title || 'Job'}{job?.customer_name ? ` · ${job.customer_name}` : ''}</p>
                    <p className="muted">
                      {formatLaborPaymentLabel({
                        paymentBasis: row.payment_basis,
                        quantity: row.hours,
                        rate: row.hourly_cost,
                        total: row.total_cost
                      })}{' '}
                      · {status}
                    </p>
                    {row.paid_at ? <p className="muted">Paid {new Date(row.paid_at).toLocaleDateString()}</p> : null}
                  </div>
                  <div className="inline-actions">
                    <Link className="btn btn-sm" href={`/jobs/${row.job_id}`}>Open job</Link>
                    {status !== 'pending' ? <button type="button" className="btn btn-sm" disabled={updatingId === row.id} onClick={() => void setPaymentStatus(row, 'pending')}>Mark pending</button> : null}
                    {status !== 'paid' ? <button type="button" className="btn btn-primary btn-sm" disabled={updatingId === row.id} onClick={() => void setPaymentStatus(row, 'paid')}>Mark paid</button> : null}
                    {status === 'paid' ? <button type="button" className="btn btn-sm" disabled={updatingId === row.id} onClick={() => void setPaymentStatus(row, 'unpaid')}>Mark unpaid</button> : null}
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
  return <Suspense><ContractorPayContent /></Suspense>;
}
