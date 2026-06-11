'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { friendlyErrorMessage } from '@/lib/user-errors';
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

  async function load() {
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
    setPlan(normalizePlan(profile?.plan));
    setRole(normalizeRole(profile?.role));

    const res = await fetch('/api/notifications');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || 'Unable to load notifications.');
      return;
    }
    setItems(json.notifications || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    setBusy(true);
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setBusy(false);
    load();
  }

  async function markAllRead() {
    setBusy(true);
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true })
    });
    setBusy(false);
    load();
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

      <div className="card" style={{ marginTop: 18 }}>
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
          <EmptyState
            title="No notifications yet"
            description="You'll see job assignments, report submissions, and team updates here."
          />
        ) : null}
        {items.map((n) => (
          <div key={n.id} className={`list-row${!n.read_at ? ' list-row-unread' : ''}`}>
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
                <button type="button" className="btn" disabled={busy} onClick={() => markRead(n.id)}>
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
