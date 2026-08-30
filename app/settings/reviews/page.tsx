'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { supabase } from '@/lib/supabase';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

export default function ReviewSettingsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [reviewUrl, setReviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login?next=/settings/reviews'); return; }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const nextRole = normalizeRole(profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(nextRole);
      if (!isManagerRole(nextRole)) { setDenied(true); setLoading(false); return; }
      const res = await fetch('/api/settings/reviews', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { reviewUrl?: string; error?: string };
      if (res.status === 401) { router.replace('/login?next=/settings/reviews'); return; }
      if (res.status === 403) { setDenied(true); setLoading(false); return; }
      if (res.ok) setReviewUrl(json.reviewUrl || '');
      else setMessage(json.error || 'Unable to load the recommendation link.');
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    if (saving || denied) return;
    setSaving(true); setMessage('');
    const res = await fetch('/api/settings/reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewUrl }) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    setMessage(res.ok ? 'Recommendation link saved.' : json.error || 'Unable to save recommendation link.');
  }

  return (
    <SettingsShell plan={plan} role={role} title="Customer recommendations" description="Tell customers where to leave a review after a finished job.">
      {denied ? <section className="settings-card"><p>Only the owner or a manager can set the recommendation link.</p></section> : (
        <section className="settings-card form">
          <h3>Ask for recommendation here</h3>
          <p className="muted">Paste your Google, Facebook, or website review page. After a job is finished, use Ask for review on the job to email this link to the customer. Workers cannot change this link.</p>
          <label htmlFor="review-url">Ask for recommendation here</label>
          <input id="review-url" className="input" type="url" inputMode="url" placeholder="https://..." value={reviewUrl} disabled={loading || saving} onChange={(event) => setReviewUrl(event.target.value)} />
          <button type="button" className="btn btn-primary" disabled={loading || saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save recommendation link'}</button>
          {message ? <p>{message}</p> : null}
        </section>
      )}
    </SettingsShell>
  );
}
