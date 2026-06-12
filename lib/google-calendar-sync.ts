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

type GoogleCalendarEventBody = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
};

async function markGoogleCalendarReconnectRequired(
  admin: SupabaseClient,
  connection: GoogleCalendarConnectionRow,
  reason: string
): Promise<void> {
  await admin
    .from('google_calendar_connections')
    .update({
      last_sync_error: reason.slice(0, 500),
      updated_at: new Date().toISOString()
    })
    .eq('id', connection.id);

  logAuthEvent('google_calendar_token_refresh', {
    organizationId: connection.organization_id,
    connectionFound: true,
    refreshPresent: Boolean(connection.refresh_token),
    phase: 'reconnect_required',
    reason: reason.slice(0, 180)
  });
}

async function ensureAccessToken(
  admin: SupabaseClient,
  connection: GoogleCalendarConnectionRow
): Promise<string> {
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

    await admin
      .from('google_calendar_connections')
      .update({
        access_token: refreshed.access_token,
        token_expires_at: nextExpires,
        last_sync_error: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);

    logAuthEvent('google_calendar_token_refresh', {
      organizationId: connection.organization_id,
      connectionFound: true,
      refreshPresent: true,
      expiryPresent: true,
      phase: 'refreshed'
    });

    return refreshed.access_token;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google token refresh failed.';
    if (isRevokedTokenError(message)) {
      await markGoogleCalendarReconnectRequired(admin, connection, message);
    }
    throw err;
  }
}

