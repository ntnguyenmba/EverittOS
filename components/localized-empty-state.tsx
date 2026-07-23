'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { EmptyState } from '@/components/empty-state';

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
};

const ACTION_HREFS: Partial<Record<EmptyKey, string>> = {
  jobs: '/jobs/new',
  customers: '/customers/new',
  leads: '/leads/new',
  schedule: '/schedule',
  workers: '/people',
  reviews: '/reviews',
  forms: '/forms',
  templates: '/templates',
  expenses: '/expenses',
  invoices: '/invoices',
  analytics: '/dashboard'
};

export function LocalizedEmptyState({ emptyKey, compact, icon, onPrimaryClick }: LocalizedEmptyStateProps) {
  const { t } = useTranslation();
  const actionLabel = t(`empty.${emptyKey}.action`);
  const secondaryActionLabel = t(`empty.${emptyKey}.secondaryAction`);
  const actionHref = ACTION_HREFS[emptyKey];
  const hasActionLabel = !actionLabel.startsWith('[');
  const hasLinkedAction = actionHref && hasActionLabel;
  const hasSecondaryAction = emptyKey === 'leads' && !secondaryActionLabel.startsWith('[');

  const primaryAction = onPrimaryClick && hasActionLabel ? (
    <button type="button" className="btn btn-primary" onClick={onPrimaryClick}>
      {actionLabel}
    </button>
  ) : hasLinkedAction ? (
    <Link className="btn btn-primary" href={actionHref}>
      {actionLabel}
    </Link>
  ) : undefined;

  return (
    <EmptyState
      title={t(`empty.${emptyKey}.title`)}
      description={t(`empty.${emptyKey}.description`)}
      compact={compact}
      icon={icon}
      action={primaryAction}
      secondaryAction={
        hasSecondaryAction ? (
          <Link className="btn" href="/forms">
            {secondaryActionLabel}
          </Link>
        ) : undefined
      }
    />
  );
}
