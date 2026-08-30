'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { EMPTY_COPY } from '@/lib/empty-copy';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  related_job_id: string | null;
  created_at: string | null;
};

function formatWhen(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    setPlan(normalizePlan(profile?.plan));
    setRole(normalizeRole(org?.role || profile?.role));

    const res = await fetch('/api/notifications');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || 'Unable to load notifications.');
      return;
    }
    setItems(json.notifications || []);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    setBusy(true);
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setBusy(false);
    void load();
  }

  async function markAllRead() {
    setBusy(true);
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true })
    });
    setBusy(false);
    void load();
  }

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <AppShell plan={plan} role={role}>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted">Assignments, reports, invites, and billing updates.</p>
        </div>
        {unread > 0 && (
          <button type="button" className="btn" disabled={busy} onClick={markAllRead}>
            Mark all read ({unread})
          </button>
        )}
      </div>

      <section className="notification-feed" style={{ marginTop: 18, display: 'grid', gap: 14 }}>
        {loading ? (
          <p className="loading-state" role="status">
            Loading notifications…
          </p>
        ) : null}
        {error ? (
          <p className="auth-message auth-message-error" role="alert">
            {friendlyErrorMessage(error)}
          </p>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <div className="card">
            <EmptyState title={EMPTY_COPY.notifications.title} description={EMPTY_COPY.notifications.description} />
          </div>
        ) : null}
        {items.map((n) => (
          <article key={n.id} className={`list-row record-card notification-card${!n.read_at ? ' list-row-unread' : ''}`}>
            <div>
              <strong>{n.title}</strong>
              {n.body ? <p>{n.body}</p> : null}
              <p className="muted">
                {n.type} · {formatWhen(n.created_at)}
              </p>
            </div>
            <div className="inline-actions">
              {n.related_job_id && (
                <Link className="btn" href={`/jobs/${n.related_job_id}`}>
                  View job
                </Link>
              )}
              {!n.read_at && (
                <button type="button" className="btn" disabled={busy} onClick={() => void markRead(n.id)}>
                  Mark read
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
