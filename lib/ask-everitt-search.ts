/**
 * @deprecated Import from @/lib/ask-everitt/search-engine or @/lib/ask-everitt/types
 * Thin compatibility layer for existing imports.
 */
export type {
  AskEverittRecordType,
  AskEverittSearchRecord,
  AskEverittSearchResponse,
  AskEverittSearchGroup,
  AskEverittMetric
} from '@/lib/ask-everitt/types';

export { runAskEverittSearchEngine as runAskEverittSearch } from '@/lib/ask-everitt/search-engine';
