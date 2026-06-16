import { NextResponse } from 'next/server';
import { isOwner, normalizeRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import {
  getAdminClient,
  scheduleWorkspaceDeletion
} from '@/lib/workspace-deletion-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  if (!isOwner(normalizeRole(ctx.workspace.role))) {
    return NextResponse.json({ error: 'Only the workspace owner can delete this workspace.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const workspaceName = String(body.workspaceName || body.confirmation || '').trim();

  if (workspaceName !== ctx.workspace.organizationName.trim()) {
    return NextResponse.json({ error: 'Type the workspace name exactly to confirm deletion.' }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Workspace deletion is temporarily unavailable.' }, { status: 503 });
  }

  const { data: org } = await admin
    .from('organizations')
    .select('owner_user_id')
    .eq('id', ctx.workspace.organizationId)
    .maybeSingle();

  if (org?.owner_user_id !== ctx.userId) {
    return NextResponse.json({ error: 'You do not have permission to delete this workspace.' }, { status: 403 });
  }

  const result = await scheduleWorkspaceDeletion({
    admin,
    organizationId: ctx.workspace.organizationId,
    ownerUserId: ctx.userId,
    actorEmail: ctx.email,
    cancelSubscription: body.cancelSubscription !== false
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: 'This workspace is scheduled for deletion.',
    deletionScheduledAt: result.deletionScheduledAt
  });
}
