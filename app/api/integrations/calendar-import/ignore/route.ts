import { NextResponse } from 'next/server';
import { getPrimaryCalendarImportConnection } from '@/lib/calendar-import/connections';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IgnoreRequest = {
  eventUid?: string;
};

export async function POST(request: Request) {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as IgnoreRequest;
  const eventUid = String(body.eventUid || '').trim();
  if (!eventUid) {
    return NextResponse.json(
      { error: 'A calendar event is required.' },
      { status: 400, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }

  try {
    const connection = await getPrimaryCalendarImportConnection(auth.admin, auth.org.organizationId, {
      includeFeedUrl: false
    });
    if (!connection) {
      return NextResponse.json(
        { error: 'Calendar import is not connected.' },
        { status: 404, headers: CALENDAR_IMPORT_NO_CACHE }
      );
    }

    const { error } = await auth.admin
      .from('calendar_import_ignored_events')
      .upsert(
        {
          organization_id: auth.org.organizationId,
          connection_id: connection.id,
          event_uid: eventUid,
          ignored_by: auth.user.id,
          ignored_at: new Date().toISOString()
        },
        { onConflict: 'connection_id,event_uid' }
      );

    if (error) {
      return NextResponse.json(
        { error: 'The calendar event could not be ignored.' },
        { status: 500, headers: CALENDAR_IMPORT_NO_CACHE }
      );
    }

    await auth.admin.from('activity_logs').insert({
      organization_id: auth.org.organizationId,
      user_id: auth.user.id,
      entity_type: 'integration',
      entity_id: connection.id,
      action: 'calendar_event_ignored',
      message: 'Calendar event ignored',
      metadata: { source: 'calendar_import', event_uid: eventUid }
    });

    return NextResponse.json({ ok: true }, { headers: CALENDAR_IMPORT_NO_CACHE });
  } catch {
    return NextResponse.json(
      { error: 'The calendar event could not be ignored.' },
      { status: 500, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }
}
