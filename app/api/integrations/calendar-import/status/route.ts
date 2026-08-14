import { NextResponse } from 'next/server';
import { getPrimaryCalendarImportConnection, updateCalendarImportSyncState } from '@/lib/calendar-import/connections';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { assertNoFeedSecret, toSafeCalendarImportStatus } from '@/lib/calendar-import/safe-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

  try {
    const connection = await getPrimaryCalendarImportConnection(auth.admin, auth.org.organizationId);

    // Calendar Import is review-first now. Any persisted last_sync_error came from
    // the retired auto-write flow and should not be shown in Settings anymore.
    // Review failures are returned directly by the review endpoint instead.
    if (connection?.last_sync_error) {
      await updateCalendarImportSyncState(auth.admin, connection.id, { last_sync_error: null }).catch(() => undefined);
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
