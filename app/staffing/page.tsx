'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { staffingPipelineLabel, STAFFING_PIPELINE_STAGES } from '@/lib/staffing-pipeline';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type StaffingRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_interest: string | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
};

const emptyCounts = {
  applicant: 0,
  interview: 0,
  screening: 0,
  offer_sent: 0,
  contractor: 0,
  employee: 0,
  inactive: 0,
  rejected: 0,
  rehired: 0
};

export default function StaffingPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [records, setRecords] = useState<StaffingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      router.push('/login?next=/staffing');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const workspace = await ensureWorkspaceForSave(user.id);
    const workspaceRole = normalizeRole(workspace.ok ? workspace.workspace.role : profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(workspaceRole);
    setCanManage(isManagerRole(workspaceRole));

    if (!workspace.ok || !isManagerRole(workspaceRole)) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('staffing_records')
      .select('id, name, email, phone, role_interest, source, status, created_at')
      .eq('organization_id', workspace.workspace.organizationId)
      .order('created_at', { ascending: false })
      .limit(200);

    setRecords((data || []) as StaffingRecord[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const next = { ...emptyCounts } as Record<string, number>;
    for (const record of records) {
      const status = record.status || 'applicant';
      next[status] = (next[status] || 0) + 1;
    }
    return next;
  }, [records]);

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader title="Staffing CRM" subtitle="Track applicants, contractors, employees, inactive workers, and rehires separately from customers and leads." />

      {!canManage ? (
        <div className="card">Only owners, admins, and managers can view staffing records.</div>
      ) : (
        <>
          <section className="card" style={{ marginBottom: 18 }}>
            <div className="dashboard-section-head" style={{ alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <h2>Staffing pipeline</h2>
                <p className="page-subtitle" style={{ marginTop: 8, marginBottom: 0 }}>
                  Keep hiring, contractor onboarding, and employees separate from customer CRM.
                </p>
              </div>
              <Link className="btn btn-primary" href="/staffing/new">Add staffing record</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
              {STAFFING_PIPELINE_STAGES.map((stage) => (
                <div key={stage.value} className="stat-card">
                  <span>{stage.label}</span>
                  <strong>{counts[stage.value] || 0}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Records</h2>
            {loading ? <p className="loading-state">Loading staffing records...</p> : null}
            {!loading && records.length === 0 ? <p className="muted">No staffing records yet.</p> : null}
            {records.map((record) => (
              <div key={record.id} className="list-row">
                <div>
                  <Link href={`/staffing/${record.id}`}><strong>{record.name}</strong></Link>
                  <p className="muted">
                    {staffingPipelineLabel(record.status)} · {record.role_interest || 'Role not set'} · {record.email || record.phone || 'No contact'}
                  </p>
                </div>
                <Link className="btn btn-sm" href={`/staffing/${record.id}`}>Open</Link>
              </div>
            ))}
          </section>
        </>
      )}
    </AppShell>
  );
}
