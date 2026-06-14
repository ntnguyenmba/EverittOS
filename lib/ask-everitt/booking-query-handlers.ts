import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCurrency } from '@/lib/dashboard-metrics';
import { BOOKING_STATUS_LABELS } from '@/lib/booking/index';
import type { AskEverittSearchRecord, AskEverittSearchResponse } from '@/lib/ask-everitt/types';
import { buildRecord, response, type QueryHandler } from '@/lib/ask-everitt/search-helpers';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

const BOOKING_SELECT =
  'id, client_name, client_email, starts_at, ends_at, status, source, worker_id, staff_name, service_id, manual_service_name, google_calendar_event_id, services(name, price_cents), workers(name)';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function normalizeBookingRow(raw: Record<string, unknown>): BookingRow {
  const servicesRaw = raw.services;
  const workersRaw = raw.workers;
  const services =
    Array.isArray(servicesRaw) && servicesRaw[0]
      ? (servicesRaw[0] as { name?: string; price_cents?: number })
      : (servicesRaw as { name?: string; price_cents?: number } | null);
  const workers =
    Array.isArray(workersRaw) && workersRaw[0]
      ? (workersRaw[0] as { name?: string })
      : (workersRaw as { name?: string } | null);

  return {
    id: String(raw.id),
    client_name: String(raw.client_name),
    starts_at: String(raw.starts_at),
    ends_at: String(raw.ends_at),
    status: String(raw.status),
    service_id: raw.service_id ? String(raw.service_id) : null,
    manual_service_name: raw.manual_service_name ? String(raw.manual_service_name) : null,
    staff_name: raw.staff_name ? String(raw.staff_name) : null,
    worker_id: raw.worker_id ? String(raw.worker_id) : null,
    source: raw.source ? String(raw.source) : null,
    google_calendar_event_id: raw.google_calendar_event_id ? String(raw.google_calendar_event_id) : null,
    services,
    workers
  };
}

type BookingRow = {
  id: string;
  client_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service_id?: string | null;
  manual_service_name?: string | null;
  staff_name?: string | null;
  worker_id?: string | null;
  source?: string | null;
  google_calendar_event_id?: string | null;
  services?: { name?: string; price_cents?: number } | null;
  workers?: { name?: string } | null;
};

function bookingTitle(booking: BookingRow): string {
  if (booking.services?.name?.trim()) return booking.services.name.trim();
  if (booking.manual_service_name?.trim()) return booking.manual_service_name.trim();
  return 'Appointment';
}

function bookingStaffName(booking: BookingRow): string {
  if (booking.workers?.name?.trim()) return booking.workers.name.trim();
  if (booking.staff_name?.trim()) return booking.staff_name.trim();
  return 'Unassigned';
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function monthEndIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function dayBoundsIso(dateStr: string): { start: string; end: string } {
  return {
    start: `${dateStr}T00:00:00.000Z`,
    end: `${dateStr}T23:59:59.999Z`
  };
}

function parseDayOfWeek(query: string): number | null {
  const q = query.toLowerCase();
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (new RegExp(`\\b${DAY_NAMES[i]}\\b`).test(q)) return i;
  }
  return null;
}

