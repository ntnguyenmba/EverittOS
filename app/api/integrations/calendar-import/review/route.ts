import { NextResponse } from 'next/server';
import { getPrimaryCalendarImportConnection, updateCalendarImportSyncState } from '@/lib/calendar-import/connections';
import { fetchPublicCalendarFeed } from '@/lib/calendar-import/feed-security';
import { looksLikeIcsCalendar, parseIcsCalendar } from '@/lib/calendar-import/ical-parser';
import { findConfidentProperty, isPossibleExistingJob, normalizeCalendarTitle } from '@/lib/calendar-import/matching';
import { CALENDAR_IMPORT_NO_CACHE, requireCalendarImportManager } from '@/lib/calendar-import/request-auth';
import { normalizeJobScheduleTimestamp } from '@/lib/schedule-times';
import { DEFAULT_TIME_ZONE } from '@/lib/time-zones';
import type { CalendarImportJobRow, CalendarImportPropertyRow, ParsedCalendarEvent } from '@/lib/calendar-import/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ReviewKind = 'new' | 'changed' | 'possible_match' | 'cancelled' | 'no_change';

type ReviewItem = {
  uid: string;
  title: string;
  location: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
  kind: ReviewKind;
  changes: Array<'time' | 'location' | 'title' | 'status'>;
  jobId: string | null;
  jobTitle: string | null;
  propertyId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  timezone: string | null;
  revenueAmount: number | null;
};

type CustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

function same(left: string | null | undefined, right: string | null | undefined): boolean {
  return String(left || '').trim() === String(right || '').trim();
}

function eventDate(event: ParsedCalendarEvent): string | null {
  return event.startDate || event.endDate || null;
}

function relevantEvent(event: ParsedCalendarEvent, today: string): boolean {
  const date = eventDate(event);
  if (!date) return true;
  const start = new Date(`${today}T00:00:00Z`);
  const target = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return true;
  const days = Math.round((target.getTime() - start.getTime()) / 86400000);
  return days >= -1 && days <= 730;
}

function enrichment(
  event: ParsedCalendarEvent,
  properties: CalendarImportPropertyRow[],
  customers: Map<string, CustomerRow>,
  defaultRevenue: number | null,
  defaultTimezone: string
) {
  const property = findConfidentProperty(event, properties);
  const customer = property?.customer_id ? customers.get(property.customer_id) || null : null;
  return {
    propertyId: property?.id || null,
    customerId: property?.customer_id || null,
    customerName: customer?.name || null,
    customerEmail: customer?.email || null,
    customerPhone: customer?.phone || null,
    timezone: property?.timezone || event.timezone || defaultTimezone || null,
    revenueAmount: defaultRevenue
  };
}

function compareImported(
  job: CalendarImportJobRow,
  event: ParsedCalendarEvent,
  extra: ReturnType<typeof enrichment>
): ReviewItem {
  const changes: ReviewItem['changes'] = [];
  const eventStart = normalizeJobScheduleTimestamp(event.dtStart);
  const eventEnd = normalizeJobScheduleTimestamp(event.dtEnd);
  const cancelled = event.status === 'CANCELLED';
  if (!same(job.title, event.summary)) changes.push('title');
  if (!same(job.address, event.location) && event.location) changes.push('location');
  if (!same(job.scheduled_start, eventStart) || !same(job.scheduled_end, eventEnd)) changes.push('time');
  if (cancelled && String(job.status || '').toLowerCase() !== 'cancelled') changes.push('status');

  return {
    uid: event.uid,
    title: event.summary || event.location || 'Calendar event',
    location: event.location,
    start: event.dtStart,
    end: event.dtEnd,
    status: event.status,
    kind: cancelled ? 'cancelled' : changes.length ? 'changed' : 'no_change',
    changes,
    jobId: job.id,
    jobTitle: job.title,
    ...extra
  };
}

