'use client';

import type { ActionFeedback } from '@/lib/action-messages';

type ActionFeedbackBannerProps = {
  feedback: ActionFeedback | null;
  onDismiss?: () => void;
};

export function ActionFeedbackBanner({ feedback, onDismiss }: ActionFeedbackBannerProps) {
  if (!feedback) return null;

  const className =
    feedback.kind === 'success'
      ? 'auth-message auth-message-success action-feedback'
      : feedback.kind === 'info'
        ? 'auth-message action-feedback'
        : 'auth-message auth-message-error action-feedback';

  return (
    <p className={className} role={feedback.kind === 'error' ? 'alert' : 'status'}>
      {feedback.message}
      {onDismiss ? (
        <button type="button" className="action-feedback-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </p>
  );
}
