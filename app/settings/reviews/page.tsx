'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ensureOrganizationForUser } from '@/lib/workspace-client';

export default function ReviewSettingsPage() {
  const router = useRouter();
  const [reviewUrl, setReviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login?next=/settings/reviews'); return; }
      const org = await ensureOrganizationForUser(user.id);
      if (org?.organizationId) {
        const { data } = await supabase.from('organization_settings').select('review_url').eq('organization_id', org.organizationId).maybeSingle();
        setReviewUrl(String(data?.review_url || ''));
      }
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    if (saving) return;
    setSaving(true); setMessage('');
    const res = await fetch('/api/settings/workspace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewUrl }) });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setSaving(false);
    setMessage(res.ok ? 'Review link saved.' : json.error || 'Unable to save review link.');
  }

  return (
    <main className="container" style={{ maxWidth: 760, paddingTop: 28, paddingBottom: 48 }}>
      <Link href="/settings" className="btn">Back to Settings</Link>
      <section className="settings-card form" style={{ marginTop: 18 }}>
        <h2 style={{ marginBottom: 0 }}>Customer reviews</h2>
        <p className="muted">Save the review page you want customers to open after a completed job. Google, Facebook, or your own review page can be used.</p>
        <label htmlFor="review-url">Review URL</label>
        <input id="review-url" className="input" type="url" inputMode="url" placeholder="https://..." value={reviewUrl} disabled={loading || saving} onChange={(event) => setReviewUrl(event.target.value)} />
        <button type="button" className="btn btn-primary" disabled={loading || saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save review link'}</button>
        {message ? <p>{message}</p> : null}
      </section>
    </main>
  );
}
