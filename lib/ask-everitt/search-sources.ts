import type { AskEverittRecordType } from '@/lib/ask-everitt/types';

/** Canonical source ids — new modules register here to become searchable. */
export type SearchSourceId =
  | 'customers'
  | 'leads'
  | 'jobs'
  | 'schedule'
  | 'workers'
  | 'reviews'
  | 'forms'
  | 'templates'
  | 'documents'
  | 'sops'
  | 'notes'
  | 'invoices'
  | 'expenses'
  | 'revenue'
  | 'photos'
  | 'activity'
  | (string & {});

export type SearchSourceDefinition = {
  id: SearchSourceId;
  label: string;
  recordType: AskEverittRecordType;
  table: string;
  keywords: string[];
  href: string | ((id: string) => string);
  actionLabel: string;
  listPath: string;
};

const SOURCE_LIST: SearchSourceDefinition[] = [
  {
    id: 'customers',
    label: 'Customers',
    recordType: 'customer',
    table: 'customers',
    keywords: ['customer', 'customers', 'client', 'clients', 'crm', 'company'],
    href: (id) => `/customers/${id}`,
    actionLabel: 'Open Customer',
    listPath: '/customers'
  },
  {
    id: 'leads',
    label: 'Leads',
    recordType: 'lead',
    table: 'customers',
    keywords: ['lead', 'leads', 'prospect', 'pipeline'],
    href: (id) => `/customers/${id}`,
    actionLabel: 'Open Lead',
    listPath: '/leads'
  },
  {
    id: 'jobs',
    label: 'Jobs',
    recordType: 'job',
    table: 'jobs',
    keywords: ['job', 'jobs', 'work order', 'project', 'service call'],
    href: (id) => `/jobs/${id}`,
    actionLabel: 'Open Job',
    listPath: '/jobs'
  },
  {
    id: 'schedule',
    label: 'Schedule',
    recordType: 'schedule',
    table: 'jobs',
    keywords: ['schedule', 'scheduled', 'calendar', 'appointment', 'tomorrow', 'upcoming'],
    href: (id) => `/jobs/${id}`,
    actionLabel: 'Open Schedule',
    listPath: '/schedule'
  },
  {
    id: 'workers',
    label: 'Workers',
    recordType: 'worker',
    table: 'workers',
    keywords: ['worker', 'workers', 'crew', 'technician', 'staff member', 'team member'],
    href: '/workers',
    actionLabel: 'Open Worker',
    listPath: '/workers'
  },
  {
    id: 'reviews',
    label: 'Reviews',
    recordType: 'review',
    table: 'customer_reviews',
    keywords: ['review', 'reviews', 'rating', 'feedback', 'testimonial'],
    href: '/reviews',
    actionLabel: 'Open Review',
    listPath: '/reviews'
  },
  {
    id: 'forms',
    label: 'Forms',
    recordType: 'form',
    table: 'everitt_forms',
    keywords: ['form', 'forms', 'intake', 'survey'],
    href: (id) => `/forms/${id}`,
    actionLabel: 'Open Form',
    listPath: '/forms'
  },
  {
    id: 'templates',
    label: 'Templates',
    recordType: 'document',
    table: 'template_library',
    keywords: ['template', 'templates', 'proposal', 'contract', 'checklist'],
    href: '/templates',
    actionLabel: 'Open Template',
    listPath: '/templates'
  },
  {
    id: 'documents',
    label: 'Documents',
    recordType: 'document',
    table: 'knowledge_documents',
    keywords: ['document', 'documents', 'knowledge', 'vault', 'file'],
    href: '/knowledge',
    actionLabel: 'Open Document',
    listPath: '/knowledge'
  },
  {
    id: 'sops',
    label: 'SOPs',
    recordType: 'sop',
    table: 'template_library',
    keywords: ['sop', 'sops', 'procedure', 'standard operating', 'playbook', 'onboarding'],
    href: '/templates',
    actionLabel: 'Open SOP',
    listPath: '/templates'
  },
  {
    id: 'notes',
    label: 'Notes',
    recordType: 'note',
    table: 'customers',
    keywords: ['note', 'notes', 'complaint', 'comment'],
    href: (id) => `/customers/${id}`,
    actionLabel: 'Open Note',
    listPath: '/customers'
  },
  {
    id: 'invoices',
    label: 'Invoices',
    recordType: 'invoice',
    table: 'invoices',
    keywords: ['invoice', 'invoices', 'unpaid', 'billing', 'payment', 'owe', 'outstanding'],
    href: '/invoices',
    actionLabel: 'Open Invoice',
    listPath: '/invoices'
  },
  {
    id: 'expenses',
    label: 'Expenses',
    recordType: 'expense',
    table: 'expenses',
    keywords: ['expense', 'expenses', 'spend', 'cost', 'receipt'],
    href: '/expenses',
    actionLabel: 'Open Expenses',
    listPath: '/expenses'
  },
  {
    id: 'revenue',
    label: 'Revenue',
    recordType: 'revenue',
    table: 'invoices',
    keywords: ['revenue', 'income', 'earnings', 'sales'],
    href: '/analytics',
    actionLabel: 'View Revenue',
    listPath: '/analytics'
  },
  {
    id: 'photos',
    label: 'Photos',
    recordType: 'photo',
    table: 'job_photos',
    keywords: ['photo', 'photos', 'before and after', 'before-after', 'picture', 'images'],
    href: (id) => `/jobs/${id}`,
    actionLabel: 'Open Job',
    listPath: '/jobs'
  },
  {
    id: 'activity',
    label: 'Activity',
    recordType: 'activity',
    table: 'activity_logs',
    keywords: ['activity', 'history', 'log', 'audit', 'recent changes'],
    href: '/activity',
    actionLabel: 'Open Activity',
    listPath: '/activity'
  }
];

const registry = new Map<string, SearchSourceDefinition>(
  SOURCE_LIST.map((s) => [s.id, s])
);

/** All registered search sources (extensible via registerSearchSource). */
export function getSearchSources(): SearchSourceDefinition[] {
  return Array.from(registry.values());
}

export function getSearchSource(id: SearchSourceId): SearchSourceDefinition | undefined {
  return registry.get(id);
}

/** Register a new module so Ask Everitt can search it without rewriting the engine. */
export function registerSearchSource(source: SearchSourceDefinition): void {
  registry.set(source.id, source);
}

export function resolveHref(source: SearchSourceDefinition, recordId: string): string {
  return typeof source.href === 'function' ? source.href(recordId) : source.href;
}

/** Infer which sources are relevant from natural language (for scoped fallback search). */
export function resolveSearchSourcesFromQuery(query: string): SearchSourceId[] {
  const q = query.toLowerCase();
  const matched = getSearchSources().filter((s) => s.keywords.some((kw) => q.includes(kw)));
  if (matched.length > 0) return matched.map((s) => s.id);
  return ['customers', 'jobs', 'leads', 'invoices', 'documents', 'forms'];
}

export function sourceLabel(id: SearchSourceId): string {
  return registry.get(id)?.label || id;
}

export function recordTypeForSource(id: SearchSourceId): AskEverittRecordType {
  return registry.get(id)?.recordType || 'document';
}
