import { NextResponse } from 'next/server';
import { getPrimaryCalendarImportConnection } from '@/lib/calendar-import/connections';
import { fetchPublicCalendarFeed } from '@/lib/calendar-import/feed-security';
import { looksLikeIcsCalendar, parseIcsCalendar } from '@/lib/calendar-import/ical-parser';
import { importCalendarConnection } from '@/lib/calendar-import/import-calendar';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { assertNoFeedSecret } from '@/lib/calendar-import/safe-status';
import { CALENDAR_IMPORT_SOURCE, type ParsedCalendarEvent } from '@/lib/calendar-import/types';
import { normalizeJobScheduleTimestamp } from '@/lib/schedule-times';
import { DEFAULT_TIME_ZONE } from '@/lib/time-zones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ApplyRequest = {
  eventUids?: string[];
};

async function fallbackCreateJob(
  admin: Awaited<ReturnType<typeof requireCalendarImportManager>> extends { ok: true; admin: infer T } ? T : never,
  organizationId: string,
  ownerUserId: string,
  event: ParsedCalendarEvent,
  timeZone: string
): Promise<string | null> {
  const title = event.summary?.trim() || event.location?.trim() || 'Calendar event';
  const address = event.location?.trim() || null;
  const notes = event.description?.trim() || null;

  let companyId: string | null = null;
  try {
    const company = await admin
      .from('companies')
      .select('id')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    companyId = company.data?.id || null;
  } catch {
    companyId = null;
  }

  const base: Record<string, unknown> = {
    user_id: ownerUserId,
    organization_id: organizationId,
    title,
    status: 'new',
    start_date: event.startDate || null,
    due_date: event.endDate || event.startDate || null,
    scheduled_start: normalizeJobScheduleTimestamp(event.dtStart),
    scheduled_end: normalizeJobScheduleTimestamp(event.dtEnd),
    timezone: event.timezone || timeZone,
    address,
    notes,
    external_source: CALENDAR_IMPORT_SOURCE,
    external_uid: event.uid,
    external_last_modified: event.lastModified || null
  };
  if (companyId) base.company_id = companyId;

  const attempts: Record<string, unknown>[] = [
    base,
    { ...base, status: 'scheduled' },
    Object.fromEntries(Object.entries(base).filter(([key]) => !['company_id', 'timezone'].includes(key))),
    Object.fromEntries(Object.entries(base).filter(([key]) => !['company_id', 'timezone', 'scheduled_end', 'scheduled_start'].includes(key)))
  ];

  for (const payload of attempts) {
    const inserted = await admin.from('jobs').insert(payload).select('id').single();
    if (!inserted.error && inserted.data?.id) return String(inserted.data.id);

    const text = `${inserted.error?.code || ''} ${inserted.error?.message || ''}`.toLowerCase();
    if (text.includes('duplicate') || text.includes('23505') || text.includes('unique')) {
      const existing = await admin
        .from('jobs')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('external_source', CALENDAR_IMPORT_SOURCE)
        .eq('external_uid', event.uid)
        .maybeSingle();
      if (existing.data?.id) return String(existing.data.id);
    }
  }

  return null;
}

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

    let result = await importCalendarConnection(auth.admin, connection, {
      ownerUserId: auth.user.id,
      organizationTimeZone: timeZone,
      events
    });
    assertNoFeedSecret(result);

    // Older workspaces can have a jobs schema that the calendar-import helper cannot
    // write cleanly even though normal job creation works. For a one-click Add as Job,
    // fall back to a minimal workspace-scoped insert instead of making the user retry.
    if (events.length === 1 && result.created === 0 && result.updated === 0 && result.failed > 0) {
      const createdId = await fallbackCreateJob(
        auth.admin as never,
        auth.org.organizationId,
        auth.user.id,
        events[0],
        timeZone
      );
      if (createdId) {
        result = {
          ...result,
          created: 1,
          failed: 0,
          error: null,
          failureReason: null
        };
      }
    }

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
