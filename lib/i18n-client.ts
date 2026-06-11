'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { AuthErrorResult } from '@/lib/auth-errors';
import { resolveAccessErrorKey, resolveAuthErrorKey } from '@/lib/auth-error-keys';

export function useAuthErrors() {
  const authT = useTranslations('errors.auth');
  const accessT = useTranslations('errors.access');

  const mapAuthError = useCallback(
    (raw: string | null | undefined, fallbackKey?: string): AuthErrorResult => {
      const key = resolveAuthErrorKey(raw, fallbackKey);
      return {
        title: authT(`${key}.title`),
        message: authT(`${key}.message`),
        details: raw || undefined
      };
    },
    [authT]
  );

  const mapAccessError = useCallback(
    (code: string | null | undefined): AuthErrorResult => {
      const key = resolveAccessErrorKey(code);
      return {
        title: accessT(`${key}.title`),
        message: accessT(`${key}.message`),
        details: code || undefined
      };
    },
    [accessT]
  );

  return { mapAuthError, mapAccessError };
}

export function useEmptyCopy() {
  const t = useTranslations('empty');

  return {
    workers: { title: t('workers.title'), description: t('workers.description') },
    customers: { title: t('customers.title'), description: t('customers.description') },
    jobs: { title: t('jobs.title'), description: t('jobs.description') },
    schedule: { title: t('schedule.title'), description: t('schedule.description') },
    activity: { title: t('activity.title'), description: t('activity.description') },
    notifications: { title: t('notifications.title'), description: t('notifications.description') },
    workflows: { title: t('workflows.title'), description: t('workflows.description') },
    photos: { title: t('photos.title'), description: t('photos.description') }
  };
}

export function useTranslatedPlanName() {
  const t = useTranslations('plans');
  return (plan: string) => t(plan as 'free') || plan;
}

export function useTranslatedRoleName() {
  const t = useTranslations('roles');
  return (role: string) => t(role as 'owner') || role;
}

export function useFriendlyErrorMessage() {
  const t = useTranslations('errors.api');

  return (raw: string | null | undefined, fallback?: string): string => {
    if (!raw?.trim()) return fallback || t('network');

    const lower = raw.toLowerCase();

    if (lower === 'load failed' || lower === 'failed to fetch' || lower.includes('networkerror')) {
      return t('network');
    }
    if (lower.includes('invalid login credentials')) {
      return t('network');
    }
    if (lower.includes('user already registered')) {
      return t('userExists');
    }
    if (lower.includes('rate limit') || lower.includes('too many')) {
      return t('network');
    }
    if (lower.includes('jwt') || lower.includes('session')) {
      return t('sessionExpired');
    }
    if (lower.includes('permission') || lower.includes('rls') || lower.includes('row-level security')) {
      return t('permission');
    }

    return raw;
  };
}
