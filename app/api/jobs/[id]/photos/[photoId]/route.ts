import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextWithRepair } from '@/lib/workspace-server';
import { isValidUuid } from '@/lib/input-validation';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getJobPhotosApiCopy } from '@/lib/i18n/job-photos-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; photoId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const c = getJobPhotosApiCopy(localeFromRequest(request));
  const { id: jobId, photoId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(photoId)) {
    return NextResponse.json({ error: c.invalidId }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  }

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org) {
    return NextResponse.json({ error: c.organizationNotFound }, { status: 404 });
  }

  if (!isManagerRole(normalizeRole(org.role))) {
    return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  }

  const { data: job } = await admin
    .from('jobs')
    .select('id, organization_id')
    .eq('id', jobId)
    .maybeSingle();

  if (!job || job.organization_id !== org.organizationId) {
    return NextResponse.json({ error: c.jobNotFound }, { status: 404 });
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
    return NextResponse.json({ error: c.noChanges }, { status: 400 });
  }

  const { data, error } = await admin
    .from('job_photos')
    .update(update)
    .eq('id', photoId)
    .eq('job_id', jobId)
    .select('id, customer_visible, customer_caption')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: c.saveError }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: c.photoNotFound }, { status: 404 });
  }

  return NextResponse.json({ ok: true, photo: data });
}
