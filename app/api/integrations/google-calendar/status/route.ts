import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/auth-logger';
import {
  getGoogleCalendarConnection,
  isActiveGoogleCalendarConnection
} from '@/lib/google-calendar-sync';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
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

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  const canManage = canManageOrganizationSettings(normalizeRole(org.role));

  if (!googleCalendarConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        connected: false,
        canManage
      },
      { headers: NO_CACHE_HEADERS }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503, headers: NO_CACHE_HEADERS });
  }

  const connection = await getGoogleCalendarConnection(admin, org.organizationId);
  const connected = isActiveGoogleCalendarConnection(connection);

  logAuthEvent('google_calendar_status', {
    userId: user.id,
    organizationId: org.organizationId,
    connectionFound: Boolean(connection),
    expiryPresent: Boolean(connection?.token_expires_at),
    refreshPresent: Boolean(connection?.refresh_token),
    connected
  });

  return NextResponse.json(
    {
      configured: true,
      connected,
      canManage,
      googleEmail: connected ? connection.google_email || null : null,
      calendarId: connection?.calendar_id || 'primary',
      syncEnabled: connection?.sync_enabled ?? false,
      lastSyncAt: connection?.last_sync_at || null,
      lastSyncError: connection?.last_sync_error || null
    },
    { headers: NO_CACHE_HEADERS }
  );
}