export async function GET() {
  const auth = await requireCalendarImportManager();
  if (!auth.ok) return auth.response;

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

    const feed = await fetchPublicCalendarFeed(connection.feed_url);
    if (!looksLikeIcsCalendar(feed.body)) {
      return NextResponse.json(
        { error: 'The URL did not return a calendar feed.' },
        { status: 422, headers: CALENDAR_IMPORT_NO_CACHE }
      );
    }

    const timezoneResult = await auth.admin
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', auth.org.organizationId)
      .maybeSingle();
    const timezone = timezoneResult.data?.timezone || DEFAULT_TIME_ZONE;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const handledResult = await auth.admin
      .from('activity_logs')
      .select('metadata')
      .eq('organization_id', auth.org.organizationId)
      .eq('entity_type', 'integration')
      .eq('entity_id', connection.id)
      .eq('action', 'calendar_event_handled')
      .limit(1000);

    const handled = new Set(
      (handledResult.data || [])
        .map((row: { metadata?: { event_uid?: string } | null }) => String(row.metadata?.event_uid || '').trim())
        .filter(Boolean)
    );

    const events = parseIcsCalendar(feed.body, timezone)
      .filter((event) => event.uid && !handled.has(event.uid) && relevantEvent(event, today))
      .slice(0, 100);
    const uids = events.map((event) => event.uid);
    const dates = Array.from(
      new Set(events.map((event) => event.startDate).filter((value): value is string => Boolean(value)))
    );

    const propertiesResult = await auth.admin
      .from('customer_properties')
      .select('id,customer_id,name,address,formatted_address,timezone,is_archived')
      .eq('organization_id', auth.org.organizationId);
    const properties = ((propertiesResult.data || []) as CalendarImportPropertyRow[]).filter((property) => !property.is_archived);
    const customerIds = Array.from(new Set(properties.map((property) => property.customer_id).filter((id): id is string => Boolean(id))));
    const customersResult = customerIds.length
      ? await auth.admin.from('customers').select('id,name,email,phone').eq('organization_id', auth.org.organizationId).in('id', customerIds)
      : { data: [], error: null };
    const customers = new Map(((customersResult.data || []) as CustomerRow[]).map((customer) => [customer.id, customer]));
    const defaultRevenue = connection.default_revenue_amount == null ? null : Number(connection.default_revenue_amount);

    const importedResult = uids.length
      ? await auth.admin
          .from('jobs')
          .select('id,title,address,status,start_date,due_date,scheduled_start,scheduled_end,external_uid,external_source,external_last_modified')
          .eq('organization_id', auth.org.organizationId)
          .eq('external_source', 'calendar_import')
          .in('external_uid', uids)
      : { data: [], error: null };

    const candidateResult = dates.length
      ? await auth.admin
          .from('jobs')
          .select('id,title,address,status,start_date,due_date,scheduled_start,scheduled_end,external_uid,external_source')
          .eq('organization_id', auth.org.organizationId)
          .in('start_date', dates)
          .limit(300)
      : { data: [], error: null };

    const imported = (importedResult.data || []) as unknown as CalendarImportJobRow[];
    const candidates = (candidateResult.data || []) as unknown as CalendarImportJobRow[];
    const importedByUid = new Map(imported.map((job) => [job.external_uid, job]));

    const items: ReviewItem[] = events.map((event) => {
      const extra = enrichment(event, properties, customers, Number.isFinite(defaultRevenue) ? defaultRevenue : null, timezone);
      const linked = importedByUid.get(event.uid);
      if (linked) return compareImported(linked, event, extra);

      const possible = candidates.find((job) => !job.external_uid && isPossibleExistingJob(job, event));
      if (possible) {
        return {
          uid: event.uid,
          title: event.summary || event.location || 'Calendar event',
          location: event.location,
          start: event.dtStart,
          end: event.dtEnd,
          status: event.status,
          kind: 'possible_match',
          changes: [],
          jobId: possible.id,
          jobTitle: possible.title,
          ...extra
        };
      }

      return {
        uid: event.uid,
        title: event.summary || event.location || 'Calendar event',
        location: event.location,
        start: event.dtStart,
        end: event.dtEnd,
        status: event.status,
        kind: event.status === 'CANCELLED' ? 'no_change' : 'new',
        changes: [],
        jobId: null,
        jobTitle: null,
        ...extra
      };
    });

    const order: Record<ReviewKind, number> = {
      changed: 0,
      cancelled: 1,
      new: 2,
      possible_match: 3,
      no_change: 4
    };
    items.sort(
      (a, b) =>
        order[a.kind] - order[b.kind] ||
        String(a.start || '').localeCompare(String(b.start || '')) ||
        normalizeCalendarTitle(a.title).localeCompare(normalizeCalendarTitle(b.title))
    );

    if (connection.last_sync_error) {
      await updateCalendarImportSyncState(auth.admin, connection.id, { last_sync_error: null });
    }

    return NextResponse.json({ connected: true, items }, { headers: CALENDAR_IMPORT_NO_CACHE });
  } catch {
    return NextResponse.json(
      { error: 'Calendar changes could not be reviewed.' },
      { status: 502, headers: CALENDAR_IMPORT_NO_CACHE }
    );
  }
}
