/** Core intelligence layer types — business records, not chat messages. */

export type AskEverittRecordType =
  | 'customer'
  | 'job'
  | 'lead'
  | 'worker'
  | 'schedule'
  | 'booking'
  | 'service'
  | 'availability'
  | 'calendar'
  | 'form'
  | 'sop'
  | 'document'
  | 'review'
  | 'note'
  | 'invoice'
  | 'expense'
  | 'revenue'
  | 'activity'
  | 'photo';

export type AskEverittSearchRecord = {
  id: string;
  type: AskEverittRecordType;
  sourceId: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  date: string | null;
  owner: string | null;
  href: string;
  actionLabel: string;
};

export type AskEverittMetric = {
  label: string;
  value: string;
  href?: string;
};

export type AskEverittSearchGroup = {
  sourceId: string;
  label: string;
  results: AskEverittSearchRecord[];
};

export type AskEverittSuggestion = {
  id: string;
  label: string;
  prompt: string;
  count?: number;
};

export type AskEverittSearchResponse = {
  mode: 'search';
  summary: string;
  results: AskEverittSearchRecord[];
  groups?: AskEverittSearchGroup[];
  metrics?: AskEverittMetric[];
  sourcesUsed?: string[];
  noResultsHint?: string;
  suggestions?: AskEverittSuggestion[];
};

export type AskEverittAiPrefetchedContext = {
  summary: string;
  records: AskEverittSearchRecord[];
  metrics?: AskEverittMetric[];
};
