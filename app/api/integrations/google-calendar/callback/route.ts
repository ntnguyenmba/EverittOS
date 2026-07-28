import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/auth-logger';
import { appUrl } from '@/lib/app-url';
import { googleCalendarConfigured } from '@/lib/google-calendar-config';
import { exchangeGoogleAuthCode, fetchGoogleUserEmail } from '@/lib/google-calendar-oauth';
import { verifyGoogleOAuthState } from '@/lib/google-calendar-oauth-state';
import { isGoogleCalendarOperational, resolveGoogleCalendarHealth } from '@/lib/google-calendar-health';
import { getGoogleCalendarConnection, syncOrganizationJobsToGoogleCalendar } from '@/lib/google-calendar-sync';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function scheduleRedirect(params: Record<string, string>) {
  const url = new URL(appUrl('/schedule'));
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  if (!googleCalendarConfigured()) {
    return scheduleRedirect({ error: 'not_configured' });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) {
    return scheduleRedirect({ error: 'google_denied' });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return scheduleRedirect({ error: 'missing_code' });
  }

  const statePayload = verifyGoogleOAuthState(state);
  if (!statePayload) {
    return scheduleRedirect({ error: 'invalid_state' });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || user.id !== statePayload.userId) {
    return scheduleRedirect({ error: 'session_mismatch' });
  }

  const org = await fetchOrganizationContextForRequest(supabase, user.id);
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return scheduleRedirect({ error: 'permission_denied' });
  }

  if (org.organizationId !== statePayload.organizationId) {
    logAuthEvent('google_calendar_callback', {
      userId: user.id,
      organizationId: org.organizationId,
      connectionFound: false,
      phase: 'org_mismatch',
      reason: `state=${statePayload.organizationId}`
    });
    return scheduleRedirect({ error: 'permission_denied', detail: 'Workspace changed during sign-in. Try again.' });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return scheduleRedirect({ error: 'server_config' });
  }

  try {
    const tokens = await exchangeGoogleAuthCode(code);

    const { data: existing } = await admin
      .from('google_calendar_connections')
      .select('refresh_token')
      .eq('organization_id', org.organizationId)
      .maybeSingle();

    const refreshToken = tokens.refresh_token || existing?.refresh_token;
    if (!refreshToken) {
      return scheduleRedirect({ error: 'missing_refresh_token' });
    }

    const googleEmail = await fetchGoogleUserEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const row = {
      organization_id: org.organizationId,
      connected_by_user_id: user.id,
      google_email: googleEmail,
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      calendar_id: 'primary',
      sync_enabled: true,
      last_sync_error: null,
      updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await admin
      .from('google_calendar_connections')
      .upsert(row, { onConflict: 'organization_id' });

    if (upsertError) {
      logAuthEvent('google_calendar_callback', {
        userId: user.id,
        organizationId: org.organizationId,
        connectionFound: false,
        expiryPresent: Boolean(expiresAt),
        refreshPresent: Boolean(refreshToken),
        phase: 'upsert_failed',
        reason: upsertError.message
      });

      const { error: retryError } = await admin.from('google_calendar_connections').upsert(
        { ...row, connected_by_user_id: null },
        { onConflict: 'organization_id' }
      );

      if (retryError) {
        return scheduleRedirect({ error: 'connect_failed', detail: retryError.message.slice(0, 180) });
      }
    }

    const saved = await getGoogleCalendarConnection(admin, org.organizationId);
    const health = resolveGoogleCalendarHealth(saved);
    const active = isGoogleCalendarOperational(health);

    logAuthEvent('google_calendar_callback', {
      userId: user.id,
      organizationId: org.organizationId,
      connectionFound: Boolean(saved),
      expiryPresent: Boolean(saved?.token_expires_at),
      refreshPresent: Boolean(saved?.refresh_token),
      phase: active ? 'saved' : 'verify_failed',
      reason: health
    });

    if (!active) {
      return scheduleRedirect({ error: 'connect_failed', detail: 'Connection was not saved.' });
    }

    const { data: settings } = await admin
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', org.organizationId)
      .maybeSingle();

    await syncOrganizationJobsToGoogleCalendar(
      admin,
      org.organizationId,
      settings?.timezone || 'America/New_York'
    );

    return scheduleRedirect({ googleCalendar: 'connected' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google Calendar connection failed.';
    logAuthEvent('google_calendar_callback', {
      userId: user.id,
      organizationId: org.organizationId,
      connectionFound: false,
      expiryPresent: false,
      refreshPresent: false,
      phase: 'exception',
      reason: message.slice(0, 180)
    });
    return scheduleRedirect({ error: 'connect_failed', detail: message.slice(0, 180) });
  }
}
