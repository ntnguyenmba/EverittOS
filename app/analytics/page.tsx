'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { BusinessPerformanceSection } from '@/components/business-performance-section';
import { SimpleBarChart } from '@/components/charts/simple-bar-chart';
import { canAccessFinancials } from '@/lib/finance-access';
import { limitsForPlan } from '@/lib/everittos-limits';
import { useTranslation } from '@/components/locale-provider';
import { formatDashboardCopy, getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isAdminRole, normalizeRole, type UserRole } from '@/lib/roles';
import { fetchDashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { fetchOrganizationContext } from '@/lib/organization';
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
  const { t, locale } = useTranslation();
  const copy = getDashboardFinanceCopy(locale);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [missingCompletionCount, setMissingCompletionCount] = useState(0);

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
      const org = await fetchOrganizationContext(user.id);
      const p = normalizePlan(profile?.plan);
      const r = normalizeRole(org?.role || profile?.role);
      setPlan(p);
      setRole(r);

      if (!canSeeOrgWideData(r)) {
        setLoading(false);
        setError('Your role cannot access organization analytics.');
        return;
      }

      if (isAdminRole(r) && org?.organizationId) {
        const metrics = await fetchDashboardRevenueMetrics(supabase, org.organizationId, 'all_time');
        setMissingCompletionCount(metrics.completedJobsMissingCompletedAt || 0);
      }

      if (limitsForPlan(p).advancedReporting) {
        const res = await fetch('/api/analytics/summary');
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Unable to load analytics.');
        } else {
          setSummary(json);
        }
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const hasData = useMemo(() => metricsHaveData(summary), [summary]);

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader title={t('ux.pageTitles.analytics')} subtitle={t('ux.helperAnalytics')} />

      {loading ? <p className="loading-state">{t('common.loading')}</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {!loading && !error && isAdminRole(role) && missingCompletionCount > 0 ? (
        <p className="muted" style={{ marginBottom: 16 }}>
          {formatDashboardCopy(copy.overview.missingCompletedAtWarning, { count: missingCompletionCount })}{' '}
          <Link href="/jobs?filter=missing_completion_date">{t('pages.jobs.missingCompletionDate')}</Link>
        </p>
      ) : null}

      {!loading && !error && limitsForPlan(plan).advancedReporting && summary && !hasData ? (
        <LocalizedEmptyState emptyKey="analytics" />
      ) : null}

      {!error && canAccessFinancials(role, plan) ? (
        <div style={{ marginBottom: 28 }}>
          <BusinessPerformanceSection />
        </div>
      ) : null}

      {limitsForPlan(plan).advancedReporting && summary && hasData ? (
        <div className="charts-grid">
          <SimpleBarChart title={t('analytics.adoption')} points={summary.adoptionMetrics} />
          <SimpleBarChart title={t('analytics.growth')} points={summary.growthMetrics} />
          <SimpleBarChart title={t('analytics.usage')} points={summary.usageMetrics} />
        </div>
      ) : null}
    </AppShell>
  );
}
