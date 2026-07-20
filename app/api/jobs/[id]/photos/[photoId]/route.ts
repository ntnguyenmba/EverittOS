import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextWithRepair } from '@/lib/workspace-server';
import { isValidUuid } from '@/lib/input-validation';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; photoId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: jobId, photoId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(photoId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  if (!isManagerRole(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { data: job } = await admin
    .from('jobs')
    .select('id, organization_id')
    .eq('id', jobId)
    .maybeSingle();

  if (!job || job.organization_id !== org.organizationId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    customer_visible?: boolean;
    customer_caption?: string | null;
  };

  const update: Record<string, unknown> = {};
  if (typeof body.customer_visible === 'boolean') update.customer_visible = body.customer_visible;
  if (body.customer_caption !== undefined) {
    update.customer_caption = body.customer_caption?.trim() || null;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'No changes provided.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('job_photos')
    .update(update)
    .eq('id', photoId)
    .eq('job_id', jobId)
    .select('id, customer_visible, customer_caption')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Photo not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, photo: data });
}
