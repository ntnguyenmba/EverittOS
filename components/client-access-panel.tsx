'use client';

import { useCallback, useEffect, useState } from 'react';
import { appUrl } from '@/lib/app-url';
import { limitsForPlan } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';

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
  customerName?: string | null;
  customerEmail?: string | null;
  onCustomerEmailChange?: (email: string) => void;
  onSaveCustomerEmail?: (email: string) => Promise<boolean> | boolean;
};

export function ClientAccessPanel({
  jobId,
  plan,
  canManage,
  customerName = null,
  customerEmail = null,
  onCustomerEmailChange,
  onSaveCustomerEmail
}: ClientAccessPanelProps) {
  const [emailDraft, setEmailDraft] = useState(customerEmail || '');
  const [accessRows, setAccessRows] = useState<AccessRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);

  const portalAllowed = limitsForPlan(plan).clientPortal;
  const normalizedCustomerEmail = (customerEmail || '').trim();

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
        setMessage(json.error || 'Unable to load customer portal status.');
        return;
      }
      setAccessRows(json.access || []);
    } catch {
      setAccessRows([]);
      setMessage('Unable to load customer portal status.');
    } finally {
      setLoadingAccess(false);
    }
  }, [jobId]);

  useEffect(() => {
    setEmailDraft(customerEmail || '');
  }, [customerEmail]);

  useEffect(() => {
    if (portalAllowed) void loadAccess();
  }, [loadAccess, portalAllowed]);

  async function grantAccess(emailValue: string) {
    if (!emailValue.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/clients/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue.trim(), jobId })
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || 'Unable to send invite.');
        return;
      }
      setMessage(json.message || 'Invite sent.');
      await loadAccess();
    } catch {
      setMessage('Unable to send invite.');
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
      setMessage('Unable to turn off customer portal access.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(token: string | null) {
    if (!token) {
      setMessage('The portal link is not available yet.');
      return;
    }
    try {
      const url = appUrl(`/portal/client?token=${token}`);
      await navigator.clipboard.writeText(url);
      setMessage('Portal link copied.');
    } catch {
      setMessage('Unable to copy the portal link.');
    }
  }

  async function saveEmailAndEnable() {
    if (!canManage || busy) return;
    const nextEmail = emailDraft.trim();
    onCustomerEmailChange?.(nextEmail);
    if (onSaveCustomerEmail) {
      const saved = await onSaveCustomerEmail(nextEmail);
      if (!saved) return;
    }
    await grantAccess(nextEmail);
  }

  if (!portalAllowed) {
    return (
      <div>
        <h3 style={{ marginTop: 0 }}>Customer portal</h3>
        <p className="muted">Customer portal access requires the Growth plan or higher.</p>
      </div>
    );
  }

  const primaryAccess =
    accessRows.find((row) => (row.email || '').toLowerCase() === normalizedCustomerEmail.toLowerCase()) ||
    accessRows[0] ||
    null;

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Customer portal</h3>

      {loadingAccess ? <p className="muted">Checking status...</p> : null}

      {!loadingAccess && primaryAccess ? (
        <div className="list-row">
          <div>
            <strong>Status: Active</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {customerName || 'Customer'} can view this job online.
            </p>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {primaryAccess.email || normalizedCustomerEmail || 'Email on file'}
            </p>
          </div>
          <div className="inline-actions">
            <button type="button" className="btn" disabled={!primaryAccess.portal_token} onClick={() => void copyLink(primaryAccess.portal_token)}>
              Copy portal link
            </button>
            {canManage ? (
              <button type="button" className="btn" disabled={busy} onClick={() => void revokeAccess(primaryAccess.client_user_id)}>
                {busy ? 'Updating...' : 'Turn off access'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loadingAccess && !primaryAccess && normalizedCustomerEmail ? (
        <div>
          <strong>Status: Not invited</strong>
          <p className="muted" style={{ marginTop: 6 }}>
            This customer cannot sign in yet. Send an invite so they can view jobs, photos, invoices, and receipts.
          </p>
          <p className="muted">{normalizedCustomerEmail}</p>
          {canManage ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void grantAccess(normalizedCustomerEmail)}>
              {busy ? 'Sending...' : 'Send invite'}
            </button>
          ) : null}
        </div>
      ) : null}

      {!loadingAccess && !primaryAccess && !normalizedCustomerEmail ? (
        <div>
          <strong>Status: Email needed</strong>
          <p className="muted" style={{ marginTop: 6 }}>
            Add the customer email to send a portal invite. This does not block the job.
          </p>
          {canManage ? (
            <div className="inline-actions" style={{ marginTop: 8 }}>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="Customer email"
                value={emailDraft}
                onChange={(event) => {
                  setEmailDraft(event.target.value);
                  onCustomerEmailChange?.(event.target.value);
                }}
              />
              <button type="button" className="btn btn-primary" disabled={busy || !emailDraft.trim()} onClick={() => void saveEmailAndEnable()}>
                {busy ? 'Sending...' : 'Save and send invite'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {accessRows.length > 1
        ? accessRows
            .filter((row) => row.client_user_id !== primaryAccess?.client_user_id)
            .map((row) => (
              <div key={row.client_user_id} className="list-row">
                <div>
                  <strong>{row.email || row.client_user_id}</strong>
                </div>
                <div className="inline-actions">
                  <button type="button" className="btn" disabled={!row.portal_token} onClick={() => void copyLink(row.portal_token)}>
                    Copy portal link
                  </button>
                  {canManage ? (
                    <button type="button" className="btn" disabled={busy} onClick={() => void revokeAccess(row.client_user_id)}>
                      Remove access
                    </button>
                  ) : null}
                </div>
              </div>
            ))
        : null}

      {message ? <p>{message}</p> : null}
    </div>
  );
}
