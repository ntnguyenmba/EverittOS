import { NextResponse } from 'next/server';
import { saveCalendarImportConnection } from '@/lib/calendar-import/connections';
import { calendarFeedErrorMessage, fetchPublicCalendarFeed, validatePublicFeedUrl } from '@/lib/calendar-import/feed-security';
import { looksLikeIcsCalendar } from '@/lib/calendar-import/ical-parser';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { assertNoFeedSecret, toSafeCalendarImportStatus } from '@/lib/calendar-import/safe-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

  let body: { feedUrl?: string } = {};
  try {
    body = (await request.json()) as { feedUrl?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: CALENDAR_IMPORT_NO_CACHE });
  }

  const validated = validatePublicFeedUrl(String(body.feedUrl || ''));
  if (!validated.ok) {
    return NextResponse.json(
      { error: calendarFeedErrorMessage(validated.code), code: validated.code },
      { status: 400, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }

  try {
    // Validate that the subscription URL is reachable and actually returns an ICS feed,
    // but do not create or update Jobs here. Calendar Import is review-first.
    const feed = await fetchPublicCalendarFeed(validated.href);
    if (!looksLikeIcsCalendar(feed.body)) {
      return NextResponse.json(
        { error: calendarFeedErrorMessage('not_calendar'), code: 'not_calendar' },
        { status: 400, headers: CALENDAR_IMPORT_NO_CACHE }
      );
    }

    const connection = await saveCalendarImportConnection(auth.admin, {
      organizationId: auth.org.organizationId,
      feedUrl: validated.href,
      createdBy: auth.user.id
    });

    const result = toSafeCalendarImportStatus(connection);
    assertNoFeedSecret(result);

    await auth.admin.from('activity_logs').insert({
      organization_id: auth.org.organizationId,
      user_id: auth.user.id,
      entity_type: 'integration',
      entity_id: connection.id,
      action: 'calendar_connected',
      message: 'Calendar connected for review',
      metadata: { source: 'calendar_import', mode: 'review_first' }
    });

    return NextResponse.json(result, { headers: CALENDAR_IMPORT_NO_CACHE });
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code) : 'fetch_failed';
    const safeCode = code === 'unsafe_url' || code === 'invalid_url' || code === 'not_calendar' ? code : 'fetch_failed';
    return NextResponse.json(
      { error: calendarFeedErrorMessage(safeCode), code: safeCode },
      { status: safeCode === 'fetch_failed' ? 502 : 400, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }
}
