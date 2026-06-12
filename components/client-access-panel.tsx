'use client';

import { useEffect, useState } from 'react';
import { appUrl } from '@/lib/app-url';
import { limitsForPlan } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';

type AccessRow = {
  client_user_id: string;
  portal_token: string | null;
  granted_at: string | null;
  profiles?: { email: string | null } | null;
};

type ClientAccessPanelProps = {
  jobId: string;
  plan: EverittosPlan;
  canManage: boolean;
};

export function ClientAccessPanel({ jobId, plan, canManage }: ClientAccessPanelProps) {
  const [email, setEmail] = useState('');
  const [accessRows, setAccessRows] = useState<AccessRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const portalAllowed = limitsForPlan(plan).clientPortal;

  async function loadAccess() {
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase
      .from('job_client_access')
      .select('client_user_id, portal_token, granted_at, profiles:profiles(email)')
      .eq('job_id', jobId);
    setAccessRows(
      (data || []).map((row: {
        client_user_id: string;
        portal_token: string | null;
        granted_at: string | null;
        profiles: { email: string | null } | { email: string | null }[] | null;
      }) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          client_user_id: row.client_user_id as string,
          portal_token: (row.portal_token as string | null) || null,
          granted_at: row.granted_at as string | null,
          profiles: profile ? { email: (profile as { email: string | null }).email } : null
        };
      })
    );
  }

  useEffect(() => {
    if (portalAllowed) loadAccess();
  }, [jobId, portalAllowed]);

  async function grantAccess() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/clients/grant-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), jobId })
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error || 'Unable to grant access.');
      return;
    }
    setMessage(json.message + (json.acceptUrl ? ` Link: ${json.acceptUrl}` : ''));
    setEmail('');
    loadAccess();
  }

  async function revokeAccess(clientUserId: string) {
    setBusy(true);
    const res = await fetch('/api/clients/revoke-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, clientUserId })
    });
    const json = await res.json();
    setBusy(false);
    setMessage(json.message || json.error || 'Updated.');
    loadAccess();
  }

  function copyLink(token: string | null) {
    if (!token) return;
    const url = appUrl(`/portal/client?token=${token}`);
    navigator.clipboard.writeText(url);
    setMessage('Client portal link copied.');
  }

  if (!portalAllowed) {
    return (
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Client access</h3>
        <p className="muted">Client portal access requires Operations plan or higher.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3>Client access</h3>
      {canManage ? (
        <div className="inline-actions">
          <input className="input" placeholder="Client email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={grantAccess}>
            Grant client access
          </button>
        </div>
      ) : (
        <p className="muted">Only managers can grant client access.</p>
      )}

      {accessRows.length === 0 ? <p className="muted">No clients have access to this job yet.</p> : null}
      {accessRows.map((row) => (
        <div key={row.client_user_id} className="list-row">
          <div>
            <strong>{row.profiles?.email || row.client_user_id}</strong>
            <p className="muted">Granted {row.granted_at ? new Date(row.granted_at).toLocaleString() : 'recently'}</p>
          </div>
          <div className="inline-actions">
            <button type="button" className="btn" onClick={() => copyLink(row.portal_token)}>
              Copy client link
            </button>
            {canManage ? (
              <button type="button" className="btn" disabled={busy} onClick={() => revokeAccess(row.client_user_id)}>
                Revoke
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {message ? <p>{message}</p> : null}
    </div>
  );
}
