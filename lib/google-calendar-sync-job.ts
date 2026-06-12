import type { SupabaseClient } from '@supabase/supabase-js';
import { syncJobToGoogleCalendar } from '@/lib/google-calendar-sync';

/** Best-effort calendar sync after a job is created or updated. Never throws. */
export async function syncJobToGoogleCalendarSafe(
  admin: SupabaseClient,
  organizationId: string,
  jobId: string
): Promise<void> {
  try {
    const { data: settings } = await admin
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', organizationId)
      .maybeSingle();

    await syncJobToGoogleCalendar(admin, organizationId, jobId, settings?.timezone || 'America/New_York');
  } catch {
    /* calendar sync must not block job writes */
  }
}
