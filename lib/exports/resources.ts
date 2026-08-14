import type { Locale } from '@/lib/i18n/config';
import { normalizeLocale } from '@/lib/i18n/config';

export const EXPORT_RESOURCE_IDS = [
  'jobs',
  'team',
  'expenses',
  'customers',
  'invoices',
  'payments',
  'dashboard',
  'dashboard-details',
  'bookkeeping',
  'contractor-pay',
  'portal-client-jobs',
  'portal-contractor-jobs'
] as const;

export type ExportResourceId = (typeof EXPORT_RESOURCE_IDS)[number];

const ENDPOINT_BY_RESOURCE: Record<ExportResourceId, string> = {
  jobs: '/api/exports/jobs',
  team: '/api/exports/team',
  expenses: '/api/exports/expenses',
  customers: '/api/exports/customers',
  invoices: '/api/exports/invoices',
  payments: '/api/exports/payments',
  dashboard: '/api/exports/dashboard',
  'dashboard-details': '/api/exports/dashboard-details',
  bookkeeping: '/api/exports/bookkeeping',
  'contractor-pay': '/api/exports/contractor-pay',
  'portal-client-jobs': '/api/exports/portal/client/jobs',
  'portal-contractor-jobs': '/api/exports/portal/contractor/jobs'
};

const QUERY_ALLOWLIST: Record<ExportResourceId, readonly string[]> = {
  jobs: ['customer', 'status', 'period', 'filter', 'assigned_to', 'from'],
  team: [],
  expenses: ['from', 'to', 'category', 'jobId', 'customerId', 'workerId', 'q'],
  customers: ['period', 'stage', 'status'],
  invoices: ['jobId', 'customerId', 'payment'],
  payments: ['jobId', 'customerId', 'invoiceId'],
  dashboard: ['range'],
  'dashboard-details': ['metric', 'range'],
  bookkeeping: ['range'],
  'contractor-pay': ['status', 'jobId'],
  'portal-client-jobs': ['range', 'period'],
  'portal-contractor-jobs': []
};

export function exportEndpointForResource(resource: ExportResourceId): string {
  return ENDPOINT_BY_RESOURCE[resource];
}

export function parseExportResource(endpoint: string | null | undefined): ExportResourceId | null {
  const raw = String(endpoint || '')
    .trim()
    .split('?')[0]
    .replace(/\/+$/, '');
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  for (const resource of EXPORT_RESOURCE_IDS) {
    if (ENDPOINT_BY_RESOURCE[resource] === normalized) return resource;
  }
  if ((EXPORT_RESOURCE_IDS as readonly string[]).includes(raw)) return raw as ExportResourceId;
  return null;
}

export function sanitizeExportQuery(
  resource: ExportResourceId,
  query: URLSearchParams | Record<string, unknown> | string | null | undefined
): URLSearchParams {
  const allowed = new Set(QUERY_ALLOWLIST[resource]);
  const params = new URLSearchParams();
  const source = toSearchParams(query);
  source.forEach((value, key) => {
    if (!allowed.has(key)) return;
    if (value == null || value === '') return;
    params.set(key, String(value));
  });
  return params;
}

export function parseExportFormat(value: string | null | undefined): 'csv' | 'pdf' | null {
  const format = String(value || 'csv').toLowerCase();
  if (format === 'csv' || format === 'pdf') return format;
  return null;
}

export function parseExportLocale(value: string | null | undefined): Locale {
  return normalizeLocale(value);
}

function toSearchParams(query: URLSearchParams | Record<string, unknown> | string | null | undefined): URLSearchParams {
  if (query instanceof URLSearchParams) return query;
  if (typeof query === 'string' && query.trim()) {
    return new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  }
  const params = new URLSearchParams();
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === '') continue;
      params.set(key, String(value));
    }
  }
  return params;
}
