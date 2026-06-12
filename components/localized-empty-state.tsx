'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { EmptyState } from '@/components/empty-state';

type EmptyKey = 'jobs' | 'customers' | 'schedule' | 'workers';

const EMPTY_ACTIONS: Record<EmptyKey, string> = {
  jobs: '/dashboard',
  customers: '/customers',
  schedule: '/jobs',
  workers: '/settings/team'
};

type LocalizedEmptyStateProps = {
  emptyKey: EmptyKey;
  href?: string;
};

export function LocalizedEmptyState({ emptyKey, href }: LocalizedEmptyStateProps) {
  const { t } = useTranslation();
  const actionHref = href || EMPTY_ACTIONS[emptyKey];

  const description = t(`empty.${emptyKey}.description`);

  return (
    <EmptyState
      compact
      title={t(`empty.${emptyKey}.title`)}
      description={description || undefined}
      action={
        emptyKey === 'jobs' || emptyKey === 'customers' || emptyKey === 'schedule' || emptyKey === 'workers' ? (
          <Link className="btn btn-primary" href={actionHref}>
            {t(`empty.${emptyKey}.action`)}
          </Link>
        ) : undefined
      }
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
