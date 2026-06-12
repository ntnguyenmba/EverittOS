'use client';

import { useCallback, useMemo } from 'react';
import { errorFeedback, readApiError, type ActionFeedback } from '@/lib/action-messages';
import { FEEDBACK, type FeedbackLabelKey } from '@/lib/feedback-labels';
import { useToastContext, type ToastKind } from '@/components/feedback/toast-provider';

export function useAppFeedback() {
  const { push } = useToastContext();

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      push({ kind, message });
    },
    [push]
  );

  const success = useCallback(
    (message: string = FEEDBACK.saved) => {
      push({ kind: 'success', message });
    },
    [push]
  );

  const error = useCallback(
    (raw: string | null | undefined, fallback = 'Something went wrong. Try again.') => {
      push({ kind: 'error', message: errorFeedback(raw, fallback).message });
    },
    [push]
  );

  const info = useCallback(
    (message: string) => {
      push({ kind: 'info', message });
    },
    [push]
  );

  const label = useCallback(
    (key: FeedbackLabelKey) => {
      push({ kind: 'success', message: FEEDBACK[key] });
    },
    [push]
  );

  const fromActionFeedback = useCallback(
    (feedback: ActionFeedback | null | undefined) => {
      if (!feedback) return;
      push({ kind: feedback.kind, message: feedback.message });
    },
    [push]
  );

  const apiError = useCallback(
    async (res: Response, fallback = 'Request failed.') => {
      const message = await readApiError(res, fallback);
      push({ kind: 'error', message });
      return message;
    },
    [push]
  );

  return useMemo(
    () => ({
      show,
      success,
      error,
      info,
      label,
      saved: () => label('saved'),
      updated: () => label('updated'),
      created: () => label('created'),
      deleted: () => label('deleted'),
      sent: () => label('sent'),
      submitted: () => label('submitted'),
      connected: () => label('connected'),
      disconnected: () => label('disconnected'),
      uploadComplete: () => label('uploadComplete'),
      syncComplete: () => label('syncComplete'),
      fromActionFeedback,
      apiError,
      FEEDBACK
    }),
    [show, success, error, info, label, fromActionFeedback, apiError]
  );
}
