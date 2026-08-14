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

    // Use the existing activity log as the durable calendar inbox state.
    // This works across legacy workspaces without requiring a separate
    // calendar_import_ignored_events table or schema migration.
    const existing = await auth.admin
      .from('activity_logs')
      .select('id')
      .eq('organization_id', auth.org.organizationId)
      .eq('entity_type', 'integration')
      .eq('entity_id', connection.id)
      .eq('action', 'calendar_event_handled')
      .contains('metadata', { event_uid: eventUid })
      .limit(1);

    if (!existing.error && (existing.data || []).length > 0) {
      return NextResponse.json({ ok: true }, { headers: CALENDAR_IMPORT_NO_CACHE });
    }

    const { error } = await auth.admin.from('activity_logs').insert({
      organization_id: auth.org.organizationId,
      user_id: auth.user.id,
      entity_type: 'integration',
      entity_id: connection.id,
      action: 'calendar_event_handled',
      message: 'Calendar event handled',
      metadata: { source: 'calendar_import', event_uid: eventUid }
    });

    if (error) {
      return NextResponse.json(
        { error: 'The calendar event could not be marked as handled.' },
        { status: 500, headers: CALENDAR_IMPORT_NO_CACHE }
      );
    }

    return NextResponse.json({ ok: true }, { headers: CALENDAR_IMPORT_NO_CACHE });
  } catch {
    return NextResponse.json(
      { error: 'The calendar event could not be marked as handled.' },
      { status: 500, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }
}
