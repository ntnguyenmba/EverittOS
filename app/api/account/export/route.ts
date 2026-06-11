import { NextResponse } from 'next/server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/** GDPR-style personal data export for the authenticated user. */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);

  const [
    { data: profile },
    { data: businessProfile },
    { data: jobs },
    { data: customers },
    { data: workers },
    { data: activity }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('business_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    org?.organizationId
      ? supabase.from('jobs').select('*').eq('organization_id', org.organizationId).limit(5000)
      : Promise.resolve({ data: [] }),
    org?.organizationId
      ? supabase.from('customers').select('*').eq('organization_id', org.organizationId).limit(5000)
      : Promise.resolve({ data: [] }),
    org?.organizationId
      ? supabase.from('workers').select('*').eq('organization_id', org.organizationId).limit(5000)
      : Promise.resolve({ data: [] }),
    org?.organizationId
      ? supabase
          .from('activity_logs')
          .select('id, action, message, entity_type, entity_id, created_at')
          .eq('organization_id', org.organizationId)
          .or(`actor_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(1000)
      : Promise.resolve({ data: [] })
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at
    },
    profile,
    businessProfile,
    organization: org
      ? {
          organizationId: org.organizationId,
          organizationName: org.organizationName,
          role: org.role
        }
      : null,
    jobs: jobs || [],
    customers: customers || [],
    workers: workers || [],
    activity: activity || []
  };

  const filename = `everittos-data-export-${user.id.slice(0, 8)}.json`;

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}
