'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { appUrl } from '@/lib/app-url';
import { limitsForPlan } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { JobEmailComposer } from '@/components/job-email-composer';

type AccessRow = { client_user_id: string; portal_token: string | null; granted_at: string | null; email: string | null };
type Props = { jobId: string; plan: EverittosPlan; canManage: boolean; customerName?: string | null; customerEmail?: string | null; onCustomerEmailChange?: (email: string) => void; onSaveCustomerEmail?: (email: string) => Promise<boolean> | boolean };

export function ClientAccessPanel({ jobId, plan, canManage, customerName = null, customerEmail = null, onCustomerEmailChange, onSaveCustomerEmail }: Props) {
  const [emailDraft, setEmailDraft] = useState(customerEmail || '');
  const [accessRows, setAccessRows] = useState<AccessRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [reviewUrl, setReviewUrl] = useState('');
  const portalAllowed = limitsForPlan(plan).clientPortal;
  const normalizedCustomerEmail = (customerEmail || '').trim();

  const loadAccess = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const res = await fetch(`/api/clients/access-status?jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
      const json = (await res.json()) as { access?: AccessRow[]; error?: string };
      if (!res.ok) { setAccessRows([]); setMessage(json.error || 'Unable to load customer portal status.'); return; }
      setAccessRows(json.access || []);
    } catch { setAccessRows([]); setMessage('Unable to load customer portal status.'); }
    finally { setLoadingAccess(false); }
  }, [jobId]);

  useEffect(() => { setEmailDraft(customerEmail || ''); }, [customerEmail]);
  useEffect(() => { if (portalAllowed) void loadAccess(); }, [loadAccess, portalAllowed]);
  useEffect(() => {
    if (!canManage) return;
    void (async () => {
      const [settingsRes, jobRes] = await Promise.all([
        fetch('/api/settings/reviews', { cache: 'no-store' }),
        fetch(`/api/jobs/${jobId}`, { cache: 'no-store' })
      ]);
      const settings = (await settingsRes.json().catch(() => ({}))) as { reviewUrl?: string };
      const jobJson = (await jobRes.json().catch(() => ({}))) as { job?: { status?: string | null }; status?: string | null };
      if (settingsRes.ok) setReviewUrl(settings.reviewUrl || '');
      const status = jobJson.job?.status || jobJson.status || '';
      setJobCompleted(status === 'completed');
    })();
  }, [canManage, jobId]);

  async function grantAccess(emailValue: string) {
    if (!emailValue.trim() || busy) return;
    setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/clients/grant-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailValue.trim(), jobId }) });
      const json = await res.json();
      if (!res.ok) { setMessage(json.error || 'Unable to enable client access.'); return; }
      setMessage(json.message || 'Client access enabled.'); await loadAccess();
    } catch { setMessage('Unable to enable customer portal access.'); }
    finally { setBusy(false); }
  }

  async function revokeAccess(clientUserId: string) {
    if (busy) return; setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/clients/revoke-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, clientUserId }) });
      const json = await res.json(); setMessage(json.message || json.error || 'Updated.'); if (res.ok) await loadAccess();
    } catch { setMessage('Unable to turn off customer portal access.'); }
    finally { setBusy(false); }
  }

  async function copyLink(token: string | null) {
    if (!token) { setMessage('The portal link is not available yet.'); return; }
    try { await navigator.clipboard.writeText(appUrl(`/portal/client?token=${token}`)); setMessage('Portal link copied.'); }
    catch { setMessage('Unable to copy the portal link.'); }
  }

  async function saveEmailAndEnable() {
    if (!canManage || busy) return;
    const nextEmail = emailDraft.trim(); onCustomerEmailChange?.(nextEmail);
    if (onSaveCustomerEmail && !(await onSaveCustomerEmail(nextEmail))) return;
    await grantAccess(nextEmail);
  }

  const primaryAccess = accessRows.find((row) => (row.email || '').toLowerCase() === normalizedCustomerEmail.toLowerCase()) || accessRows[0] || null;
  const reviewBody = `Hi ${customerName || 'there'},\n\nThank you for choosing us. If you have a moment, we would appreciate your review:\n${reviewUrl}\n\nThank you.`;

  return (
    <div>
      {canManage && jobCompleted ? (
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0 }}>Customer review</h3>
          {!normalizedCustomerEmail ? <p className="muted">Add a customer email before asking for a review.</p> : !reviewUrl ? <><p className="muted">Add your Google, Facebook, or website review link before sending.</p><Link className="btn" href={`/settings/reviews?jobId=${encodeURIComponent(jobId)}`}>Set review link</Link></> : <JobEmailComposer buttonLabel="Ask for review" recipientEmail={normalizedCustomerEmail} recipientName={customerName} jobId={jobId} docType="review" defaultSubject="Thank you for choosing us" defaultBody={reviewBody} metadata={{ review_url: reviewUrl }} />}
        </div>
      ) : null}

      <h3 style={{ marginTop: 0 }}>Customer portal</h3>
      {!portalAllowed ? <p className="muted">Customer portal access requires the Growth plan or higher.</p> : null}
      {portalAllowed && loadingAccess ? <p className="muted">Checking client access...</p> : null}
      {portalAllowed && !loadingAccess && primaryAccess ? <div className="list-row"><div><strong>Client access enabled</strong><p className="muted" style={{ margin: '4px 0 0' }}>{customerName || 'Customer'} can view this job online.</p><p className="muted" style={{ margin: '4px 0 0' }}>{primaryAccess.email || normalizedCustomerEmail || 'Email on file'}</p></div><div className="inline-actions"><button type="button" className="btn" disabled={!primaryAccess.portal_token} onClick={() => void copyLink(primaryAccess.portal_token)}>Copy portal link</button>{canManage ? <button type="button" className="btn" disabled={busy} onClick={() => void revokeAccess(primaryAccess.client_user_id)}>{busy ? 'Updating...' : 'Turn off access'}</button> : null}</div></div> : null}
      {portalAllowed && !loadingAccess && !primaryAccess && normalizedCustomerEmail ? <div><strong>Client access not enabled</strong><p className="muted" style={{ marginTop: 6 }}>{normalizedCustomerEmail}</p>{canManage ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void grantAccess(normalizedCustomerEmail)}>{busy ? 'Enabling...' : 'Enable client access'}</button> : null}</div> : null}
      {portalAllowed && !loadingAccess && !primaryAccess && !normalizedCustomerEmail ? <div><strong>No customer email available</strong><p className="muted">Add a customer email later if you want to enable portal access. This does not block the job.</p>{canManage ? <div className="inline-actions"><input className="input" type="email" placeholder="Customer email" value={emailDraft} onChange={(event) => { setEmailDraft(event.target.value); onCustomerEmailChange?.(event.target.value); }} /><button type="button" className="btn btn-primary" disabled={busy || !emailDraft.trim()} onClick={() => void saveEmailAndEnable()}>{busy ? 'Enabling...' : 'Add email and enable access'}</button></div> : null}</div> : null}
      {message ? <p>{message}</p> : null}
    </div>
  );
}
