import type { PortalMessages } from '@/lib/i18n/portal-messages-types';

type Translate = (path: string, values?: Record<string, string | number>) => string;

function normalizeStatusKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/** Localized friendly job status for portal UI. */
export function translatePortalJobStatus(t: Translate, status: string | null | undefined): string {
  const key = normalizeStatusKey(status);
  switch (key) {
    case 'new':
      return t('portal.status.job.new');
    case 'scheduled':
      return t('portal.status.job.scheduled');
    case 'in_progress':
    case 'inprogress':
      return t('portal.status.job.inProgress');
    case 'waiting':
      return t('portal.status.job.waiting');
    case 'completed':
    case 'complete':
    case 'done':
      return t('portal.status.job.completed');
    case 'cancelled':
    case 'canceled':
      return t('portal.status.job.cancelled');
    case '':
      return t('portal.status.job.scheduled');
    default:
      return t('portal.status.job.unknown');
  }
}

/** Localized friendly payment/invoice status for portal UI. */
export function translatePortalPaymentStatus(t: Translate, status: string | null | undefined): string {
  const key = normalizeStatusKey(status);
  switch (key) {
    case 'paid':
      return t('portal.status.payment.paid');
    case 'unpaid':
      return t('portal.status.payment.unpaid');
    case 'partially_paid':
    case 'partial':
      return t('portal.status.payment.partiallyPaid');
    case 'pending':
      return t('portal.status.payment.pending');
    case 'none':
      return t('portal.status.payment.none');
    case 'open':
      return t('portal.status.payment.open');
    case 'draft':
      return t('portal.status.payment.draft');
    case '':
    case 'not_set':
      return t('portal.status.payment.notSet');
    default:
      return t('portal.status.payment.unknown');
  }
}

export type { PortalMessages };
