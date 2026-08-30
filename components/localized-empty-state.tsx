'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { EmptyState } from '@/components/empty-state';
import { isMissingTranslationKey } from '@/lib/i18n/fallback-key';

export type EmptyKey =
  | 'jobs'
  | 'customers'
  | 'leads'
  | 'schedule'
  | 'workers'
  | 'reviews'
  | 'forms'
  | 'templates'
  | 'expenses'
  | 'invoices'
  | 'analytics'
  | 'activity'
  | 'notifications'
  | 'workflows'
  | 'photos';

type LocalizedEmptyStateProps = {
  emptyKey: EmptyKey;
  compact?: boolean;
  icon?: 'default' | 'none';
  onPrimaryClick?: () => void;
  showAction?: boolean;
};

const ACTION_HREFS: Partial<Record<EmptyKey, string>> = {
  jobs: '/jobs/new',
  customers: '/customers/new',
  leads: '/leads/new',
  schedule: '/jobs/new',
  workers: '/people',
  forms: '/forms',
  templates: '/templates',
  expenses: '/expenses',
  invoices: '/invoices',
  analytics: '/dashboard',
  workflows: '/workflows/new',
  photos: '/jobs'
};

export function LocalizedEmptyState({ emptyKey, compact, icon, onPrimaryClick, showAction = true }: LocalizedEmptyStateProps) {
  const { t } = useTranslation();
  const actionLabel = t(`empty.${emptyKey}.action`);
  const description = t(`empty.${emptyKey}.description`);
  const actionHref = ACTION_HREFS[emptyKey];
  const hasActionLabel = Boolean(actionLabel) && !isMissingTranslationKey(actionLabel);
  const hasDescription = Boolean(description) && !isMissingTranslationKey(description);

  const primaryAction = !showAction ? undefined : onPrimaryClick && hasActionLabel ? (
    <button type="button" className="btn btn-primary" onClick={onPrimaryClick}>
      {actionLabel}
    </button>
  ) : actionHref && hasActionLabel ? (
    <Link className="btn btn-primary" href={actionHref}>
      {actionLabel}
    </Link>
  ) : undefined;

  return (
    <EmptyState
      title={t(`empty.${emptyKey}.title`)}
      description={hasDescription ? description : undefined}
      compact={compact}
      icon={icon}
      action={primaryAction}
    />
  );
}
