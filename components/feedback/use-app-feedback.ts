'use client';

import { useCallback, useMemo } from 'react';
import { errorFeedback, readApiError, type ActionFeedback } from '@/lib/action-messages';
import { type FeedbackLabelKey } from '@/lib/feedback-labels';
import { useToastContext, type ToastKind } from '@/components/feedback/toast-provider';
import { useTranslation } from '@/components/locale-provider';

export function useAppFeedback() {
  const { push } = useToastContext();
  const { t } = useTranslation();

  const feedbackMessage = useCallback(
    (key: FeedbackLabelKey) => t(`feedback.${key}`),
    [t]
  );

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      push({ kind, message });
    },
    [push]
  );

  const success = useCallback(
    (message?: string) => {
      push({ kind: 'success', message: message ?? feedbackMessage('saved') });
    },
    [push, feedbackMessage]
  );

  const error = useCallback(
    (raw: string | null | undefined, fallback?: string) => {
      push({ kind: 'error', message: errorFeedback(raw, fallback ?? t('feedback.genericError')).message });
    },
    [push, t]
  );

  const info = useCallback(
    (message: string) => {
      push({ kind: 'info', message });
    },
    [push]
  );

  const label = useCallback(
    (key: FeedbackLabelKey) => {
      push({ kind: 'success', message: feedbackMessage(key) });
    },
    [push, feedbackMessage]
  );

  const fromActionFeedback = useCallback(
    (feedback: ActionFeedback | null | undefined) => {
      if (!feedback) return;
      push({ kind: feedback.kind, message: feedback.message });
    },
    [push]
  );

  const apiError = useCallback(
    async (res: Response, fallback?: string) => {
      const message = await readApiError(res, fallback ?? t('feedback.requestFailed'));
      push({ kind: 'error', message });
      return message;
    },
    [push, t]
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
      feedbackMessage
    }),
    [show, success, error, info, label, fromActionFeedback, apiError, feedbackMessage]
  );
}
