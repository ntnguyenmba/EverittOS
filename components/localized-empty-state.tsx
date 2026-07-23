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

export function LocalizedEmptyState({ emptyKey, compact, icon }: LocalizedEmptyStateProps) {
  const { t } = useTranslation();
  const actionLabel = t(`empty.${emptyKey}.action`);
  const secondaryActionLabel = t(`empty.${emptyKey}.secondaryAction`);
  const actionHref = ACTION_HREFS[emptyKey];
  const hasAction = actionHref && !actionLabel.startsWith('[');
  const hasSecondaryAction = emptyKey === 'leads' && !secondaryActionLabel.startsWith('[');

  return (
    <EmptyState
      title={t(`empty.${emptyKey}.title`)}
      description={t(`empty.${emptyKey}.description`)}
      compact={compact}
      icon={icon}
      action={
        hasAction ? (
          <Link className="btn btn-primary" href={actionHref}>
            {actionLabel}
          </Link>
        ) : undefined
      }
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
