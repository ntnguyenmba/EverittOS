import { NextResponse } from 'next/server';
import type { OrganizationContext } from '@/lib/organization-server';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getCalendarApiCopy } from '@/lib/i18n/calendar-api-copy';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const CALENDAR_IMPORT_NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache'
};

export type CalendarImportAuth =
  | { ok: true; user: User; org: OrganizationContext; admin: SupabaseClient }
  | { ok: false; response: NextResponse };

export async function requireCalendarImportManager(request?: Request): Promise<CalendarImportAuth> {
  const c = getCalendarApiCopy(request ? localeFromRequest(request) : 'en');
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: c.unauthorized },
        { status: 401, headers: CALENDAR_IMPORT_NO_CACHE }
      )
    };
  }

  const org = await fetchOrganizationContextForRequest(supabase, user.id);
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: c.permissionDenied },
        { status: 403, headers: CALENDAR_IMPORT_NO_CACHE }
      )
    };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: c.serverUnavailable },
        { status: 503, headers: CALENDAR_IMPORT_NO_CACHE }
      )
    };
  }

  return { ok: true, user, org, admin };
}
