import { NextResponse } from 'next/server';
import { getPrimaryCalendarImportConnection } from '@/lib/calendar-import/connections';
import { fetchPublicCalendarFeed } from '@/lib/calendar-import/feed-security';
import { looksLikeIcsCalendar, parseIcsCalendar } from '@/lib/calendar-import/ical-parser';
import { importCalendarConnection } from '@/lib/calendar-import/import-calendar';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { assertNoFeedSecret } from '@/lib/calendar-import/safe-status';
import { DEFAULT_TIME_ZONE } from '@/lib/time-zones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ApplyRequest = {
  eventUids?: string[];
};

export async function POST(request: Request) {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as ApplyRequest;
  const eventUids = Array.from(
    new Set((body.eventUids || []).map((value) => String(value || '').trim()).filter(Boolean))
  ).slice(0, 100);

  if (eventUids.length === 0) {
    return NextResponse.json(
      { error: 'Review the calendar and select at least one change before applying it.' },
      { status: 400, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }

  try {
    const connection = await getPrimaryCalendarImportConnection(auth.admin, auth.org.organizationId, {
      includeFeedUrl: true
    });
    if (!connection?.feed_url) {
      return NextResponse.json(
        { error: 'Calendar import is not connected.' },
        { status: 404, headers: CALENDAR_IMPORT_NO_CACHE }
      );
    }

    const settings = await auth.admin
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', auth.org.organizationId)
      .maybeSingle();
    const timeZone = settings.data?.timezone || DEFAULT_TIME_ZONE;

    const feed = await fetchPublicCalendarFeed(connection.feed_url);
    if (!looksLikeIcsCalendar(feed.body)) {
      return NextResponse.json(
        { error: 'The URL did not return a calendar feed.' },
        { status: 422, headers: CALENDAR_IMPORT_NO_CACHE }
      );
    }

    const selected = new Set(eventUids);
    const events = parseIcsCalendar(feed.body, timeZone).filter((event) => selected.has(event.uid));

    if (events.length === 0) {
      return NextResponse.json(
        { error: 'The selected calendar changes are no longer available. Review changes again.' },
        { status: 409, headers: CALENDAR_IMPORT_NO_CACHE }
      );
    }

    const result = await importCalendarConnection(auth.admin, connection, {
      ownerUserId: auth.user.id,
      organizationTimeZone: timeZone,
      events
    });
    assertNoFeedSecret(result);

    await auth.admin.from('activity_logs').insert({
      organization_id: auth.org.organizationId,
      user_id: auth.user.id,
      entity_type: 'integration',
      entity_id: connection.id,
      action: 'calendar_changes_applied',
      message: 'Reviewed calendar changes applied',
      metadata: {
        source: 'calendar_import',
        selected: events.length,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed
      }
    });

    return NextResponse.json(result, { headers: CALENDAR_IMPORT_NO_CACHE });
  } catch {
    return NextResponse.json(
      { error: 'The selected calendar changes could not be applied.' },
      { status: 502, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }
}
