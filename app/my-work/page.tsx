'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { StatusPill } from '@/components/status-pill';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type JobRow = {
  id: string;
  title: string;
  customer_name: string | null;
  address: string | null;
  status: string | null;
  due_date: string | null;
  assigned_to: string | null;
};

type ShareRow = {
  id: string;
  record_type: string;
  record_id: string;
  access_level: string;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return 'No due date';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function recordHref(recordType: string, recordId: string) {
  if (recordType === 'job') return `/jobs/${recordId}`;
  if (recordType === 'customer') return `/customers/${recordId}`;
  if (recordType === 'report') return '/reports';
  return '#';
}

export default function MyWorkPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('employee');
  const [assignedJobs, setAssignedJobs] = useState<JobRow[]>([]);
  const [sharedRecords, setSharedRecords] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/my-work');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    setPlan(normalizePlan(profile?.plan));
    setRole(normalizeRole(org?.role || profile?.role));

    if (!org?.organizationId) {
      setAssignedJobs([]);
      setSharedRecords([]);
      setLoading(false);
      return;
    }

    const { data: workerRows } = await supabase
      .from('workers')
      .select('id')
      .eq('organization_id', org.organizationId)
      .eq('auth_user_id', user.id);
    const assignedIds = Array.from(
      new Set([user.id, ...((workerRows || []) as { id: string }[]).map((worker) => worker.id)].filter(Boolean))
    );

    const jobsQuery = supabase
      .from('jobs')
      .select('id, title, customer_name, address, status, due_date, assigned_to')
      .eq('organization_id', org.organizationId)
      .order('due_date', { ascending: true, nullsFirst: false });

    const [{ data: jobs }, { data: shares }] = await Promise.all([
      assignedIds.length ? jobsQuery.in('assigned_to', assignedIds) : jobsQuery.eq('assigned_to', user.id),
      supabase
        .from('record_shares')
        .select('id, record_type, record_id, access_level, created_at')
        .eq('organization_id', org.organizationId)
        .eq('shared_with_user_id', user.id)
        .order('created_at', { ascending: false })
    ]);

    setAssignedJobs((jobs || []) as JobRow[]);
    setSharedRecords((shares || []) as ShareRow[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell plan={plan} role={role}>
      <div className="page-head">
        <div>
          <h1>My Work</h1>
          <p className="muted">Assigned jobs are work you are responsible for. Shared records only give you access to view or edit information.</p>
        </div>
        <Link className="btn" href="/notifications">
          Notifications
        </Link>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>Jobs assigned to me</h3>
          <p className="muted">These jobs count as your assigned work and appear in your personal metrics.</p>
          {loading ? <p className="loading-state">Loading...</p> : null}
          {!loading && assignedJobs.length === 0 ? <p className="muted">No jobs are assigned to you yet.</p> : null}
          {assignedJobs.map((job) => (
            <div key={job.id} className="list-row">
              <div>
                <strong>{job.title}</strong>
                <p className="muted">{job.customer_name || 'No customer'} · {job.address || 'No address'}</p>
                <p className="muted">Due {formatDate(job.due_date)}</p>
              </div>
              <div className="inline-actions">
                <StatusPill status={job.status} />
                <Link className="btn" href={`/jobs/${job.id}`}>
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Records shared with me</h3>
          <p className="muted">Shared access does not assign the job to you and does not add it to your assigned-job metrics.</p>
          {loading ? <p className="loading-state">Loading...</p> : null}
          {!loading && sharedRecords.length === 0 ? <p className="muted">No records have been shared with you yet.</p> : null}
          {sharedRecords.map((share) => (
            <div key={share.id} className="list-row">
              <div>
                <strong>{share.record_type.replace('_', ' ')}</strong>
                <p className="muted">Shared access · {share.access_level === 'edit' ? 'Can edit' : 'View only'}</p>
                <p className="muted">Shared {share.created_at ? new Date(share.created_at).toLocaleString() : 'recently'}</p>
              </div>
              <Link className="btn" href={recordHref(share.record_type, share.record_id)}>
                Open shared record
              </Link>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
