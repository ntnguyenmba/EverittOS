'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/components/locale-provider';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

const duplicateCleanupPageCopy = {
  en: { subtitle: 'Review and remove duplicate recurring jobs without affecting the originals.' },
  es: { subtitle: 'Revisa y elimina trabajos recurrentes duplicados sin afectar los originales.' },
  vi: { subtitle: 'Kiểm tra và xóa công việc định kỳ trùng lặp mà không ảnh hưởng bản gốc.' }
} as const;

type DuplicateSeries = { jobId: string; date: string; title: string; address: string };

export default function DuplicateCleanupPage() {
  const { t, locale } = useTranslation();
  const pageCopy = duplicateCleanupPageCopy[locale];
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [items, setItems] = useState<DuplicateSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      const org = await fetchOrganizationContext(user.id);
      setRole(normalizeRole(org?.role || profile?.role));
      const res = await fetch('/api/jobs/duplicate-series', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { duplicateSeries?: DuplicateSeries[]; error?: string };
      if (!res.ok) throw new Error(json.error || t('pages.duplicateCleanup.failed'));
      setItems(json.duplicateSeries || []);
    } catch (error) {
      appFeedback.error(error instanceof Error ? error.message : t('pages.duplicateCleanup.failed'));
    } finally {
      setLoading(false);
    }
  }, [appFeedback, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const countLabel = useMemo(
    () => t('pages.duplicateCleanup.found', { count: items.length }),
    [items.length, t]
  );

  async function removeDuplicates() {
    if (!items.length || !window.confirm(t('pages.duplicateCleanup.confirm'))) return;
    setRemoving(true);
    try {
      for (const item of items) {
        const res = await fetch(`/api/jobs/${item.jobId}`, { method: 'DELETE' });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || t('pages.duplicateCleanup.failed'));
      }
      appFeedback.success(t('pages.duplicateCleanup.done'));
      await load();
    } catch (error) {
      appFeedback.error(error instanceof Error ? error.message : t('pages.duplicateCleanup.failed'));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <AppShell plan={plan} role={role}>
      <div className="page-stack">
        <PageHeader
          title={t('pages.duplicateCleanup.title')}
          subtitle={pageCopy.subtitle}
          action={
            <Link className="btn btn-secondary" href="/jobs">
              {t('pages.duplicateCleanup.back')}
            </Link>
          }
        />
        {loading ? <p className="muted">{t('pages.duplicateCleanup.checking')}</p> : null}
        {!loading && items.length === 0 ? (
          <div className="card">
            <p>{t('pages.duplicateCleanup.none')}</p>
          </div>
        ) : null}
        {!loading && items.length > 0 ? (
          <div className="card">
            <p>
              <strong>{countLabel}</strong>
            </p>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {items.map((item) => (
                <div key={item.jobId} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <strong>
                    {item.date} · {item.title}
                  </strong>
                  <div className="muted">{item.address || t('pages.duplicateCleanup.noAddress')}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-danger"
              style={{ marginTop: 18 }}
              disabled={removing}
              onClick={() => void removeDuplicates()}
            >
              {removing ? t('pages.duplicateCleanup.removing') : t('pages.duplicateCleanup.remove')}
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
