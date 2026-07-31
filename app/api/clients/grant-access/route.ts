import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageTeam } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { grantJobClientAccess } from '@/lib/client-access-grant-server';

export async function POST(request: Request) {
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

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  const body = (await request.json()) as { email?: string; jobId?: string };
  const email = (body.email || '').trim().toLowerCase();
  const jobId = body.jobId;

  if (!email || !jobId) {
    return NextResponse.json({ error: 'email and jobId are required' }, { status: 400 });
  }

  const { data: job } = await admin
    .from('jobs')
    .select('id, title, organization_id')
    .eq('id', jobId)
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'Job not found in your organization.' }, { status: 404 });
  }

  const result = await grantJobClientAccess({
    admin,
    organizationId: org.organizationId,
    organizationName: org.organizationName,
    grantedByUserId: user.id,
    jobId,
    jobTitle: job.title,
    email,
    plan,
    sendEmail: true
  });

  if (!result.ok) {
    const status = result.code === 'plan_required' ? 403 : result.code === 'invalid_email' ? 400 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({
    ok: true,
    reused: result.reused,
    emailSent: result.emailSent,
    accessGranted: result.accessGranted,
    message: result.message
  });
}
