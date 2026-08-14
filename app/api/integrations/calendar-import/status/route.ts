import { NextResponse } from 'next/server';
import { getPrimaryCalendarImportConnection, updateCalendarImportSyncState } from '@/lib/calendar-import/connections';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { assertNoFeedSecret, toSafeCalendarImportStatus } from '@/lib/calendar-import/safe-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isLegacyAutoImportError(message: string | null | undefined): boolean {
  const value = String(message || '').toLowerCase();
  return (
    value.includes('calendar events could not be saved as jobs') ||
    value.includes('event could not be saved as a job')
  );
}

export async function GET() {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

  try {
    const connection = await getPrimaryCalendarImportConnection(auth.admin, auth.org.organizationId);

    // Calendar Import is review-first now. Remove stale errors created by the retired
    // auto-import flow so Settings does not imply that calendar events should be
    // written to Jobs before the user reviews and approves them.
    if (connection && isLegacyAutoImportError(connection.last_sync_error)) {
      await updateCalendarImportSyncState(auth.admin, connection.id, { last_sync_error: null });
      connection.last_sync_error = null;
    }

    const payload = toSafeCalendarImportStatus(connection);
    assertNoFeedSecret(payload);
    return NextResponse.json(payload, { headers: CALENDAR_IMPORT_NO_CACHE });
  } catch {
    return NextResponse.json(
      { error: 'Calendar import status could not be loaded.' },
      { status: 500, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }
}
