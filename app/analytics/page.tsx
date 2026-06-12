'use client';

import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { SimpleBarChart } from '@/components/charts/simple-bar-chart';
import { useTranslation } from '@/components/locale-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canSeeOrgWideData } from '@/lib/permissions';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type AnalyticsSummary = {
  adoptionMetrics: { label: string; value: number }[];
  growthMetrics: { label: string; value: number }[];
  usageMetrics: { label: string; value: number }[];
};

function metricsHaveData(summary: AnalyticsSummary | null): boolean {
  if (!summary) return false;
  const all = [...summary.adoptionMetrics, ...summary.growthMetrics, ...summary.usageMetrics];
  return all.some((m) => m.value > 0);
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/analytics');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const p = normalizePlan(profile?.plan);
      const r = normalizeRole(profile?.role);
      setPlan(p);
      setRole(r);

      if (!canSeeOrgWideData(r)) {
        setLoading(false);
        setError('Your role cannot access organization analytics.');
        return;
      }

      const res = await fetch('/api/analytics/summary');
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(json.error || 'Unable to load analytics.');
        return;
      }
      setSummary(json);
    }
    load();
  }, [router]);

  const hasData = useMemo(() => metricsHaveData(summary), [summary]);

  return (
    <AppShell plan={plan} role={role}>
      <h1>{t('nav.analytics')}</h1>
      <p className="muted page-subtitle">Usage, adoption, and growth metrics for your organization (last 30 days).</p>

      {loading ? <p className="loading-state">Loading analytics…</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {!loading && !error && summary && !hasData ? (
        <EmptyState title="No metrics yet" description={t('dashboard.analyticsEmpty')} />
      ) : null}

      {summary && hasData ? (
        <div className="charts-grid">
          <SimpleBarChart title="Adoption metrics" points={summary.adoptionMetrics} />
          <SimpleBarChart title="Growth metrics" points={summary.growthMetrics} />
          <SimpleBarChart title="Usage metrics" points={summary.usageMetrics} />
        </div>
      ) : null}
    </AppShell>
  );
}
