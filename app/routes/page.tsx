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

const routesPageCopy = {
  en: { subtitle: 'Build efficient daily routes from scheduled jobs and saved addresses.' },
  es: { subtitle: 'Crea rutas diarias eficientes con trabajos programados y direcciones guardadas.' },
  vi: { subtitle: 'Tạo lộ trình hằng ngày hiệu quả từ công việc và địa chỉ đã lưu.' }
} as const;

type RouteRun = {
  id: string;
  service_date: string;
  status: string;
  optimized_stops: RouteStop[];
  provider: string;
};

export default function RoutesPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const pageCopy = routesPageCopy[locale];
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
  }, [appFeedback]);

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
      appFeedback.error(`${json.flaggedMissingAddress} job(s) need an address. ${json.note}`);
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
      <PageHeader title={t('pages.routes.title')} subtitle={pageCopy.subtitle} />

      {canManage ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <label className="field-label" htmlFor="route-date">
            Date
          </label>
          <input
            id="route-date"
            className="input"
            type="date"
            value={serviceDate}
            onChange={(event) => setServiceDate(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            disabled={optimizing}
            onClick={() => void optimize()}
          >
            {optimizing ? t('pages.routes.building') : t('pages.routes.buildRoute')}
          </button>
        </section>
      ) : null}

      {loading ? <p className="loading-state">{t('pages.routes.loading')}</p> : null}

      {!loading && runs.length === 0 ? (
        <section className="card">
          <h2>No routes yet</h2>
          <p className="muted">Choose a date above to build a route.</p>
        </section>
      ) : null}

      {!loading && runs.length > 0 ? (
        <section>
          <h2 style={{ marginBottom: 10 }}>Saved routes</h2>
          <div className="card-grid">
            {runs.map((run) => (
              <article key={run.id} className="card">
                <strong>{run.service_date}</strong>
                <p className="muted" style={{ margin: '6px 0' }}>
                  {(run.optimized_stops || []).length} stops
                </p>
                <p style={{ margin: '0 0 12px' }}>{run.status}</p>
                <div className="settings-actions">
                  <button type="button" className="btn btn-sm" onClick={() => setSelectedRun(run)}>
                    {t('pages.routes.view')}
                  </button>
                  {canManage && run.status !== 'applied' ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => void applyRoute(run.id)}>
                      {t('pages.routes.apply')}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {selectedRun ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="settings-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{t('pages.routes.stopsFor', { date: selectedRun.service_date })}</h2>
            <button type="button" className="btn btn-sm" onClick={() => setSelectedRun(null)}>
              Close
            </button>
          </div>
          <ol style={{ paddingLeft: 22, marginBottom: 0 }}>
            {(selectedRun.optimized_stops || []).map((stop) => (
              <li key={stop.job_id} style={{ marginBottom: 12 }}>
                <strong>{stop.title}</strong>
                <br />
                <span className={stop.missing_address ? 'auth-message auth-message-error' : 'muted'}>
                  {stop.address || t('pages.routes.missingAddress')}
                  {stop.missing_address ? ` (${t('pages.routes.addressNeeded')})` : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </AppShell>
  );
}
