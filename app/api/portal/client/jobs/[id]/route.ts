import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { repairClientPortalAccessForUser } from '@/lib/client-portal-repair';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await repairClientPortalAccessForUser(admin, user.id, user.email);

  const { data: access, error: accessError } = await admin
    .from('job_client_access')
    .select('job_id, can_view_photos')
    .eq('client_user_id', user.id)
    .eq('job_id', jobId)
    .maybeSingle();

  if (accessError) {
    return NextResponse.json({ error: accessError.message }, { status: 500 });
  }

  if (!access) {
    return NextResponse.json({ error: 'This job is not shared with your account.' }, { status: 403 });
  }

  const [{ data: job, error: jobError }, { data: reports, error: reportError }, { data: invoices, error: invoiceError }] =
    await Promise.all([
      admin
        .from('jobs')
        .select('id, title, status, customer_notes, due_date')
        .eq('id', jobId)
        .maybeSingle(),
      admin
        .from('job_reports')
        .select('id, title, job_id, share_token, share_revoked_at')
        .eq('job_id', jobId),
      admin
        .from('invoices')
        .select('id, job_id, amount, status, due_date')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
    ]);

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ error: 'This shared job could not be found.' }, { status: 404 });
  }

  return NextResponse.json({
    job,
    reports: reportError ? [] : reports || [],
    invoices: invoiceError ? [] : invoices || [],
    canViewPhotos: access.can_view_photos !== false
  });
}
