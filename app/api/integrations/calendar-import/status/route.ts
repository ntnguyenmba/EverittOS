import { NextResponse } from 'next/server';
import { getPrimaryCalendarImportConnection } from '@/lib/calendar-import/connections';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { assertNoFeedSecret, toSafeCalendarImportStatus } from '@/lib/calendar-import/safe-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

  try {
    const connection = await getPrimaryCalendarImportConnection(auth.admin, auth.org.organizationId);
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
