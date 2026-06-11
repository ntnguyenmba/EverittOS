import { NextResponse } from 'next/server';
import { getGoogleCalendarConnection } from '@/lib/google-calendar-sync';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { googleCalendarConfigured } from '@/lib/google-calendar-config';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const canManage = canManageOrganizationSettings(normalizeRole(org.role));

  if (!googleCalendarConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      canManage
    });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const connection = await getGoogleCalendarConnection(admin, org.organizationId);

  return NextResponse.json({
    configured: true,
    connected: Boolean(connection),
    canManage,
    googleEmail: connection?.google_email || null,
    calendarId: connection?.calendar_id || 'primary',
    syncEnabled: connection?.sync_enabled ?? false,
    lastSyncAt: connection?.last_sync_at || null,
    lastSyncError: connection?.last_sync_error || null
  });
}