function dateForDayOfWeek(day: number, base = new Date()): string {
  const d = new Date(base);
  let diff = day - d.getDay();
  if (diff < 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

function dayLabel(day: number): string {
  return DAY_NAMES[day].charAt(0).toUpperCase() + DAY_NAMES[day].slice(1);
}

function bookingRevenueCents(booking: BookingRow): number {
  return Number(booking.services?.price_cents || 0);
}

function buildBookingRecord(booking: BookingRow, sourceId: 'bookings' | 'calendar' = 'bookings'): AskEverittSearchRecord {
  const serviceName = bookingTitle(booking);
  const staffName = bookingStaffName(booking);
  const statusLabel = BOOKING_STATUS_LABELS[booking.status] || booking.status;
  const subtitleParts = [`Staff: ${staffName}`];
  if (booking.source) subtitleParts.push(`Source: ${booking.source}`);
  if (booking.google_calendar_event_id) subtitleParts.push('Calendar synced');

  return buildRecord(sourceId, {
    id: booking.id,
    type: sourceId === 'calendar' ? 'calendar' : 'booking',
    title: `${booking.client_name} — ${serviceName}`,
    subtitle: subtitleParts.join(' · '),
    status: statusLabel,
    date: booking.starts_at?.slice(0, 10) || null,
    owner: staffName === 'Unassigned' ? null : staffName,
    href: '/bookings'
  });
}

function extractClientName(query: string): string | null {
  const patterns = [
    /\b(?:for|customer|client)\s+(?:customer|client)\s+([A-Za-z][A-Za-z\s.'-]{1,50})/i,
    /\b(?:appointments?|bookings?)\s+for\s+([A-Za-z][A-Za-z\s.'-]{1,50})/i,
    /\b(?:for)\s+([A-Za-z][A-Za-z\s.'-]{2,50})/i
  ];
  for (const pattern of patterns) {
    const match = query.match(pattern);
    const name = match?.[1]?.trim();
    if (name && !/^(today|tomorrow|this|next|the|a|an|my|all|show|cancelled|canceled)$/i.test(name)) {
      return name.replace(/\b(today|tomorrow|this week|this month)\b.*$/i, '').trim() || null;
    }
  }
  return null;
}

async function loadBookings(
  supabase: SupabaseClient,
  orgId: string,
  opts?: {
    gteStarts?: string;
    lteStarts?: string;
    status?: string;
    statusIn?: string[];
    excludeCancelled?: boolean;
    clientPattern?: string;
    limit?: number;
  }
): Promise<{ rows: BookingRow[]; error: boolean }> {
  let query = supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('organization_id', orgId)
    .order('starts_at', { ascending: true });

  if (opts?.gteStarts) query = query.gte('starts_at', opts.gteStarts);
  if (opts?.lteStarts) query = query.lte('starts_at', opts.lteStarts);
  if (opts?.status) query = query.eq('status', opts.status);
  if (opts?.statusIn?.length) query = query.in('status', opts.statusIn);
  if (opts?.excludeCancelled) query = query.not('status', 'eq', 'cancelled');
  if (opts?.clientPattern) {
    const quoted = `"${opts.clientPattern}"`;
    query = query.or(`client_name.ilike.${quoted},client_email.ilike.${quoted}`);
  }

  const { data, error } = await query.limit(opts?.limit ?? 25);
  if (error) {
    if (isMissingSchemaError(error)) return { rows: [], error: true };
    return { rows: [], error: true };
  }
  return { rows: (data || []).map((row) => normalizeBookingRow(row as Record<string, unknown>)), error: false };
}

async function queryBookingsThisWeek(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const start = isoDate(startOfWeek(new Date()));
  const end = isoDate(addDays(startOfWeek(new Date()), 6));
  const { rows, error } = await loadBookings(supabase, orgId, {
    gteStarts: `${start}T00:00:00.000Z`,
    lteStarts: `${end}T23:59:59.999Z`,
    excludeCancelled: true,
    limit: 25
  });
  if (error) return null;

  const results = rows.map((b) => buildBookingRecord(b));
  const count = rows.length;

  return response(
    count > 0
      ? `${count} booking${count === 1 ? '' : 's'} scheduled this week (${start} to ${end}).`
      : `No bookings scheduled this week (${start} to ${end}).`,
    results,
    {
      sourcesUsed: ['bookings'],
      metrics: [{ label: 'Bookings this week', value: String(count), href: '/bookings' }]
    }
  );
}

async function queryBookingsTomorrow(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const tomorrow = isoDate(addDays(new Date(), 1));
  const bounds = dayBoundsIso(tomorrow);
  const { rows, error } = await loadBookings(supabase, orgId, {
    gteStarts: bounds.start,
    lteStarts: bounds.end,
    excludeCancelled: true,
    limit: 25
  });
  if (error) return null;

  const results = rows.map((b) => buildBookingRecord(b));
  return response(
    results.length > 0
      ? `${results.length} appointment${results.length === 1 ? '' : 's'} tomorrow (${tomorrow}).`
      : `No appointments scheduled for tomorrow (${tomorrow}).`,
    results,
    {
      sourcesUsed: ['bookings'],
      noResultsHint: results.length === 0 ? 'Add bookings on the Bookings page.' : undefined
    }
  );
}

async function queryTopBookedServices(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const monthStart = monthStartIso();
  const { rows, error } = await loadBookings(supabase, orgId, {
    gteStarts: monthStart,
    excludeCancelled: true,
    limit: 500
  });
  if (error) return null;

  const counts = new Map<string, { name: string; count: number; serviceId: string | null }>();
  for (const booking of rows) {
    const name = bookingTitle(booking);
    const key = booking.service_id || `manual:${name.toLowerCase()}`;
    const existing = counts.get(key) || { name, count: 0, serviceId: booking.service_id || null };
    existing.count += 1;
    counts.set(key, existing);
  }

  const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  if (sorted.length === 0) {
    return response('No booked services found this month.', [], {
      sourcesUsed: ['bookings', 'services'],
      noResultsHint: 'Create services and bookings to track popularity.'
    });
  }

  const results: AskEverittSearchRecord[] = sorted.map((entry, index) =>
    buildRecord('services', {
      id: entry.serviceId || `manual-${index}`,
      type: 'service',
      title: entry.name,
      subtitle: `${entry.count} booking${entry.count === 1 ? '' : 's'} this month`,
      status: entry.count === sorted[0].count ? 'Most booked' : null,
      date: null,
      href: '/services'
    })
  );

  return response(
    `${sorted[0].name} is booked most often (${sorted[0].count} time${sorted[0].count === 1 ? '' : 's'} this month).`,
    results,
    { sourcesUsed: ['bookings', 'services'] }
  );
}

async function queryStaffBookedOnDay(
  supabase: SupabaseClient,
  orgId: string,
  query: string
): Promise<AskEverittSearchResponse | null> {
  const day = parseDayOfWeek(query);
  if (day == null) return null;

  const dateStr = dateForDayOfWeek(day);
  const bounds = dayBoundsIso(dateStr);
  const { rows, error } = await loadBookings(supabase, orgId, {
    gteStarts: bounds.start,
    lteStarts: bounds.end,
    excludeCancelled: true,
    limit: 50
  });
  if (error) return null;

  const staffCounts = new Map<string, { name: string; count: number; workerId: string | null }>();
  for (const booking of rows) {
    const name = bookingStaffName(booking);
    const key = booking.worker_id || `manual:${name.toLowerCase()}`;
    const existing = staffCounts.get(key) || { name, count: 0, workerId: booking.worker_id || null };
    existing.count += 1;
    staffCounts.set(key, existing);
  }

  const results = rows.map((b) => buildBookingRecord(b));
  const staffList = Array.from(staffCounts.values())
    .sort((a, b) => b.count - a.count)
    .map((s) => `${s.name} (${s.count})`)
    .join(', ');

  return response(
    results.length > 0
      ? `${results.length} booking${results.length === 1 ? '' : 's'} on ${dayLabel(day)} (${dateStr}).${staffList ? ` Staff: ${staffList}.` : ''}`
      : `No bookings on ${dayLabel(day)} (${dateStr}).`,
    results,
    { sourcesUsed: ['bookings', 'workers'] }
  );
}

async function queryScheduledRevenueThisMonth(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const { rows, error } = await loadBookings(supabase, orgId, {
    gteStarts: monthStartIso(),
    lteStarts: monthEndIso(),
    statusIn: ['confirmed', 'pending', 'completed'],
    limit: 500
  });
  if (error) return null;

  const totalCents = rows.reduce((sum, b) => sum + bookingRevenueCents(b), 0);
  const total = totalCents / 100;

  const results = rows
    .filter((b) => bookingRevenueCents(b) > 0)
    .slice(0, 15)
    .map((b) => {
      const record = buildBookingRecord(b);
      record.subtitle = `${formatCurrency(bookingRevenueCents(b) / 100)} · ${record.subtitle || ''}`.trim();
      return record;
    });

  return response(
    `Scheduled booking revenue this month: ${formatCurrency(total)} across ${rows.length} booking${rows.length === 1 ? '' : 's'}.`,
    results,
    {
      sourcesUsed: ['bookings', 'services', 'revenue'],
      metrics: [
        { label: 'Scheduled revenue this month', value: formatCurrency(total), href: '/bookings' },
        { label: 'Bookings this month', value: String(rows.length), href: '/bookings' }
      ]
    }
  );
}

async function queryCancelledBookings(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('organization_id', orgId)
    .eq('status', 'cancelled')
    .order('starts_at', { ascending: false })
    .limit(25);

  if (error) {
    if (isMissingSchemaError(error)) return null;
    return null;
  }

  const rows = (data || []).map((row) => normalizeBookingRow(row as Record<string, unknown>));
  const results = rows.map((b) => buildBookingRecord(b));

  return response(
    results.length > 0
      ? `${results.length} cancelled booking${results.length === 1 ? '' : 's'}.`
      : 'No cancelled bookings found.',
    results,
    { sourcesUsed: ['bookings'] }
  );
}

async function queryBusiestStaff(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const monthStart = monthStartIso();
  const { rows, error } = await loadBookings(supabase, orgId, {
    gteStarts: monthStart,
    excludeCancelled: true,
    limit: 500
  });
  if (error) return null;

  const counts = new Map<string, { name: string; count: number; workerId: string | null }>();
  for (const booking of rows) {
    const name = bookingStaffName(booking);
    if (name === 'Unassigned') continue;
    const key = booking.worker_id || `manual:${name.toLowerCase()}`;
    const existing = counts.get(key) || { name, count: 0, workerId: booking.worker_id || null };
    existing.count += 1;
    counts.set(key, existing);
  }

  if (counts.size === 0) {
    return response('No staff bookings found this month.', [], {
      sourcesUsed: ['bookings', 'workers'],
      noResultsHint: 'Assign staff to bookings to track workload.'
    });
  }

  const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
  const results: AskEverittSearchRecord[] = sorted.slice(0, 8).map((entry) =>
    buildRecord('workers', {
      id: entry.workerId || entry.name,
      title: entry.name,
      subtitle: `${entry.count} booking${entry.count === 1 ? '' : 's'} this month`,
      status: entry.count === sorted[0].count ? 'Busiest' : null,
      date: null,
      owner: entry.name,
      href: '/workers'
    })
  );

  return response(
    `${sorted[0].name} is the busiest staff member (${sorted[0].count} booking${sorted[0].count === 1 ? '' : 's'} this month).`,
    results,
    { sourcesUsed: ['bookings', 'workers'] }
  );
}

async function queryBookingsForClient(
  supabase: SupabaseClient,
  orgId: string,
  query: string
): Promise<AskEverittSearchResponse | null> {
  const clientName = extractClientName(query);
  if (!clientName) return null;

  const pattern = `%${clientName}%`;
  const { rows, error } = await loadBookings(supabase, orgId, {
    clientPattern: pattern,
    limit: 25
  });
  if (error) return null;

  const results = rows.map((b) => buildBookingRecord(b));
  return response(
    results.length > 0
      ? `${results.length} appointment${results.length === 1 ? '' : 's'} for ${clientName}.`
      : `No appointments found for ${clientName}.`,
    results,
    { sourcesUsed: ['bookings'] }
  );
}

async function queryActiveServices(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, category, duration_minutes, price_cents, is_active')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(25);

  if (error) {
    if (isMissingSchemaError(error)) return null;
    return null;
  }

  const results = (data || []).map((s) =>
    buildRecord('services', {
      id: s.id,
      type: 'service',
      title: s.name,
      subtitle: s.category || `${s.duration_minutes} min · ${formatCurrency(Number(s.price_cents || 0) / 100)}`,
      status: 'Active',
      date: null,
      href: '/services'
    })
  );

  return response(
    results.length > 0
      ? `${results.length} active service${results.length === 1 ? '' : 's'}.`
      : 'No active services found.',
    results,
    { sourcesUsed: ['services'] }
  );
}

async function queryUpcomingCalendarEvents(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const now = new Date().toISOString();
  const { rows, error } = await loadBookings(supabase, orgId, {
    gteStarts: now,
    excludeCancelled: true,
    limit: 20
  });
  if (error) return null;

  const results = rows.map((b) => buildBookingRecord(b, 'calendar'));
  return response(
    results.length > 0
      ? `${results.length} upcoming calendar event${results.length === 1 ? '' : 's'}.`
      : 'No upcoming events on the schedule.',
    results,
    { sourcesUsed: ['calendar', 'bookings'] }
  );
}

async function queryStaffAvailability(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('staff_availability')
    .select('id, day_of_week, starts_at, ends_at, max_bookings, is_active, workers(id, name)')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('day_of_week', { ascending: true })
    .limit(30);

  if (error) {
    if (isMissingSchemaError(error)) return null;
    return null;
  }

  const results = (data || []).map((row) => {
    const worker = row.workers as { id?: string; name?: string } | null;
    const day = DAY_NAMES[row.day_of_week] || `Day ${row.day_of_week}`;
    return buildRecord('availability', {
      id: row.id,
      type: 'availability',
      title: worker?.name ? `${worker.name} — ${day}` : `Availability — ${day}`,
      subtitle: `${String(row.starts_at).slice(0, 5)} – ${String(row.ends_at).slice(0, 5)} · max ${row.max_bookings}`,
      status: 'Available',
      date: null,
      owner: worker?.name || null,
      href: '/services'
    });
  });

  return response(
    results.length > 0
      ? `${results.length} staff availability slot${results.length === 1 ? '' : 's'}.`
      : 'No staff availability configured.',
    results,
    { sourcesUsed: ['availability', 'workers'] }
  );
}

async function queryBookingCount(
  supabase: SupabaseClient,
  orgId: string,
  query: string
): Promise<AskEverittSearchResponse | null> {
  if (!/\bhow many\b|\bcount\b/i.test(query)) return null;

  let gteStarts: string | undefined;
  let lteStarts: string | undefined;
  let label = 'total';

  if (/\bthis week\b/i.test(query)) {
    const start = isoDate(startOfWeek(new Date()));
    const end = isoDate(addDays(startOfWeek(new Date()), 6));
    gteStarts = `${start}T00:00:00.000Z`;
    lteStarts = `${end}T23:59:59.999Z`;
    label = 'this week';
  } else if (/\bthis month\b/i.test(query)) {
    gteStarts = monthStartIso();
    lteStarts = monthEndIso();
    label = 'this month';
  } else if (/\btoday\b/i.test(query)) {
    const today = isoDate(new Date());
    const bounds = dayBoundsIso(today);
    gteStarts = bounds.start;
    lteStarts = bounds.end;
    label = 'today';
  } else {
    return null;
  }

  const { rows, error } = await loadBookings(supabase, orgId, {
    gteStarts,
    lteStarts,
    limit: 500
  });
  if (error) return null;

  const results = rows.slice(0, 10).map((b) => buildBookingRecord(b));
  const count = rows.length;

  return response(`${count} booking${count === 1 ? '' : 's'} ${label}.`, results, {
    sourcesUsed: ['bookings'],
    metrics: [{ label: `Bookings ${label}`, value: String(count), href: '/bookings' }]
  });
}

/** Pattern-matched booking handlers — run before job/schedule handlers. */
export const ASK_EVERITT_BOOKING_QUERY_HANDLERS: { match: RegExp; run: QueryHandler }[] = [
  {
    match:
      /\b(booking|bookings|appointment|appointments)\b.*\b(for|customer|client)\b|\b(show|list)\b.*\b(appointment|booking)s?\b.*\bfor\b/i,
    run: (s, o, q) => queryBookingsForClient(s, o, q)
  },
  {
    match: /\b(how many|count)\b.*\b(booking|bookings|appointment|appointments)\b|\b(booking|bookings)\b.*\b(how many|count)\b/i,
    run: async (s, o, q) => (await queryBookingCount(s, o, q)) ?? (await queryBookingsThisWeek(s, o))
  },
  {
    match:
      /\b(tomorrow|scheduled tomorrow)\b.*\b(booking|bookings|appointment|appointments)\b|\b(booking|bookings|appointment|appointments)\b.*\btomorrow\b/i,
    run: (s, o) => queryBookingsTomorrow(s, o)
  },
  {
    match: /\b(this week|upcoming)\b.*\b(booking|bookings|appointment|appointments)\b|\b(booking|bookings)\b.*\b(this week)\b/i,
    run: (s, o) => queryBookingsThisWeek(s, o)
  },
  {
    match:
      /\b(service|services)\b.*\b(most|popular|booked|often|top)\b|\bwhich\b.*\b(service|services)\b.*\b(book|booked)\b/i,
    run: (s, o) => queryTopBookedServices(s, o)
  },
  {
    match:
      /\b(scheduled|booking)\b.*\b(revenue|income)\b.*\b(month|this month)\b|\b(how much)\b.*\b(scheduled|booking)\b.*\b(revenue)\b/i,
    run: (s, o) => queryScheduledRevenueThisMonth(s, o)
  },
  {
    match: /\b(cancelled|canceled)\b.*\b(booking|bookings|appointment|appointments)\b|\bshow\b.*\b(cancelled|canceled)\b/i,
    run: (s, o) => queryCancelledBookings(s, o)
  },
  {
    match:
      /\b(staff|worker|team member)\b.*\b(busiest|most booked|overloaded|busiest)\b|\bwhich\b.*\b(staff|worker)\b.*\b(busiest|most)\b/i,
    run: (s, o) => queryBusiestStaff(s, o)
  },
  {
    match:
      /\b(who|which staff|which worker)\b.*\b(booked|scheduled)\b.*\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(booked|scheduled)\b.*\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    run: (s, o, q) => queryStaffBookedOnDay(s, o, q)
  },
  {
    match: /\b(active)\b.*\b(service|services)\b|\bshow\b.*\bactive\b.*\b(service|services)\b/i,
    run: (s, o) => queryActiveServices(s, o)
  },
  {
    match:
      /\b(upcoming|next)\b.*\b(event|events|calendar)\b|\b(calendar|schedule)\b.*\b(upcoming|next week|next)\b|\bwhat\b.*\b(next|scheduled today)\b/i,
    run: (s, o) => queryUpcomingCalendarEvents(s, o)
  },
  {
    match: /\b(staff|worker)\b.*\b(availability|available|hours)\b|\b(show|list)\b.*\bavailability\b/i,
    run: (s, o) => queryStaffAvailability(s, o)
  }
];
