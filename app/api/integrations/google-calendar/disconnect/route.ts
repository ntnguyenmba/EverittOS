import { NextResponse } from 'next/server';
import { disconnectGoogleCalendar } from '@/lib/google-calendar-sync';
import { logAuthEvent } from '@/lib/auth-logger';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getCalendarApiCopy } from '@/lib/i18n/calendar-api-copy';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const c = getCalendarApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForRequest(supabase, user.id);
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  try {
    await disconnectGoogleCalendar(admin, org.organizationId, user.id);
    return NextResponse.json({ ok: true, health: 'not_connected' });
  } catch (err) {
    const internalMessage = err instanceof Error ? err.message : 'Disconnect failed.';
    logAuthEvent('google_calendar_disconnect', { userId: user.id, organizationId: org.organizationId, connectionFound: false, phase: 'delete_failed', reason: internalMessage.slice(0, 180) });
    return NextResponse.json({ error: c.disconnectFailed }, { status: 500 });
  }
}
