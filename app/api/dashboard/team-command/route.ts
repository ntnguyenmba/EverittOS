import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import { fetchTeamCommandCenterData } from '@/lib/team-command-center';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  if (!isAdminRole(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
  }

  const { data, error } = await fetchTeamCommandCenterData(
    ctx.supabase,
    ctx.workspace.organizationId
  );

  if (error || !data) {
    return NextResponse.json(
      { error: 'We could not load team command center data. Refresh and try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
