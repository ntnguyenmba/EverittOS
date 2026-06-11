import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id: jobId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const photoId = new URL(request.url).searchParams.get('photoId');
  if (!photoId) {
    return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { data: job } = await admin
    .from('jobs')
    .select('id, organization_id, title')
    .eq('id', jobId)
    .maybeSingle();

  if (!job || job.organization_id !== org.organizationId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: photo } = await admin
    .from('job_photos')
    .select('id, user_id, storage_path, organization_id, label')
    .eq('id', photoId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  const role = normalizeRole(org.role);
  const isUploader = photo.user_id === user.id;
  const canDelete = isUploader || isManagerRole(role);

  if (!canDelete) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  await admin.storage.from('job-photos').remove([photo.storage_path]);

  const { error } = await admin.from('job_photos').delete().eq('id', photoId).eq('job_id', jobId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  const actorName = profile?.full_name || profile?.email || user.email || 'Team member';

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
