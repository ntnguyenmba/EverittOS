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

const EMPTY_ACTIONS: Partial<Record<EmptyKey, string>> = {
  jobs: '/jobs/new',
  customers: '/customers/new',
  leads: '/leads/new',
  schedule: '/schedule/new',
  workers: '/people',
  reviews: '/reviews',
  forms: '/forms',
  templates: '/templates',
  expenses: '/expenses',
  invoices: '/invoices',
  analytics: '/dashboard'
};

const SECONDARY_ACTIONS: Partial<Record<EmptyKey, string>> = {
  leads: '/forms'
};

function resolveString(t: (path: string) => string, path: string): string | undefined {
  const value = t(path);
  return value === path ? undefined : value;
}

type LocalizedEmptyStateProps = {
  emptyKey: EmptyKey;
  href?: string;
  secondaryHref?: string;
  onPrimaryClick?: () => void;
  compact?: boolean;
  icon?: 'default' | 'none';
};

export function LocalizedEmptyState({
  emptyKey,
  href,
  secondaryHref,
  onPrimaryClick,
  compact,
  icon
}: LocalizedEmptyStateProps) {
  const { t } = useTranslation();
  const base = `empty.${emptyKey}`;
  const title = t(`${base}.title`);
  const description = resolveString(t, `${base}.description`);
  const actionLabel = resolveString(t, `${base}.action`);
  const secondaryActionLabel = resolveString(t, `${base}.secondaryAction`);

  const actionHref = href || EMPTY_ACTIONS[emptyKey];
  const secondaryActionHref = secondaryHref || SECONDARY_ACTIONS[emptyKey];

  const primaryAction =
    actionLabel && (actionHref || onPrimaryClick) ? (
      onPrimaryClick ? (
        <button type="button" className="btn btn-primary" onClick={onPrimaryClick}>
          {actionLabel}
        </button>
      ) : actionHref ? (
        <Link className="btn btn-primary" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null
    ) : null;

  const secondaryAction =
    secondaryActionLabel && secondaryActionHref ? (
      <Link className="btn" href={secondaryActionHref}>
        {secondaryActionLabel}
      </Link>
    ) : null;

  return (
    <EmptyState
      compact={compact}
      icon={icon}
      title={title}
      description={description}
      action={primaryAction}
      secondaryAction={secondaryAction}
    />
  );
}

/** @deprecated Use LocalizedEmptyState or useTranslation with empty.* keys */
export function useEmptyCopy() {
  const { t } = useTranslation();
  return {
    jobs: {
      title: t('empty.jobs.title'),
      description: t('empty.jobs.description'),
      action: t('empty.jobs.action')
    },
    customers: {
      title: t('empty.customers.title'),
      description: t('empty.customers.description'),
      action: t('empty.customers.action')
    },
    schedule: {
      title: t('empty.schedule.title'),
      description: t('empty.schedule.description'),
      action: t('empty.schedule.action')
    },
    workers: {
      title: t('empty.workers.title'),
      description: t('empty.workers.description'),
      action: t('empty.workers.action')
    },
    activity: { title: t('empty.activity.title'), description: t('empty.activity.description') },
    notifications: { title: t('empty.notifications.title'), description: t('empty.notifications.description') },
    workflows: { title: t('empty.workflows.title'), description: t('empty.workflows.description') },
    photos: { title: t('empty.photos.title'), description: t('empty.photos.description') }
  };
}
