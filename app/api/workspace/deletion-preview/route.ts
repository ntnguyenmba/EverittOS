import { NextResponse } from 'next/server';
import { isOwner, normalizeRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { fetchWorkspaceDeletionPreview, getAdminClient } from '@/lib/workspace-deletion-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  if (!isOwner(normalizeRole(ctx.workspace.role))) {
    return NextResponse.json({ error: 'Only the workspace owner can view workspace deletion details.' }, { status: 403 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Workspace deletion is temporarily unavailable.' }, { status: 503 });
  }

  const preview = await fetchWorkspaceDeletionPreview(admin, ctx.workspace.organizationId);
  if (!preview) {
    return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  }

  const { data: org } = await admin
    .from('organizations')
    .select('deleted_at, deletion_scheduled_at')
    .eq('id', ctx.workspace.organizationId)
    .maybeSingle();

  return NextResponse.json({
    ...preview,
    scheduledForDeletion: Boolean(org?.deleted_at),
    deletionScheduledAt: org?.deletion_scheduled_at || null
  });
}
