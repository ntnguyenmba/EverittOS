import { NextResponse } from 'next/server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { googleCalendarConfigured, googleOAuthAuthorizeUrl } from '@/lib/google-calendar-config';
import { createGoogleOAuthState } from '@/lib/google-calendar-oauth-state';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET() {
  if (!googleCalendarConfigured()) {
    return NextResponse.json(
      { error: 'Google Calendar is not configured on this server.' },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const state = createGoogleOAuthState(user.id, org.organizationId);
  const url = googleOAuthAuthorizeUrl(state);
  return NextResponse.redirect(url);
}
