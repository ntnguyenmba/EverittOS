'use client';

import { useCallback, useEffect, useState } from 'react';
import { appUrl } from '@/lib/app-url';
import { fetchOrganizationContext } from '@/lib/organization';
import { limitsForPlan } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { RecordSharingPanel } from '@/components/record-sharing-panel';

type AccessRow = {
  client_user_id: string;
  portal_token: string | null;
  granted_at: string | null;
  email: string | null;
};

type ClientAccessPanelProps = {
  jobId: string;
  plan: EverittosPlan;
  canManage: boolean;
};

export function ClientAccessPanel({ jobId, plan, canManage }: ClientAccessPanelProps) {
  const [email, setEmail] = useState('');
  const [orgId, setOrgId] = useState('');
  const [accessRows, setAccessRows] = useState<AccessRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);

  const portalAllowed = limitsForPlan(plan).clientPortal;

  const loadWorkspace = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const org = await fetchOrganizationContext(user.id);
    setOrgId(org?.organizationId || '');
  }, []);

  const loadAccess = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const res = await fetch(`/api/clients/access-status?jobId=${encodeURIComponent(jobId)}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const json = (await res.json()) as { access?: AccessRow[]; error?: string };
      if (!res.ok) {
        setAccessRows([]);
        setMessage(json.error || 'Unable to load client access.');
        return;
      }
      setAccessRows(json.access || []);
    } catch {
      setAccessRows([]);
      setMessage('Unable to load client access.');
    } finally {
      setLoadingAccess(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadWorkspace();
    if (portalAllowed) void loadAccess();
  }, [loadAccess, loadWorkspace, portalAllowed]);

  async function grantAccess() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/clients/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), jobId })
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || 'Unable to grant access.');
        return;
      }
      setMessage(json.message || 'Client access updated.');
      setEmail('');
      await loadAccess();
    } catch {
      setMessage('Unable to grant access.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeAccess(clientUserId: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/clients/revoke-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, clientUserId })
      });
      const json = await res.json();
      setMessage(json.message || json.error || 'Updated.');
      if (res.ok) await loadAccess();
    } catch {
      setMessage('Unable to revoke client access.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(token: string | null) {
    if (!token) {
      setMessage('This client link is not available yet.');
      return;
    }
    try {
      const url = appUrl(`/portal/client?token=${token}`);
      await navigator.clipboard.writeText(url);
      setMessage('Customer dashboard link copied.');
    } catch {
      setMessage('Unable to copy the client portal link.');
    }
  }

  return (
    <>
      {orgId ? (
        <RecordSharingPanel organizationId={orgId} recordType="job" recordId={jobId} canManage={canManage} />
      ) : null}

      {!portalAllowed ? (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Client access</h3>
          <p className="muted">Customer dashboard access requires Growth plan or higher.</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Client access</h3>
          {canManage ? (
            <div className="inline-actions">
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="Client email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void grantAccess();
                }}
              />
              <button type="button" className="btn btn-primary" disabled={busy || !email.trim()} onClick={grantAccess}>
                {busy ? 'Updating...' : 'Grant client access'}
              </button>
            </div>
          ) : (
            <p className="muted">Only managers can grant client access.</p>
          )}

          {loadingAccess ? <p className="muted">Checking client access...</p> : null}
          {!loadingAccess && accessRows.length === 0 ? (
            <p className="muted">No clients have access to this job yet.</p>
          ) : null}
          {accessRows.map((row) => (
            <div key={row.client_user_id} className="list-row">
              <div>
                <strong>{row.email || row.client_user_id}</strong>
                <p className="muted">
                  Access granted {row.granted_at ? new Date(row.granted_at).toLocaleString() : 'recently'}
                </p>
              </div>
              <div className="inline-actions">
                <button type="button" className="btn" disabled={!row.portal_token} onClick={() => void copyLink(row.portal_token)}>
                  Copy client link
                </button>
                {canManage ? (
                  <button type="button" className="btn" disabled={busy} onClick={() => void revokeAccess(row.client_user_id)}>
                    Revoke
                  </button>
                ) : null}
              </div>
            </div>
          ))}

          {message ? <p>{message}</p> : null}
        </div>
      )}
    </>
  );
}
