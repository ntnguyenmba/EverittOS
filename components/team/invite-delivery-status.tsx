'use client';

import { useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';

type InviteResult = {
  acceptUrl?: string;
  emailSent?: boolean;
  requiresManualSend?: boolean;
  deliveryStatus?: string;
  message?: string;
  nextAction?: string;
  invitationEmail?: string;
};

export function InviteDeliveryStatus() {
  const feedback = useAppFeedback();
  const [result, setResult] = useState<InviteResult | null>(null);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      const target = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : '';
      const method = (args[1]?.method || (args[0] instanceof Request ? args[0].method : 'GET')).toUpperCase();

      if (
        method === 'POST' &&
        (target.includes('/api/team/invite') || target.includes('/api/team/invitations/resend'))
      ) {
        try {
          const json = (await response.clone().json()) as InviteResult;
          if (response.ok && json.acceptUrl) {
            setResult({
              ...json,
              emailSent: Boolean(json.emailSent),
              requiresManualSend: json.requiresManualSend ?? !json.emailSent
            });
          }
        } catch {
          // The original caller still receives the untouched response.
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  async function copyLink() {
    if (!result?.acceptUrl) return;
    try {
      await navigator.clipboard.writeText(result.acceptUrl);
      feedback.success('Invite link copied.');
    } catch {
      feedback.error('Copy the invite link manually.');
    }
  }

  if (!result) return null;

  const sent = result.emailSent && !result.requiresManualSend;

  return (
    <div className="settings-card" role="status" aria-live="polite">
      <h3>{sent ? 'Invitation email sent' : 'Manual action required'}</h3>
      <p>{result.message || (sent ? 'The invitation email was sent successfully.' : 'The invitation was created, but the email was not sent.')}</p>
      <p className="muted">
        {result.nextAction || (sent
          ? 'The invitee should open the email, sign in with the same email address, and accept the invitation.'
          : 'Copy the link below and send it to the invitee manually.')}
      </p>
      {result.acceptUrl ? (
        <div className="invite-link-row">
          <code className="invite-link-code">{result.acceptUrl}</code>
          <button type="button" className="btn btn-sm" onClick={() => void copyLink()}>
            Copy invite link
          </button>
        </div>
      ) : null}
      <button type="button" className="btn" onClick={() => setResult(null)}>
        Dismiss
      </button>
    </div>
  );
}
