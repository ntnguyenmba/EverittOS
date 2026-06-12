import { NextResponse } from 'next/server';
import { syncJobToGoogleCalendarSafe } from '@/lib/google-calendar-sync-job';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canAssignJobs, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canAssignJobs(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { jobId?: string };
  if (!body.jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { data: job } = await admin
    .from('jobs')
    .select('id')
    .eq('id', body.jobId)
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  await syncJobToGoogleCalendarSafe(admin, org.organizationId, body.jobId);
  return NextResponse.json({ ok: true });
}
