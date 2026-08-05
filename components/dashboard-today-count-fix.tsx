'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { formatLocalDate } from '@/lib/schedule-times';
import { supabase } from '@/lib/supabase';

const FINISHED_STATUSES = new Set(['completed', 'complete', 'done', 'cancelled', 'canceled', 'closed']);

function jobDate(job: { scheduled_start?: string | null; start_date?: string | null }) {
  return (job.scheduled_start || '').slice(0, 10) || (job.start_date || '').slice(0, 10) || '';
}

export function DashboardTodayCountFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/dashboard') return;
    let cancelled = false;

    async function correctCount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const workspace = await ensureOrganizationForUser(user.id);
      const organizationId = workspace?.organizationId || null;
      const query = supabase
        .from('jobs')
        .select('status, scheduled_start, start_date')
        .limit(5000);
      const result = organizationId
        ? await query.eq('organization_id', organizationId)
        : await query.eq('user_id', user.id);
      if (result.error || cancelled) return;

      const today = formatLocalDate(new Date());
      const count = (result.data || []).filter((job: { status?: string | null; scheduled_start?: string | null; start_date?: string | null }) => {
        const status = String(job.status || '').toLowerCase();
        return !FINISHED_STATUSES.has(status) && jobDate(job) === today;
      }).length;

      const labels = Array.from(document.querySelectorAll<HTMLElement>('.dashboard-revenue-metric-label'));
      const todayLabel = labels.find((label) => {
        const text = label.textContent?.trim().toLowerCase();
        return text === "today's jobs" || text === 'jobs today' || text === 'trabajos de hoy' || text === 'công việc hôm nay';
      });
      const card = todayLabel?.closest('.dashboard-revenue-metric');
      const value = card?.querySelector<HTMLElement>('.dashboard-revenue-metric-value');
      if (value) value.textContent = String(count);
    }

    const timer = window.setTimeout(() => void correctCount(), 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
