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

const SIMPLE_ACTION_LABELS: Partial<Record<EmptyKey, string>> = {
  jobs: 'Create job',
  customers: 'Add customer',
  leads: 'Add lead',
  schedule: 'Create job',
  workers: 'Add team member',
  forms: 'Create form',
  templates: 'Create template',
  expenses: 'Add expense',
  invoices: 'Create invoice',
  analytics: 'Open dashboard',
  workflows: 'Create workflow',
  photos: 'Open jobs'
};

export function LocalizedEmptyState({ emptyKey, compact, icon, onPrimaryClick }: LocalizedEmptyStateProps) {
  const { t } = useTranslation();
  const translatedActionLabel = t(`empty.${emptyKey}.action`);
  const actionLabel = SIMPLE_ACTION_LABELS[emptyKey] || translatedActionLabel;
  const actionHref = ACTION_HREFS[emptyKey];
  const hasActionLabel = Boolean(actionLabel) && !actionLabel.startsWith('[');

  const primaryAction = onPrimaryClick && hasActionLabel ? (
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
      description=""
      compact={compact}
      icon={icon}
      action={primaryAction}
    />
  );
}
