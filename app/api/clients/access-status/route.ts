import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageTeam } from '@/lib/roles';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageTeam(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const jobId = new URL(request.url).searchParams.get('jobId')?.trim();
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const { data: job } = await admin
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: rows, error } = await admin
    .from('job_client_access')
    .select('client_user_id, portal_token, granted_at')
    .eq('job_id', jobId)
    .eq('organization_id', org.organizationId)
    .order('granted_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userIds = Array.from(new Set((rows || []).map((row) => row.client_user_id).filter(Boolean)));
  const emailByUserId = new Map<string, string | null>();

  if (userIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, email').in('id', userIds);
    for (const profile of profiles || []) {
      emailByUserId.set(profile.id, profile.email || null);
    }
  }

  return NextResponse.json({
    access: (rows || []).map((row) => ({
      client_user_id: row.client_user_id,
      portal_token: row.portal_token || null,
      granted_at: row.granted_at || null,
      email: emailByUserId.get(row.client_user_id) || null
    }))
  });
}
