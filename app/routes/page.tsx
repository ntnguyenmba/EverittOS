'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/components/locale-provider';
import type { RouteStop } from '@/lib/route-optimization';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type RouteRun = {
  id: string;
  service_date: string;
  status: string;
  optimized_stops: RouteStop[];
  provider: string;
};

export default function RoutesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [runs, setRuns] = useState<RouteRun[]>([]);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [selectedRun, setSelectedRun] = useState<RouteRun | null>(null);

  const canManage = isManagerRole(role);

  const load = useCallback(async () => {
    const res = await fetch('/api/routes');
    const json = await res.json();
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load routes.');
      return;
    }
    setRuns(json.runs || []);
  }, [appFeedback, t]);

  useEffect(() => {
    async function init() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/routes');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      const workspaceRole = normalizeRole(org?.role || profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(workspaceRole);
      if (!isManagerRole(workspaceRole)) {
        router.push('/schedule');
        return;
      }
      setLoading(false);
      await load();
    }
    void init();
  }, [router, load]);

  async function optimize() {
    setOptimizing(true);
    const res = await fetch('/api/routes/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_date: serviceDate })
    });
    const json = await res.json();
    setOptimizing(false);
    if (!res.ok) {
      appFeedback.error(json.error || t('pages.routes.optimizeError'));
      return;
    }
    setSelectedRun(json.run);
    if (json.flaggedMissingAddress) {
      appFeedback.error(`${json.flaggedMissingAddress} job(s) are missing addresses. ${json.note}`);
    }
    void load();
  }

  async function applyRoute(runId: string) {
    if (!window.confirm(t('pages.routes.applyConfirm'))) return;
    const res = await fetch(`/api/routes/${runId}/apply`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      appFeedback.error(json.error || t('pages.routes.applyError'));
      return;
    }
    appFeedback.saved();
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader title={t('pages.routes.title')} subtitle={t('pages.routes.subtitle')} />

      {canManage ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <input className="input" type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} disabled={optimizing} onClick={() => void optimize()}>
            {optimizing ? t('pages.routes.building') : t('pages.routes.buildRoute')}
          </button>
        </div>
      ) : null}

      {loading ? <p className="muted">{t('pages.routes.loading')}</p> : null}
      {!loading && runs.length === 0 ? <p className="muted">{t('pages.routes.empty')}</p> : null}

      {!loading && runs.length > 0 ? (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>{t('pages.routes.colDate')}</th>
                <th>{t('pages.routes.colStatus')}</th>
                <th>{t('pages.routes.colStops')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.service_date}</td>
                  <td>{run.status}</td>
                  <td>{(run.optimized_stops || []).length}</td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-sm" onClick={() => setSelectedRun(run)}>
                      {t('pages.routes.view')}
                    </button>
                    {canManage && run.status !== 'applied' ? (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => void applyRoute(run.id)}>
                        {t('pages.routes.apply')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selectedRun ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{t('pages.routes.stopsFor', { date: selectedRun.service_date })}</h2>
          <ol>
            {(selectedRun.optimized_stops || []).map((stop) => (
              <li key={stop.job_id} style={{ marginBottom: 8 }}>
                {stop.sort_order}. {stop.title} — {stop.address || t('pages.routes.missingAddress')}
                {stop.missing_address ? <span className="muted"> ({t('pages.routes.addressNeeded')})</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </AppShell>
  );
}
