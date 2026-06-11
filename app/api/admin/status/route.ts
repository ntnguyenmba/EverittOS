import { NextResponse } from 'next/server';
import { isPlatformAdminEmail } from '@/lib/platform-admin';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration incomplete.' }, { status: 503 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [orgs, users, activeUsers, storagePhotos, securityEvents, errorsProbe] = await Promise.all([
    admin.from('organizations').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('active', true),
    admin.from('job_photos').select('id', { count: 'exact', head: true }),
    admin
      .from('security_events')
      .select('id, event_type, severity, message, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    admin.from('activity_logs').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo)
  ]);

  let databaseHealth: 'ok' | 'warn' | 'fail' = 'ok';
  try {
    const probe = await admin.from('profiles').select('id').limit(1);
    if (probe.error) databaseHealth = 'fail';
  } catch {
    databaseHealth = 'fail';
  }

  const apiHealth: 'ok' | 'warn' = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'ok' : 'warn';

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    databaseHealth,
    apiHealth,
    storageUsage: {
      photos: storagePhotos.count || 0,
      label: `${storagePhotos.count || 0} job photos stored`
    },
    activeUsers: activeUsers.count || 0,
    organizationCount: orgs.count || 0,
    totalUsers: users.count || 0,
    recentActivityEvents30d: errorsProbe.count || 0,
    recentSecurityEvents: securityEvents.data || []
  });
}
