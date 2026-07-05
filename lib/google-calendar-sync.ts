import type { SupabaseClient } from '@supabase/supabase-js';
import { logAuthEvent } from '@/lib/auth-logger';
import { appUrl } from '@/lib/app-url';
import { isRevokedTokenError } from '@/lib/google-calendar-health';
import { refreshGoogleAccessToken } from '@/lib/google-calendar-oauth';

export type GoogleCalendarConnectionRow = {
  id: string;
  organization_id: string;
  connected_by_user_id: string | null;
  google_email: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  calendar_id: string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
};

export type JobForCalendarSync = {
  id: string;
  organization_id: string;
  title: string;
  status: string | null;
  customer_name: string | null;
  address: string | null;
  notes: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  due_date: string | null;
  start_date: string | null;
};

type JobVisitForCalendarSync = {
  id: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
};

type CalendarMapping = {
  id: string;
  google_event_id: string;
};

type GoogleCalendarEventBody = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
};

async function markGoogleCalendarReconnectRequired(admin: SupabaseClient, connection: GoogleCalendarConnectionRow, reason: string): Promise<void> {
  await admin.from('google_calendar_connections').update({ last_sync_error: reason.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', connection.id);
  logAuthEvent('google_calendar_token_refresh', { organizationId: connection.organization_id, connectionFound: true, refreshPresent: Boolean(connection.refresh_token), phase: 'reconnect_required', reason: reason.slice(0, 180) });
}

async function ensureAccessToken(admin: SupabaseClient, connection: GoogleCalendarConnectionRow): Promise<string> {
  const expiresAt = Date.parse(connection.token_expires_at);
  const stillValid = Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000;
  if (stillValid) return connection.access_token;
  if (!connection.refresh_token?.trim()) {
    await markGoogleCalendarReconnectRequired(admin, connection, 'Missing refresh token.');
    throw new Error('Google Calendar reconnect required: missing refresh token.');
  }
  try {
    const refreshed = await refreshGoogleAccessToken(connection.refresh_token);
    const nextExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await admin.from('google_calendar_connections').update({ access_token: refreshed.access_token, token_expires_at: nextExpires, last_sync_error: null, updated_at: new Date().toISOString() }).eq('id', connection.id);
    logAuthEvent('google_calendar_token_refresh', { organizationId: connection.organization_id, connectionFound: true, refreshPresent: true, expiryPresent: true, phase: 'refreshed' });
    return refreshed.access_token;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google token refresh failed.';
    if (isRevokedTokenError(message)) await markGoogleCalendarReconnectRequired(admin, connection, message);
    throw err;
  }
}

function eventDescription(job: JobForCalendarSync, extraNote?: string | null): string {
  return [
    job.customer_name ? `Customer: ${job.customer_name}` : null,
    job.status ? `Status: ${job.status}` : null,
    job.notes ? `Notes: ${job.notes}` : null,
    extraNote ? `Visit notes: ${extraNote}` : null,
    `Open in EverittOS: ${appUrl(`/jobs/${job.id}`)}`
  ].filter(Boolean).join('\n');
}

function buildEventBody(job: JobForCalendarSync, timeZone: string): GoogleCalendarEventBody | null {
  const summary = job.title || 'EverittOS job';
  const description = eventDescription(job);
  const location = job.address || undefined;
  if (job.scheduled_start) {
    const start = new Date(job.scheduled_start);
    const end = job.scheduled_end ? new Date(job.scheduled_end) : new Date(start.getTime() + 60 * 60 * 1000);
    return { summary, description, location, start: { dateTime: start.toISOString(), timeZone }, end: { dateTime: end.toISOString(), timeZone } };
  }
  const allDay = job.due_date || job.start_date;
  if (allDay) {
    const endDate = new Date(`${allDay}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);
    return { summary, description, location, start: { date: allDay, timeZone }, end: { date: endDate.toISOString().slice(0, 10), timeZone } };
  }
  return null;
}

function buildVisitEventBody(job: JobForCalendarSync, visit: JobVisitForCalendarSync, timeZone: string): GoogleCalendarEventBody {
  const summary = job.title || 'EverittOS job';
  return {
    summary,
    description: eventDescription(job, visit.notes),
    location: job.address || undefined,
    start: { dateTime: new Date(`${visit.visit_date}T${visit.start_time}`).toISOString(), timeZone },
    end: { dateTime: new Date(`${visit.visit_date}T${visit.end_time}`).toISOString(), timeZone }
  };
}

async function googleCalendarRequest(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init?.headers || {}) } });
}

async function clearExistingCalendarEvents(admin: SupabaseClient, accessToken: string, calendarId: string, jobId: string): Promise<void> {
  const { data: mappings } = await admin.from('job_google_calendar_events').select('id, google_event_id').eq('job_id', jobId);
  for (const mapping of ((mappings || []) as CalendarMapping[])) {
    await googleCalendarRequest(accessToken, `/calendars/${calendarId}/events/${encodeURIComponent(mapping.google_event_id)}`, { method: 'DELETE' });
  }
  await admin.from('job_google_calendar_events').delete().eq('job_id', jobId);
}

export function isActiveGoogleCalendarConnection(connection: GoogleCalendarConnectionRow | null | undefined): connection is GoogleCalendarConnectionRow {
  if (!connection) return false;
  if (!connection.sync_enabled) return false;
  if (!connection.refresh_token?.trim()) return false;
  if (!connection.access_token?.trim()) return false;
  if (!connection.token_expires_at) return false;
  if (isRevokedTokenError(connection.last_sync_error)) return false;
  return true;
}

export async function getGoogleCalendarConnection(admin: SupabaseClient, organizationId: string): Promise<GoogleCalendarConnectionRow | null> {
  const { data, error } = await admin.from('google_calendar_connections').select('*').eq('organization_id', organizationId).maybeSingle();
  if (error) {
    logAuthEvent('google_calendar_status', { organizationId, connectionFound: false, phase: 'lookup_failed', reason: error.message.slice(0, 180) });
    return null;
  }
  return (data as GoogleCalendarConnectionRow | null) || null;
}

export async function syncJobToGoogleCalendar(admin: SupabaseClient, organizationId: string, jobId: string, timeZone = 'America/New_York'): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const connection = await getGoogleCalendarConnection(admin, organizationId);
  if (!connection || !connection.sync_enabled) return { ok: true, skipped: true };
  const { data: job } = await admin.from('jobs').select('id, organization_id, title, status, customer_name, address, notes, scheduled_start, scheduled_end, due_date, start_date').eq('id', jobId).eq('organization_id', organizationId).maybeSingle();
  if (!job) return { ok: false, error: 'Job not found.' };

  const typedJob = job as JobForCalendarSync;
  const accessToken = await ensureAccessToken(admin, connection);
  const calendarId = encodeURIComponent(connection.calendar_id || 'primary');
  const shouldRemove = typedJob.status === 'cancelled' || typedJob.status === 'completed';
  if (shouldRemove) {
    await clearExistingCalendarEvents(admin, accessToken, calendarId, jobId);
    return { ok: true };
  }

  const { data: visits } = await admin.from('job_visits').select('id, visit_date, start_time, end_time, notes').eq('job_id', jobId).eq('organization_id', organizationId).order('visit_date', { ascending: true }).order('start_time', { ascending: true });
  const visitRows = (visits || []) as JobVisitForCalendarSync[];

  await clearExistingCalendarEvents(admin, accessToken, calendarId, jobId);

  if (visitRows.length > 0) {
    for (const visit of visitRows) {
      const insertRes = await googleCalendarRequest(accessToken, `/calendars/${calendarId}/events`, { method: 'POST', body: JSON.stringify(buildVisitEventBody(typedJob, visit, timeZone)) });
      if (!insertRes.ok) return { ok: false, error: (await insertRes.text()) || 'Google Calendar create failed.' };
      const created = (await insertRes.json()) as { id?: string };
      if (!created.id) return { ok: false, error: 'Google Calendar did not return an event id.' };
      await admin.from('job_google_calendar_events').insert({ organization_id: organizationId, job_id: jobId, visit_id: visit.id, google_event_id: created.id, calendar_id: connection.calendar_id || 'primary', last_synced_at: new Date().toISOString() });
    }
    return { ok: true };
  }

  const eventBody = buildEventBody(typedJob, timeZone);
  if (!eventBody) return { ok: true, skipped: true };
  const insertRes = await googleCalendarRequest(accessToken, `/calendars/${calendarId}/events`, { method: 'POST', body: JSON.stringify(eventBody) });
  if (!insertRes.ok) return { ok: false, error: (await insertRes.text()) || 'Google Calendar create failed.' };
  const created = (await insertRes.json()) as { id?: string };
  if (!created.id) return { ok: false, error: 'Google Calendar did not return an event id.' };
  await admin.from('job_google_calendar_events').insert({ organization_id: organizationId, job_id: jobId, google_event_id: created.id, calendar_id: connection.calendar_id || 'primary', last_synced_at: new Date().toISOString() });
  return { ok: true };
}

export async function syncOrganizationJobsToGoogleCalendar(admin: SupabaseClient, organizationId: string, timeZone = 'America/New_York'): Promise<{ synced: number; failed: number; error?: string }> {
  const connection = await getGoogleCalendarConnection(admin, organizationId);
  if (!connection || !connection.sync_enabled) return { synced: 0, failed: 0, error: 'Google Calendar is not connected.' };
  const { data: jobs } = await admin.from('jobs').select('id').eq('organization_id', organizationId).not('status', 'eq', 'cancelled');
  let synced = 0;
  let failed = 0;
  let lastError: string | undefined;
  for (const row of jobs || []) {
    const result = await syncJobToGoogleCalendar(admin, organizationId, row.id, timeZone);
    if (result.ok) synced += 1;
    else {
      failed += 1;
      lastError = result.error;
    }
  }
  return { synced, failed, error: lastError };
}
