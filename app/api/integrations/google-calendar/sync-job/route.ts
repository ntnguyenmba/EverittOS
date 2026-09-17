import { NextResponse } from 'next/server';
import { syncJobToGoogleCalendarSafe } from '@/lib/google-calendar-sync-job';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { canAssignJobs, normalizeRole } from '@/lib/roles';
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
  if (!org || !canAssignJobs(normalizeRole(org.role))) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { jobId?: string };
  if (!body.jobId) return NextResponse.json({ error: c.jobIdRequired }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  const { data: job } = await admin.from('jobs').select('id').eq('id', body.jobId).eq('organization_id', org.organizationId).maybeSingle();
  if (!job) return NextResponse.json({ error: c.jobNotFound }, { status: 404 });

  const result = await syncJobToGoogleCalendarSafe(admin, org.organizationId, body.jobId);
  if (!result.ok) return NextResponse.json({ error: c.syncFailed }, { status: 502 });
  return NextResponse.json({ ok: true });
}
