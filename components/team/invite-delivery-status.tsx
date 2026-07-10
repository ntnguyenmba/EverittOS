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

    const interceptedFetch = async (input: unknown, init?: RequestInit): Promise<Response> => {
      const response = await originalFetch(input as RequestInfo | URL, init);
      const target =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input instanceof Request
              ? input.url
              : '';
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

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
          // Keep the original response unchanged for the Team screen.
        }
      }

      return response;
    };

    window.fetch = interceptedFetch as typeof window.fetch;

    return () => {
      window.fetch = originalFetch as typeof window.fetch;
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
      <p>
        {result.message ||
          (sent
            ? 'The invitation email was sent successfully.'
            : 'The invitation was created, but the email was not sent.')}
      </p>
      <p className="muted">
        {result.nextAction ||
          (sent
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
