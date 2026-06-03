'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
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

export default function NotificationsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    setPlan(normalizePlan(profile?.plan));

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    load();
  }

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <h2>Notifications</h2>
        <div className="card" style={{ marginTop: 18 }}>
          {loading && <p>Loading...</p>}
          {!loading && items.length === 0 && <p>No notifications yet.</p>}
          {items.map((n) => (
            <div key={n.id} className="list-row">
              <div>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <span className="muted">{n.type}</span>
              </div>
              <div className="inline-actions">
                {n.related_job_id && (
                  <Link className="btn" href={`/jobs/${n.related_job_id}`}>
                    View job
                  </Link>
                )}
                {!n.read_at && (
                  <button type="button" className="btn" onClick={() => markRead(n.id)}>
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
