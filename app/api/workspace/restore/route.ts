import { NextResponse } from 'next/server';
import { isOwner, normalizeRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { getAdminClient, restoreWorkspace } from '@/lib/workspace-deletion-server';

export const runtime = 'nodejs';

export async function POST() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  if (!isOwner(normalizeRole(ctx.workspace.role))) {
    return NextResponse.json({ error: 'Only the workspace owner can restore this workspace.' }, { status: 403 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Workspace restore is temporarily unavailable.' }, { status: 503 });
  }

  const result = await restoreWorkspace(admin, ctx.workspace.organizationId, ctx.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: 'Workspace deletion canceled. Your workspace has been restored.' });
}
