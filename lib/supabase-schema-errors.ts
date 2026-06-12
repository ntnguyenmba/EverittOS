import type { PostgrestError } from '@supabase/supabase-js';

/** Postgres / PostgREST codes for missing relations or schema cache drift. */
const MISSING_SCHEMA_CODES = new Set(['42P01', 'PGRST205', 'PGRST200', 'PGRST204']);

export type SchemaErrorLike =
  | { message?: string | null; code?: string | null }
  | Pick<PostgrestError, 'message' | 'code'>
  | null
  | undefined;

export function isMissingSchemaError(error: SchemaErrorLike): boolean {
  if (!error) return false;
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true;
  const lower = (error.message || '').toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('could not find') ||
    lower.includes('schema cache') ||
    (lower.includes('relation') && lower.includes('not exist'))
  );
}

/** Standard GET response when an optional feature table is not provisioned yet. */
export function schemaEmptyPayload<T>(
  listKey: string,
  extras?: Record<string, unknown>
): Record<string, unknown> {
  return {
    [listKey]: [] as T[],
    schemaReady: false,
    ...extras
  };
}

export const SCHEMA_SETUP_HINT =
  'Database tables for this feature are not set up yet. Run supabase/manual_schema_repair.sql in the Supabase SQL Editor.';
