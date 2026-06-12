'use client';

import { useCallback, useRef, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { readApiError } from '@/lib/action-messages';
import { FEEDBACK, type FeedbackLabelKey } from '@/lib/feedback-labels';
import { logClientActivity } from '@/lib/activity';

type ActivityLogConfig = {
  organizationId: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  message: string;
  metadata?: Record<string, unknown>;
};

type UseAsyncActionOptions = {
  successMessage?: string | FeedbackLabelKey;
  errorFallback?: string;
  busyLabel?: string;
  onSuccess?: () => void | Promise<void>;
  onError?: (message: string) => void;
  activity?: ActivityLogConfig;
};

function resolveSuccessMessage(input?: string | FeedbackLabelKey): string {
  if (!input) return FEEDBACK.saved;
  if (input in FEEDBACK) return FEEDBACK[input as FeedbackLabelKey];
  return input;
}

export function useAsyncAction(options: UseAsyncActionOptions = {}) {
  const feedback = useAppFeedback();
  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(false);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      setBusy(true);
      try {
        const result = await action();
        const message = resolveSuccessMessage(options.successMessage);
        feedback.success(message);
        if (options.activity) {
          await logClientActivity(
            options.activity.organizationId,
            options.activity.entityType,
            options.activity.entityId ?? null,
            options.activity.action,
            options.activity.message,
            options.activity.metadata
          );
        }
        await options.onSuccess?.();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : typeof err === 'string' ? err : options.errorFallback || 'Request failed.';
        feedback.error(message, options.errorFallback);
        options.onError?.(message);
        return null;
      } finally {
        inFlightRef.current = false;
        setBusy(false);
      }
    },
    [feedback, options]
  );

  const runResponse = useCallback(
    async (request: () => Promise<Response>, successMessage?: string | FeedbackLabelKey) => {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      setBusy(true);
      try {
        const res = await request();
        if (!res.ok) {
          const message = await readApiError(res, options.errorFallback || 'Request failed.');
          throw new Error(message);
        }
        feedback.success(resolveSuccessMessage(successMessage ?? options.successMessage));
        await options.onSuccess?.();
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : options.errorFallback || 'Request failed.';
        feedback.error(message, options.errorFallback);
        options.onError?.(message);
        return null;
      } finally {
        inFlightRef.current = false;
        setBusy(false);
      }
    },
    [feedback, options]
  );

  const buttonLabel = useCallback(
    (idleLabel: string, activeLabel = options.busyLabel || FEEDBACK.loading) => (busy ? activeLabel : idleLabel),
    [busy, options.busyLabel]
  );

  return {
    busy,
    run,
    runResponse,
    buttonLabel,
    buttonProps: {
      disabled: busy,
      'aria-busy': busy
    } as const
  };
}
