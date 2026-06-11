import { NextResponse } from 'next/server';
import { syncOrganizationJobsToGoogleCalendar } from '@/lib/google-calendar-sync';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST() {
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

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { data: settings } = await admin
    .from('organization_settings')
    .select('timezone')
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  const result = await syncOrganizationJobsToGoogleCalendar(
    admin,
    org.organizationId,
    settings?.timezone || 'America/New_York'
  );

  if (result.error && result.synced === 0 && result.failed === 0) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    synced: result.synced,
    failed: result.failed,
    error: result.failed > 0 ? result.error : null
  });
}