function buildEventBody(job: JobForCalendarSync, timeZone: string): GoogleCalendarEventBody | null {
  const summary = job.title || 'EverittOS job';
  const lines = [
    job.customer_name ? `Customer: ${job.customer_name}` : null,
    job.status ? `Status: ${job.status}` : null,
    job.notes ? `Notes: ${job.notes}` : null,
    `Open in EverittOS: ${appUrl(`/jobs/${job.id}`)}`
  ].filter(Boolean);

  const description = lines.join('\n');
  const location = job.address || undefined;

  if (job.scheduled_start) {
    const start = new Date(job.scheduled_start);
    const end = job.scheduled_end
      ? new Date(job.scheduled_end)
      : new Date(start.getTime() + 60 * 60 * 1000);

    return {
      summary,
      description,
      location,
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone }
    };
  }

  const allDay = job.due_date || job.start_date;
  if (allDay) {
    const endDate = new Date(`${allDay}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);
    const endIso = endDate.toISOString().slice(0, 10);

    return {
      summary,
      description,
      location,
      start: { date: allDay, timeZone },
      end: { date: endIso, timeZone }
    };
  }

  return null;
}

async function googleCalendarRequest(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });
}

export function isActiveGoogleCalendarConnection(
  connection: GoogleCalendarConnectionRow | null | undefined
): connection is GoogleCalendarConnectionRow {
  if (!connection) return false;
  if (!connection.sync_enabled) return false;
  if (!connection.refresh_token?.trim()) return false;
  if (!connection.access_token?.trim()) return false;
  if (!connection.token_expires_at) return false;
  if (isRevokedTokenError(connection.last_sync_error)) return false;
  return true;
}

export async function getGoogleCalendarConnection(
  admin: SupabaseClient,
  organizationId: string
): Promise<GoogleCalendarConnectionRow | null> {
  const { data, error } = await admin
    .from('google_calendar_connections')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    logAuthEvent('google_calendar_status', {
      organizationId,
      connectionFound: false,
      phase: 'lookup_failed',
      reason: error.message.slice(0, 180)
    });
    return null;
  }
  return (data as GoogleCalendarConnectionRow | null) || null;
}

export async function syncJobToGoogleCalendar(
  admin: SupabaseClient,
  organizationId: string,
  jobId: string,
  timeZone = 'America/New_York'
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const connection = await getGoogleCalendarConnection(admin, organizationId);
  if (!connection || !connection.sync_enabled) {
    return { ok: true, skipped: true };
  }

  const { data: job } = await admin
    .from('jobs')
    .select(
      'id, organization_id, title, status, customer_name, address, notes, scheduled_start, scheduled_end, due_date, start_date'
    )
    .eq('id', jobId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!job) return { ok: false, error: 'Job not found.' };

  const typedJob = job as JobForCalendarSync;
  const accessToken = await ensureAccessToken(admin, connection);
  const calendarId = encodeURIComponent(connection.calendar_id || 'primary');

  const { data: mapping } = await admin
    .from('job_google_calendar_events')
    .select('id, google_event_id')
    .eq('job_id', jobId)
    .maybeSingle();

  const shouldDelete =
    typedJob.status === 'cancelled' || typedJob.status === 'completed' || !buildEventBody(typedJob, timeZone);

  if (shouldDelete && mapping?.google_event_id) {
    const delRes = await googleCalendarRequest(
      accessToken,
      `/calendars/${calendarId}/events/${encodeURIComponent(mapping.google_event_id)}`,
      { method: 'DELETE' }
    );
    if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
      await admin.from('job_google_calendar_events').delete().eq('job_id', jobId);
    }
    return { ok: true };
  }

  const eventBody = buildEventBody(typedJob, timeZone);
  if (!eventBody) return { ok: true, skipped: true };

  if (mapping?.google_event_id) {
    const patchRes = await googleCalendarRequest(
      accessToken,
      `/calendars/${calendarId}/events/${encodeURIComponent(mapping.google_event_id)}`,
      { method: 'PATCH', body: JSON.stringify(eventBody) }
    );

    if (patchRes.ok) {
      await admin
        .from('job_google_calendar_events')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('job_id', jobId);
      return { ok: true };
    }

    if (patchRes.status !== 404 && patchRes.status !== 410) {
      const errText = await patchRes.text();
      return { ok: false, error: errText || 'Google Calendar update failed.' };
    }
  }

  const insertRes = await googleCalendarRequest(accessToken, `/calendars/${calendarId}/events`, {
    method: 'POST',
    body: JSON.stringify(eventBody)
  });

  if (!insertRes.ok) {
    const errText = await insertRes.text();
    return { ok: false, error: errText || 'Google Calendar create failed.' };
  }

  const created = (await insertRes.json()) as { id?: string };
  if (!created.id) return { ok: false, error: 'Google Calendar did not return an event id.' };

  await admin.from('job_google_calendar_events').upsert(
    {
      organization_id: organizationId,
      job_id: jobId,
      google_event_id: created.id,
      calendar_id: connection.calendar_id || 'primary',
      last_synced_at: new Date().toISOString()
    },
    { onConflict: 'job_id' }
  );

  return { ok: true };
}

export async function syncOrganizationJobsToGoogleCalendar(
  admin: SupabaseClient,
  organizationId: string,
  timeZone = 'America/New_York'
): Promise<{ synced: number; failed: number; error?: string }> {
  const connection = await getGoogleCalendarConnection(admin, organizationId);
  if (!connection || !connection.sync_enabled) {
    return { synced: 0, failed: 0, error: 'Google Calendar is not connected.' };
  }

  const { data: jobs } = await admin
    .from('jobs')
    .select('id')
    .eq('organization_id', organizationId)
    .not('status', 'eq', 'cancelled');

  let synced = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const row of jobs || []) {
    const result = await syncJobToGoogleCalendar(admin, organizationId, row.id, timeZone);
    if (result.ok && !result.skipped) synced += 1;
    else if (!result.ok) {
      failed += 1;
      lastError = result.error;
    }
  }

  await admin
    .from('google_calendar_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: failed > 0 ? lastError || 'Some jobs failed to sync.' : null,
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', organizationId);

  return { synced, failed, error: lastError };
}

export async function disconnectGoogleCalendar(
  admin: SupabaseClient,
  organizationId: string,
  userId?: string | null
): Promise<void> {
  await admin.from('job_google_calendar_events').delete().eq('organization_id', organizationId);
  const { error } = await admin.from('google_calendar_connections').delete().eq('organization_id', organizationId);

  logAuthEvent('google_calendar_disconnect', {
    userId: userId || undefined,
    organizationId,
    connectionFound: !error,
    phase: error ? 'delete_failed' : 'deleted',
    reason: error?.message.slice(0, 180)
  });

  if (error) {
    throw new Error(error.message);
  }
}
