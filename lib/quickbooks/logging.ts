import type { SupabaseClient } from '@supabase/supabase-js';

export type QuickBooksSyncLogInput = {
  organizationId: string;
  userId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  direction?: 'export' | 'import';
  status: 'pending' | 'completed' | 'failed' | 'created' | 'updated';
  externalId?: string | null;
  errorMessage?: string | null;
  intuitTid?: string | null;
  httpStatus?: number | null;
  qbErrorCode?: string | null;
  faultType?: string | null;
};

/** Persist a sync attempt without secrets or raw Intuit payloads. */
export async function writeQuickBooksSyncLog(
  supabase: SupabaseClient,
  input: QuickBooksSyncLogInput
): Promise<void> {
  const { error } = await supabase.from('quickbooks_sync_logs').insert({
    organization_id: input.organizationId,
    user_id: input.userId || null,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    action: input.action,
    direction: input.direction || 'export',
    status: input.status,
    external_id: input.externalId || null,
    error_message: input.errorMessage ? truncateSafe(input.errorMessage, 500) : null,
    intuit_tid: input.intuitTid || null,
    http_status: input.httpStatus ?? null,
    qb_error_code: input.qbErrorCode || null,
    fault_type: input.faultType || null
  });

  if (error) {
    console.error('[quickbooks] failed to write sync log', {
      organizationId: input.organizationId,
      action: input.action,
      message: error.message
    });
  }
}

export function truncateSafe(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Server logs only — never includes tokens or secrets. */
export function logQuickBooksEvent(
  event: string,
  details: Record<string, string | number | boolean | null | undefined>
): void {
  console.info(`[quickbooks] ${event}`, details);
}
