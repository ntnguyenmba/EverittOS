import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/auth-logger';
import {
  googleCalendarHealthLabel,
  isGoogleCalendarOperational,
  resolveGoogleCalendarHealth
} from '@/lib/google-calendar-health';
import { getGoogleCalendarConnection } from '@/lib/google-calendar-sync';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { googleCalendarConfigured } from '@/lib/google-calendar-config';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache'
};

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const org = await fetchOrganizationContextForRequest(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  const canManage = canManageOrganizationSettings(normalizeRole(org.role));

  if (!googleCalendarConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        connected: false,
        health: 'not_connected' as const,
        healthLabel: 'Not Connected',
        canManage,
        provider: 'google_calendar'
      },
      { headers: NO_CACHE_HEADERS }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503, headers: NO_CACHE_HEADERS });
  }

  const connection = await getGoogleCalendarConnection(admin, org.organizationId);
  const health = resolveGoogleCalendarHealth(connection);
  const connected = isGoogleCalendarOperational(health);

  logAuthEvent('google_calendar_status', {
    userId: user.id,
    organizationId: org.organizationId,
    connectionFound: Boolean(connection),
    expiryPresent: Boolean(connection?.token_expires_at),
    refreshPresent: Boolean(connection?.refresh_token),
    connected,
    phase: health,
    reason: connection?.last_sync_error?.slice(0, 180)
  });

  return NextResponse.json(
    {
      configured: true,
      connected,
      health,
      healthLabel: googleCalendarHealthLabel(health),
      canManage,
      provider: 'google_calendar',
      organizationId: org.organizationId,
      googleEmail: connected || health === 'reconnect_required' ? connection?.google_email || null : null,
      calendarId: connection?.calendar_id || 'primary',
      syncEnabled: connection?.sync_enabled ?? false,
      tokenExpiresAt: connection?.token_expires_at || null,
      lastSyncAt: connection?.last_sync_at || null,
      lastSyncError: connection?.last_sync_error || null
    },
    { headers: NO_CACHE_HEADERS }
  );
}
