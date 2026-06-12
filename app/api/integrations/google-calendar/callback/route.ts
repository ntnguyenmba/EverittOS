import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/auth-logger';
import { appUrl } from '@/lib/app-url';
import { googleCalendarConfigured } from '@/lib/google-calendar-config';
import { exchangeGoogleAuthCode, fetchGoogleUserEmail } from '@/lib/google-calendar-oauth';
import { verifyGoogleOAuthState } from '@/lib/google-calendar-oauth-state';
import {
  getGoogleCalendarConnection,
  isActiveGoogleCalendarConnection,
  syncOrganizationJobsToGoogleCalendar
} from '@/lib/google-calendar-sync';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function integrationsRedirect(params: Record<string, string>) {
  const url = new URL(appUrl('/settings/integrations'));
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  if (!googleCalendarConfigured()) {
    return integrationsRedirect({ error: 'not_configured' });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) {
    return integrationsRedirect({ error: 'google_denied' });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return integrationsRedirect({ error: 'missing_code' });
  }

  const statePayload = verifyGoogleOAuthState(state);
  if (!statePayload) {
    return integrationsRedirect({ error: 'invalid_state' });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || user.id !== statePayload.userId) {
    return integrationsRedirect({ error: 'session_mismatch' });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (
    !org ||
    org.organizationId !== statePayload.organizationId ||
    !canManageOrganizationSettings(normalizeRole(org.role))
  ) {
    return integrationsRedirect({ error: 'permission_denied' });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return integrationsRedirect({ error: 'server_config' });
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
      return integrationsRedirect({ error: 'missing_refresh_token' });
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
        return integrationsRedirect({ error: 'connect_failed', detail: retryError.message.slice(0, 180) });
      }
    }

    const saved = await getGoogleCalendarConnection(admin, org.organizationId);
    const active = isActiveGoogleCalendarConnection(saved);

    logAuthEvent('google_calendar_callback', {
      userId: user.id,
      organizationId: org.organizationId,
      connectionFound: Boolean(saved),
      expiryPresent: Boolean(saved?.token_expires_at),
      refreshPresent: Boolean(saved?.refresh_token),
      phase: active ? 'saved' : 'verify_failed'
    });

    if (!active) {
      return integrationsRedirect({ error: 'connect_failed', detail: 'Connection was not saved.' });
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

    return integrationsRedirect({ googleCalendar: 'connected' });
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
    return integrationsRedirect({ error: 'connect_failed', detail: message.slice(0, 180) });
  }
}
