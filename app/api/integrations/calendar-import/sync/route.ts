import { NextResponse } from 'next/server';
import { getPrimaryCalendarImportConnection } from '@/lib/calendar-import/connections';
import { importCalendarConnection } from '@/lib/calendar-import/import-calendar';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { assertNoFeedSecret } from '@/lib/calendar-import/safe-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

  try {
    const connection = await getPrimaryCalendarImportConnection(auth.admin, auth.org.organizationId, {
      includeFeedUrl: true
    });
    if (!connection?.feed_url) {
      return NextResponse.json({ error: 'Calendar import is not connected.' }, { status: 404, headers: CALENDAR_IMPORT_NO_CACHE });
    }

    const result = await importCalendarConnection(auth.admin, connection, { ownerUserId: auth.user.id });
    assertNoFeedSecret(result);

    await auth.admin.from('activity_logs').insert({
      organization_id: auth.org.organizationId,
      user_id: auth.user.id,
      entity_type: 'integration',
      entity_id: connection.id,
      action: 'calendar_synced',
      message: 'Calendar synced',
      metadata: {
        source: 'calendar_import',
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed
      }
    });

    return NextResponse.json(result, { headers: CALENDAR_IMPORT_NO_CACHE });
  } catch {
    return NextResponse.json(
      { error: 'The calendar feed could not be synced.' },
      { status: 502, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }
}
