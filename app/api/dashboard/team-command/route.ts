import { NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/roles';
import { fetchTeamCommandCenterData } from '@/lib/team-command-center';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  if (!isAdminRole(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
  }

  const { data, error, warnings } = await fetchTeamCommandCenterData(
    ctx.supabase,
    ctx.workspace.organizationId
  );

  if (!data) {
    console.error('Team Command Center:', error, { warnings, organizationId: ctx.workspace.organizationId });
    return NextResponse.json(
      {
        error: isDevelopment()
          ? error || 'Team Command Center failed to load.'
          : 'We could not load team command center data. Refresh and try again.',
        detail: error || undefined
      },
      { status: 500 }
    );
  }

  if (warnings.length) {
    console.error('Team Command Center warnings:', warnings);
  }

  if (error) {
    console.error('Team Command Center partial load:', error);
  }

  return NextResponse.json(
    isDevelopment() && error ? { ...data, _warnings: warnings, _detail: error } : data
  );
}
