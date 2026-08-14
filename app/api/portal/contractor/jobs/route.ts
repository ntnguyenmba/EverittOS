import { NextResponse } from 'next/server';
import { loadContractorPortalDashboard } from '@/lib/portal-contractor-jobs';
import { objectHasForbiddenField, CONTRACTOR_FORBIDDEN_FIELDS } from '@/lib/portal-role-financials';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loaded = await loadContractorPortalDashboard({
    supabase,
    userId: user.id,
    email: user.email
  });

  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  if (loaded.notLinked) {
    return NextResponse.json({
      notLinked: true,
      workerName: loaded.workerName,
      jobs: [],
      totals: { assigned: 0, upcoming: 0, completed: 0, total: 0, paid: 0, owed: 0 }
    });
  }

  const payload = {
    notLinked: false,
    workerName: loaded.workerName,
    jobs: loaded.jobs,
    totals: loaded.totals
  };
  const leaked = objectHasForbiddenField(payload, CONTRACTOR_FORBIDDEN_FIELDS);
  if (leaked) {
    return NextResponse.json({ error: 'Forbidden financial field.' }, { status: 500 });
  }

  return NextResponse.json(payload);
}
