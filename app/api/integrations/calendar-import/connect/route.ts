import { NextResponse } from 'next/server';
import { saveCalendarImportConnection } from '@/lib/calendar-import/connections';
import { calendarFeedErrorMessage, fetchPublicCalendarFeed, validatePublicFeedUrl } from '@/lib/calendar-import/feed-security';
import { looksLikeIcsCalendar } from '@/lib/calendar-import/ical-parser';
import { importCalendarConnection } from '@/lib/calendar-import/import-calendar';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { assertNoFeedSecret } from '@/lib/calendar-import/safe-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function parseDefaultAmount(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return amount;
}

export async function POST(request: Request) {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

  let body: { feedUrl?: string; defaultRevenueAmount?: unknown } = {};
  try {
    body = (await request.json()) as { feedUrl?: string; defaultRevenueAmount?: unknown };
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

  const defaultRevenueAmount = parseDefaultAmount(body.defaultRevenueAmount);
  if (body.defaultRevenueAmount !== undefined && defaultRevenueAmount === undefined) {
    return NextResponse.json(
      { error: 'Default job amount must be a non-negative number.' },
      { status: 400, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }

  try {
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
      createdBy: auth.user.id,
      defaultRevenueAmount
    });

    const result = await importCalendarConnection(auth.admin, connection, {
      icsText: feed.body,
      ownerUserId: auth.user.id
    });
    assertNoFeedSecret(result);

    await auth.admin.from('activity_logs').insert({
      organization_id: auth.org.organizationId,
      user_id: auth.user.id,
      entity_type: 'integration',
      entity_id: connection.id,
      action: 'calendar_connected',
      message: 'Calendar connected',
      metadata: { source: 'calendar_import' }
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
