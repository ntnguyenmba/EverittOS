import { NextResponse } from 'next/server';
import { loadContractorPortalJob } from '@/lib/portal-contractor-jobs';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { photoUploadAllowed } from '@/lib/everittos-plans';
import { validatePlanAction } from '@/lib/plan-validate';
import { insertJobPhotoRow } from '@/lib/job-photos-client';
import { buildSafePhotoStoragePath, validateImageUpload } from '@/lib/upload-security';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };
type PhotoTag = 'before' | 'after' | 'progress';

export async function POST(request: Request, context: RouteContext) {
  const { id: jobId } = await context.params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await loadContractorPortalJob({ supabase, userId: user.id, email: user.email, jobId });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (access.job.mode === 'cancelled') return NextResponse.json({ error: 'Cancelled jobs cannot receive photos.' }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get('file');
  const rawTag = String(formData.get('tag') || 'progress').toLowerCase();
  const tag: PhotoTag = rawTag === 'before' || rawTag === 'after' ? rawTag : 'progress';
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a photo first.' }, { status: 400 });

  const validation = validateImageUpload(file);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const orgPlan = await resolveOrganizationPlan(supabase, user.id);
  if (!orgPlan.organizationId || !photoUploadAllowed(orgPlan.plan)) {
    return NextResponse.json({ error: 'Photo uploads are not available for this workspace.' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Photo upload is temporarily unavailable.' }, { status: 503 });

  const { data: job } = await admin.from('jobs').select('id, organization_id, title').eq('id', jobId).maybeSingle();
  if (!job || job.organization_id !== orgPlan.organizationId) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  const { count } = await admin.from('job_photos').select('id', { count: 'exact', head: true }).eq('organization_id', orgPlan.organizationId);
  const planCheck = validatePlanAction({ plan: orgPlan.plan, resource: 'photos', currentCount: count || 0 });
  if (!planCheck.allowed) return NextResponse.json({ error: planCheck.message || 'Photo limit reached.' }, { status: 403 });

  const path = buildSafePhotoStoragePath(user.id, jobId, validation.extension);
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from('job-photos').upload(path, buffer, {
    contentType: file.type || 'image/jpeg',
    cacheControl: '3600',
    upsert: false
  });
  if (uploadError) return NextResponse.json({ error: publicErrorMessage(uploadError) }, { status: 400 });

  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  const uploaderName = profile?.full_name || profile?.email || user.email || 'Team member';
  const saved = await insertJobPhotoRow(admin, {
    userId: user.id,
    jobId,
    organizationId: orgPlan.organizationId,
    storagePath: path,
    photoType: tag,
    fileName: file.name || `photo.${validation.extension}`,
    uploaderDisplayName: uploaderName,
    fileSizeBytes: file.size,
    mimeType: file.type || 'image/jpeg'
  });

  if (saved.error) {
    await admin.storage.from('job-photos').remove([path]);
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  await admin.from('activity_logs').insert({
    organization_id: orgPlan.organizationId,
    user_id: user.id,
    actor_name: uploaderName,
    entity_type: 'job',
    entity_id: jobId,
    action: 'photo_uploaded',
    message: `${tag} photo added to ${job.title || 'job'}`,
    metadata: { tag }
  });

  return NextResponse.json({ ok: true, photo: saved.data });
}
