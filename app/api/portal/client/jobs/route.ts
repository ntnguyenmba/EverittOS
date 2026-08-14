import { NextResponse } from 'next/server';
import { loadClientPortalJobs } from '@/lib/portal-client-jobs';
import { objectHasForbiddenField, CLIENT_FORBIDDEN_FIELDS } from '@/lib/portal-role-financials';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loaded = await loadClientPortalJobs({
    admin,
    userId: user.id,
    email: user.email
  });

  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const payload = { jobs: loaded.jobs };
  const leaked = objectHasForbiddenField(payload, CLIENT_FORBIDDEN_FIELDS);
  if (leaked) {
    return NextResponse.json({ error: 'Forbidden financial field.' }, { status: 500 });
  }

  return NextResponse.json(payload);
}
