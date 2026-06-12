'use client';

import { useEffect, useRef } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import type { ActionFeedback } from '@/lib/action-messages';

type ActionFeedbackBannerProps = {
  feedback: ActionFeedback | null;
  onDismiss?: () => void;
};

/** Bridges legacy inline feedback state to the global toast system. */
export function ActionFeedbackBanner({ feedback, onDismiss }: ActionFeedbackBannerProps) {
  const toast = useAppFeedback();
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!feedback) {
      lastMessageRef.current = null;
      return;
    }

    const key = `${feedback.kind}:${feedback.message}`;
    if (lastMessageRef.current === key) return;
    lastMessageRef.current = key;

    toast.fromActionFeedback(feedback);
    onDismiss?.();
  }, [feedback, onDismiss, toast]);

  return null;
}
