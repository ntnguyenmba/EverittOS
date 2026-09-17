import type { SupabaseClient } from '@supabase/supabase-js';
import { syncJobToGoogleCalendar } from '@/lib/google-calendar-sync';

const RETRY_DELAYS_MS = [0, 350, 1200] as const;

type CalendarSyncOutcome = { ok: true } | { ok: false; error?: string };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableCalendarError(message: string) {
  const value = message.toLowerCase();
  return /429|rate|timeout|timed out|temporar|network|fetch|500|502|503|504|backend|unavailable/.test(value);
}

/** Best-effort calendar sync after a job is created or updated. Never blocks the job write. */
export async function syncJobToGoogleCalendarSafe(
  admin: SupabaseClient,
  organizationId: string,
  jobId: string
): Promise<CalendarSyncOutcome> {
  try {
    const { data: settings } = await admin
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', organizationId)
      .maybeSingle();
    const timezone = settings?.timezone || 'America/New_York';
    let lastError: string | undefined;

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
      if (RETRY_DELAYS_MS[attempt] > 0) await wait(RETRY_DELAYS_MS[attempt]);
      const result = await syncJobToGoogleCalendar(admin, organizationId, jobId, timezone);
      if (result.ok) return { ok: true };
      lastError = result.error || undefined;
      if (!isRetryableCalendarError(result.error || '') || attempt === RETRY_DELAYS_MS.length - 1) {
        return { ok: false, error: lastError };
      }
    }
    return { ok: false, error: lastError };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : undefined };
  }
}
