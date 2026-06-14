import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getGoogleCalendarConnection,
  isActiveGoogleCalendarConnection,
  type GoogleCalendarConnectionRow
} from '@/lib/google-calendar-sync';
import { refreshGoogleAccessToken } from '@/lib/google-calendar-oauth';
import { isRevokedTokenError } from '@/lib/google-calendar-health';
import type { TimeRange } from '@/lib/booking/conflicts';

async function ensureAccessToken(
  admin: SupabaseClient,
  connection: GoogleCalendarConnectionRow
): Promise<string | null> {
  const expiresAt = Date.parse(connection.token_expires_at);
  const stillValid = Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000;
  if (stillValid) return connection.access_token;

  if (!connection.refresh_token?.trim()) return null;

  try {
    const refreshed = await refreshGoogleAccessToken(connection.refresh_token);
    const nextExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await admin
      .from('google_calendar_connections')
      .update({
        access_token: refreshed.access_token,
        token_expires_at: nextExpires,
        last_sync_error: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);
    return refreshed.access_token;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token refresh failed';
    if (isRevokedTokenError(message)) {
      await admin
        .from('google_calendar_connections')
        .update({ last_sync_error: message.slice(0, 500), updated_at: new Date().toISOString() })
        .eq('id', connection.id);
    }
    return null;
  }
}

export async function fetchGoogleCalendarBusyPeriods(
  admin: SupabaseClient,
  organizationId: string,
  timeMin: string,
  timeMax: string
): Promise<TimeRange[]> {
  const connection = await getGoogleCalendarConnection(admin, organizationId);
  if (!isActiveGoogleCalendarConnection(connection)) return [];

  const accessToken = await ensureAccessToken(admin, connection);
  if (!accessToken) return [];

  const calendarId = connection.calendar_id || 'primary';
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: calendarId }]
    })
  });

  if (!res.ok) return [];

  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  };

  const busy = json.calendars?.[calendarId]?.busy || [];
  return busy.map((b) => ({ starts_at: b.start, ends_at: b.end }));
}

export type BookingCalendarInput = {
  clientName: string;
  serviceName: string;
  workerName?: string | null;
  notes?: string | null;
  startsAt: string;
  endsAt: string;
  bookingId: string;
};

export async function createBookingGoogleCalendarEvent(
  admin: SupabaseClient,
  organizationId: string,
  timeZone: string,
  input: BookingCalendarInput
): Promise<{ eventId: string | null; error?: string }> {
  const connection = await getGoogleCalendarConnection(admin, organizationId);
  if (!isActiveGoogleCalendarConnection(connection)) {
    return { eventId: null };
  }

  const accessToken = await ensureAccessToken(admin, connection);
  if (!accessToken) {
    return { eventId: null, error: 'Google Calendar reconnect required.' };
  }

  const calendarId = encodeURIComponent(connection.calendar_id || 'primary');
  const summary = `${input.serviceName} — ${input.clientName}`;
  const description = [
    input.workerName ? `Staff: ${input.workerName}` : null,
    input.notes ? `Notes: ${input.notes}` : null,
    `Booking ID: ${input.bookingId}`
  ]
    .filter(Boolean)
    .join('\n');

  const body = {
    summary,
    description,
    start: { dateTime: new Date(input.startsAt).toISOString(), timeZone },
    end: { dateTime: new Date(input.endsAt).toISOString(), timeZone }
  };

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    return { eventId: null, error: errText || 'Google Calendar create failed.' };
  }

  const created = (await res.json()) as { id?: string };
  return { eventId: created.id || null };
}

export async function deleteBookingGoogleCalendarEvent(
  admin: SupabaseClient,
  organizationId: string,
  eventId: string | null | undefined
): Promise<void> {
  if (!eventId) return;
  const connection = await getGoogleCalendarConnection(admin, organizationId);
  if (!isActiveGoogleCalendarConnection(connection)) return;

  const accessToken = await ensureAccessToken(admin, connection);
  if (!accessToken) return;

  const calendarId = encodeURIComponent(connection.calendar_id || 'primary');
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
}

export function googleCalendarEventUrl(eventId: string | null | undefined): string | null {
  if (!eventId) return null;
  return `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(eventId)}`;
}
