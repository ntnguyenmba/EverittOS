'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanLockedMessage } from '@/components/plan-locked-message';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export default function ApiSettingsPage() {
  const router = useRouter();
  const createAction = useAsyncAction({ successMessage: 'Copy this key now. It will not be shown again.' });
  const revokeAction = useAsyncAction({ successMessage: 'deleted' });
  const busy = createAction.busy || revokeAction.busy;
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState('');
  const [rawKey, setRawKey] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/settings/api');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const p = normalizePlan(profile?.plan);
    setPlan(p);
    if (!limitsForPlan(p).apiAccess) {
      setLoading(false);
      return;
    }
    const res = await fetch('/api/keys');
    const json = await res.json();
    if (res.ok) setKeys(json.keys || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [router]);

  async function createKey() {
    if (!name.trim() || busy) return;
    setRawKey('');
    await createAction.run(async () => {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to create key.');
      setRawKey(json.rawKey);
      setName('');
      load();
    });
  }

  async function revokeKey(id: string) {
    const res = await revokeAction.runResponse(() => fetch(`/api/keys/${id}`, { method: 'DELETE' }), 'deleted');
    if (res) load();
  }

  if (loading) {
    return (
      <AppShell plan={plan}>
        <p>Loading API settings...</p>
      </AppShell>
    );
  }

  return (
    <SettingsShell plan={plan} title="API access" description="Manage API keys for Growth and Enterprise integrations.">
      {!limitsForPlan(plan).apiAccess ? <PlanLockedMessage feature="API access" requiredPlan="Growth" /> : null}

      {limitsForPlan(plan).apiAccess ? (
        <>
          <div className="settings-card">
            <h3>Create API key</h3>
            <div className="inline-actions">
              <input className="input" placeholder="Key name" value={name} onChange={(e) => setName(e.target.value)} />
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createKey()}>
                {createAction.buttonLabel('Create API key', FEEDBACK.loading)}
              </button>
            </div>
            {rawKey ? (
              <div className="settings-warning" style={{ marginTop: 12 }}>
                <strong>New key (copy now):</strong>
                <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{rawKey}</pre>
              </div>
            ) : null}
          </div>

          <div className="settings-card">
            <h3>Active keys</h3>
            {keys.filter((k) => !k.revoked_at).length === 0 ? <p className="muted">No API keys yet.</p> : null}
            {keys
              .filter((k) => !k.revoked_at)
              .map((key) => (
                <div key={key.id} className="list-row">
                  <div>
                    <strong>{key.name}</strong>
                    <p className="muted">
                      {key.key_prefix}… · Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at ? ` · Last used ${new Date(key.last_used_at).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <button type="button" className="btn" disabled={busy} onClick={() => void revokeKey(key.id)}>
                    Revoke
                  </button>
                </div>
              ))}
          </div>

          <div className="settings-card">
            <h3>API reference</h3>
            <p className="muted">Send Authorization: Bearer YOUR_API_KEY on every request.</p>
            <ul className="plan-feature-list">
              <li>GET /api/v1/jobs</li>
              <li>POST /api/v1/jobs</li>
              <li>GET /api/v1/customers</li>
              <li>GET /api/v1/workers</li>
            </ul>
            <Link href="/docs/api" className="btn">
              Full API docs
            </Link>
          </div>
        </>
      ) : null}
    </SettingsShell>
  );
}
