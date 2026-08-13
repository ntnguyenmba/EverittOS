import { NextResponse } from 'next/server';
import { disconnectCalendarImport, getPrimaryCalendarImportConnection } from '@/lib/calendar-import/connections';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { toSafeCalendarImportStatus } from '@/lib/calendar-import/safe-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

  try {
    const existing = await getPrimaryCalendarImportConnection(auth.admin, auth.org.organizationId);
    await disconnectCalendarImport(auth.admin, auth.org.organizationId);

    if (existing) {
      await auth.admin.from('activity_logs').insert({
        organization_id: auth.org.organizationId,
        user_id: auth.user.id,
        entity_type: 'integration',
        entity_id: existing.id,
        action: 'calendar_disconnected',
        message: 'Calendar disconnected',
        metadata: { source: 'calendar_import' }
      });
    }

    return NextResponse.json(toSafeCalendarImportStatus(null), { headers: CALENDAR_IMPORT_NO_CACHE });
  } catch {
    return NextResponse.json(
      { error: 'Could not disconnect calendar import.' },
      { status: 500, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }
}
