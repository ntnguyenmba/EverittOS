'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { useTranslation } from '@/components/locale-provider';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

type DuplicateSeries = { jobId: string; date: string; title: string; address: string };

const copy = {
  en: {
    title: 'Duplicate cleanup', back: 'Back to jobs', checking: 'Checking recurring jobs…', none: 'No duplicate recurring series found.', found: 'duplicate recurring series found', remove: 'Remove duplicates', removing: 'Removing…', confirm: 'This will remove the duplicate recurring series and its future visits while keeping the original series. Continue?', failed: 'Unable to check duplicate jobs.', done: 'Duplicate recurring jobs removed.'
  },
  es: {
    title: 'Limpieza de duplicados', back: 'Volver a trabajos', checking: 'Revisando trabajos recurrentes…', none: 'No se encontraron series recurrentes duplicadas.', found: 'series recurrentes duplicadas encontradas', remove: 'Eliminar duplicados', removing: 'Eliminando…', confirm: 'Esto eliminará la serie recurrente duplicada y sus visitas futuras, conservando la serie original. ¿Continuar?', failed: 'No se pudieron revisar los trabajos duplicados.', done: 'Se eliminaron los trabajos recurrentes duplicados.'
  },
  vi: {
    title: 'Dọn công việc trùng', back: 'Quay lại công việc', checking: 'Đang kiểm tra công việc định kỳ…', none: 'Không tìm thấy chuỗi công việc định kỳ bị trùng.', found: 'chuỗi công việc định kỳ bị trùng', remove: 'Xóa bản trùng', removing: 'Đang xóa…', confirm: 'Thao tác này sẽ xóa chuỗi định kỳ bị trùng và các lần hẹn tương lai, đồng thời giữ lại chuỗi gốc. Tiếp tục?', failed: 'Không thể kiểm tra công việc bị trùng.', done: 'Đã xóa các công việc định kỳ bị trùng.'
  }
} as const;

export default function DuplicateCleanupPage() {
  const { locale } = useTranslation();
  const c = copy[locale];
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [items, setItems] = useState<DuplicateSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      const org = await fetchOrganizationContext(user.id);
      setRole(normalizeRole(org?.role || profile?.role));
      const res = await fetch('/api/jobs/duplicate-series', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { duplicateSeries?: DuplicateSeries[]; error?: string };
      if (!res.ok) throw new Error(json.error || c.failed);
      setItems(json.duplicateSeries || []);
    } catch (error) {
      appFeedback.error(error instanceof Error ? error.message : c.failed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const countLabel = useMemo(() => `${items.length} ${c.found}`, [items.length, c.found]);

  async function removeDuplicates() {
    if (!items.length || !window.confirm(c.confirm)) return;
    setRemoving(true);
    try {
      for (const item of items) {
        const res = await fetch(`/api/jobs/${item.jobId}`, { method: 'DELETE' });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || c.failed);
      }
      appFeedback.success(c.done);
      await load();
    } catch (error) {
      appFeedback.error(error instanceof Error ? error.message : c.failed);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <AppShell plan={plan} role={role}>
      <div className="page-stack">
        <PageHeader title={c.title} action={<Link className="btn btn-secondary" href="/jobs">{c.back}</Link>} />
        {loading ? <p className="muted">{c.checking}</p> : null}
        {!loading && items.length === 0 ? <div className="card"><p>{c.none}</p></div> : null}
        {!loading && items.length > 0 ? (
          <div className="card">
            <p><strong>{countLabel}</strong></p>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {items.map((item) => (
                <div key={item.jobId} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <strong>{item.date} · {item.title}</strong>
                  <div className="muted">{item.address || '—'}</div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-danger" style={{ marginTop: 18 }} disabled={removing} onClick={() => void removeDuplicates()}>
              {removing ? c.removing : c.remove}
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
