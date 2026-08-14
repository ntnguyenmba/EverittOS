import { NextResponse } from 'next/server';
import { loadContractorPortalJob } from '@/lib/portal-contractor-jobs';
import { objectHasForbiddenField, CONTRACTOR_FORBIDDEN_FIELDS } from '@/lib/portal-role-financials';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loaded = await loadContractorPortalJob({
    supabase,
    userId: user.id,
    email: user.email,
    jobId
  });

  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const leaked = objectHasForbiddenField(loaded.job, CONTRACTOR_FORBIDDEN_FIELDS);
  if (leaked) {
    return NextResponse.json({ error: 'Forbidden financial field.' }, { status: 500 });
  }

  return NextResponse.json({ job: loaded.job });
}

/**
 * Contractor job records are read-only.
 * Purpose-built workflow endpoints should handle explicit actions such as
 * starting work, completing work, or uploading job photos.
 */
export async function PATCH() {
  return NextResponse.json(
    { error: 'Contractor job details are read-only.' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}
