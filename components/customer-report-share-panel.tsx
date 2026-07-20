'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { getJobFinanceCopy } from '@/lib/i18n/job-finance-copy';

type CustomerReportSharePanelProps = {
  jobId: string;
  canManage: boolean;
};

export function CustomerReportSharePanel({ jobId, canManage }: CustomerReportSharePanelProps) {
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const copy = getJobFinanceCopy(locale);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadShare = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/jobs/${jobId}/customer-report`);
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return;
    setShareUrl(json.shareUrl || null);
    setRevoked(Boolean(json.revoked));
    setCompletionNotes(json.customerCompletionNotes || '');
  }, [jobId]);

  useEffect(() => {
    void loadShare();
  }, [loadShare]);

  async function postAction(action: 'share' | 'revoke' | 'regenerate') {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/jobs/${jobId}/customer-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        locale,
        customer_completion_notes: completionNotes
      })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      appFeedback.error(json.error || copy.reportNotAvailable);
      return;
    }

    if (action === 'revoke') {
      setShareUrl(null);
      setRevoked(true);
      appFeedback.success(copy.shareLinkRevoked);
      return;
    }

    setShareUrl(json.share?.shareUrl || null);
    setRevoked(false);
    if (action === 'regenerate') {
      appFeedback.success(copy.shareLinkCopied);
    }
  }

  async function copyLink() {
    if (!shareUrl || typeof navigator === 'undefined' || !navigator.clipboard) {
      appFeedback.error(copy.reportNotAvailable);
      return;
    }
    const absolute = `${window.location.origin}${shareUrl}`;
    await navigator.clipboard.writeText(absolute);
    appFeedback.success(copy.shareLinkCopied);
  }

  function printPreview() {
    if (!shareUrl || typeof window === 'undefined') return;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }

  if (loading) {
    return <p className="loading-state">{copy.loading}</p>;
  }

  return (
    <div className="customer-report-share-panel">
      <p className="muted">{copy.customerReportShareHelper}</p>
      <p className="muted">{copy.photoVisibilityHelper}</p>

      {canManage ? (
        <div className="finance-form-block compact-finance-form">
          <label htmlFor={`customer-notes-${jobId}`}>{copy.customerCompletionNotes}</label>
          <textarea
            id={`customer-notes-${jobId}`}
            className="input"
            rows={3}
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
          />
        </div>
      ) : completionNotes ? (
        <p>{completionNotes}</p>
      ) : null}

      <div className="button-row customer-report-actions">
        {shareUrl && !revoked ? (
          <>
            <Link className="btn" href={shareUrl} target="_blank" rel="noopener noreferrer">
              {copy.previewCustomerReport}
            </Link>
            <button type="button" className="btn" disabled={busy} onClick={() => void copyLink()}>
              {copy.copyShareLink}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={printPreview}>
              {copy.printReport}
            </button>
            {canManage ? (
              <>
                <button type="button" className="btn" disabled={busy} onClick={() => void postAction('regenerate')}>
                  {busy ? FEEDBACK.loading : copy.regenerateLink}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void postAction('revoke')}>
                  {copy.revokeLink}
                </button>
              </>
            ) : null}
          </>
        ) : canManage ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void postAction('share')}>
            {busy ? FEEDBACK.loading : copy.copyShareLink}
          </button>
        ) : (
          <p className="muted">{copy.reportNotAvailable}</p>
        )}
      </div>
    </div>
  );
}
