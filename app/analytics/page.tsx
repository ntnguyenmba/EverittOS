'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { BusinessPerformanceSection } from '@/components/business-performance-section';
import { SimpleBarChart } from '@/components/charts/simple-bar-chart';
import { canAccessFinancials } from '@/lib/finance-access';
import { limitsForPlan } from '@/lib/everittos-limits';
import { useTranslation } from '@/components/locale-provider';
import { formatDashboardCopy, getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isAdminRole, normalizeRole, type UserRole } from '@/lib/roles';
import { fetchDashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const analyticsPageCopy = {
  en: { title: 'Business numbers', subtitle: 'Understand revenue, activity, growth, and the work that needs attention.' },
  es: { title: 'Números del negocio', subtitle: 'Comprende los ingresos, la actividad, el crecimiento y el trabajo que requiere atención.' },
  vi: { title: 'Số liệu kinh doanh', subtitle: 'Theo dõi doanh thu, hoạt động, tăng trưởng và công việc cần chú ý.' }
} as const;

type AnalyticsSummary = {
  adoptionMetrics: { label: string; value: number }[];
  growthMetrics: { label: string; value: number }[];
  usageMetrics: { label: string; value: number }[];
};

function metricsHaveData(summary: AnalyticsSummary | null): boolean {
  if (!summary) return false;
  return [...summary.adoptionMetrics, ...summary.growthMetrics, ...summary.usageMetrics].some((metric) => metric.value > 0);
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const copy = getDashboardFinanceCopy(locale);
  const pageCopy = analyticsPageCopy[locale];
  const exportCopy = getExportCopy(locale);
  const appFeedback = useAppFeedback();
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
      const nextPlan = normalizePlan(profile?.plan);
      const nextRole = normalizeRole(org?.role || profile?.role);
      setPlan(nextPlan);
      setRole(nextRole);

      if (!canSeeOrgWideData(nextRole)) {
        setLoading(false);
        setError('You do not have access to business numbers.');
        return;
      }

      if (isAdminRole(nextRole) && org?.organizationId) {
        const metrics = await fetchDashboardRevenueMetrics(supabase, org.organizationId, 'all_time');
        setMissingCompletionCount(metrics.completedJobsMissingCompletedAt || 0);
      }

      if (limitsForPlan(nextPlan).advancedReporting) {
        const res = await fetch('/api/analytics/summary');
        const json = await res.json();
        if (!res.ok) setError(json.error || 'Unable to load analytics.');
        else setSummary(json);
      }
      setLoading(false);
    }

    void load();
  }, [router]);

  const hasData = useMemo(() => metricsHaveData(summary), [summary]);

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title={pageCopy.title}
        subtitle={pageCopy.subtitle}
        action={
          canAccessFinancials(role, plan) ? (
            <ExportMenu
              endpoint="/api/exports/dashboard"
              query={{ range: 'all_time' }}
              locale={locale}
              disabled={loading}
              onError={(message) => appFeedback.error(message || exportCopy.exportFailed)}
              onSuccess={(format) => {
                if (format === 'share') appFeedback.success(exportCopy.shareSent);
              }}
            />
          ) : undefined
        }
      />

      {loading ? <p className="loading-state">Loading...</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {!loading && !error && isAdminRole(role) && missingCompletionCount > 0 ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <strong>Some completed jobs need a completion date.</strong>
          <p className="muted" style={{ margin: '6px 0 12px' }}>
            {formatDashboardCopy(copy.overview.missingCompletedAtWarning, { count: missingCompletionCount })}
          </p>
          <Link className="btn btn-sm" href="/jobs?filter=missing_completion_date">
            Fix jobs
          </Link>
        </div>
      ) : null}

      {!error && canAccessFinancials(role, plan) ? <BusinessPerformanceSection /> : null}

      {!loading && !error && limitsForPlan(plan).advancedReporting && summary && !hasData ? (
        <div style={{ marginTop: 18 }}>
          <LocalizedEmptyState emptyKey="analytics" />
        </div>
      ) : null}

      {limitsForPlan(plan).advancedReporting && summary && hasData ? (
        <details className="card" style={{ marginTop: 18 }}>
          <summary><strong>More reports</strong></summary>
          <div className="charts-grid" style={{ marginTop: 18 }}>
            <SimpleBarChart title={t('analytics.adoption')} points={summary.adoptionMetrics} />
            <SimpleBarChart title={t('analytics.growth')} points={summary.growthMetrics} />
            <SimpleBarChart title={t('analytics.usage')} points={summary.usageMetrics} />
          </div>
        </details>
      ) : null}
    </AppShell>
  );
}
