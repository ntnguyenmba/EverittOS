import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextWithRepair } from '@/lib/workspace-server';
import { fetchJobPhotosWithUrls } from '@/lib/job-photos-client';
import { isValidUuid } from '@/lib/input-validation';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getJobPhotosApiCopy } from '@/lib/i18n/job-photos-api-copy';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const c = getJobPhotosApiCopy(localeFromRequest(request));
  const { id: jobId } = await params;
  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: c.invalidJobId }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  }

  const { photos, error } = await fetchJobPhotosWithUrls(supabase, jobId);

  if (error) {
    return NextResponse.json({ error: c.loadError }, { status: 400 });
  }

  return NextResponse.json({ photos });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const c = getJobPhotosApiCopy(localeFromRequest(request));
  const { id: jobId } = await params;
  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: c.invalidJobId }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  }

  const photoId = new URL(request.url).searchParams.get('photoId');
  if (!photoId || !isValidUuid(photoId)) {
    return NextResponse.json({ error: c.photoIdRequired }, { status: 400 });
  }

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org) {
    return NextResponse.json({ error: c.organizationNotFound }, { status: 404 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  }

  const { data: job } = await admin
    .from('jobs')
    .select('id, organization_id, title')
    .eq('id', jobId)
    .maybeSingle();

  if (!job || job.organization_id !== org.organizationId) {
    return NextResponse.json({ error: c.jobNotFound }, { status: 404 });
  }

  const { data: photo } = await admin
    .from('job_photos')
    .select('id, user_id, storage_path, organization_id, label')
    .eq('id', photoId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: c.photoNotFound }, { status: 404 });
  }

  const role = normalizeRole(org.role);
  const isUploader = photo.user_id === user.id;
  const canDelete = isUploader || isManagerRole(role);

  if (!canDelete) {
    return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  }

  const { error: storageError } = await admin.storage.from('job-photos').remove([photo.storage_path]);
  if (storageError) {
    return NextResponse.json({ error: c.deleteError }, { status: 400 });
  }

  const { error } = await admin.from('job_photos').delete().eq('id', photoId).eq('job_id', jobId);

  if (error) {
    return NextResponse.json({ error: c.deleteError }, { status: 400 });
  }

  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  const actorName = profile?.full_name || profile?.email || user.email || c.teamMember;

  await admin.from('activity_logs').insert({
    organization_id: org.organizationId,
    user_id: user.id,
    actor_name: actorName,
    entity_type: 'job',
    entity_id: jobId,
    action: 'job_edited',
    message: `Removed ${photo.label} photo from ${job.title}`,
    metadata: { photoId, label: photo.label }
  });

  return NextResponse.json({ ok: true });
}
