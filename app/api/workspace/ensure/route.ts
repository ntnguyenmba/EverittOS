import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { diagnoseWorkspaceLinkage } from '@/lib/workspace-repair';
import { getCurrentWorkspaceForUser } from '@/lib/workspace-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const WORKSPACE_ENSURE_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('workspace_ensure_timeout')), timeoutMs);
    })
  ]);
}

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  let result;
  try {
    result = await withTimeout(
      getCurrentWorkspaceForUser(supabase, user.id, {
        email: user.email || '',
        userMetadata: user.user_metadata || undefined,
        repair: true
      }),
      WORKSPACE_ENSURE_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'workspace_ensure_timeout') {
      return NextResponse.json(
        {
          error: 'Workspace setup is taking longer than expected. Refresh and try again.',
          code: 'workspace_ensure_timeout'
        },
        { status: 503 }
      );
    }
    throw error;
  }

  if (!result.ok) {
    const admin = createAdminSupabase();
    let diagnosis = null;
    if (admin) {
      try {
        diagnosis = await withTimeout(diagnoseWorkspaceLinkage(admin, user.id), 3000);
      } catch {
        diagnosis = null;
      }
    }

    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        missingRecords: diagnosis?.missingRecords || [],
        diagnosis: diagnosis
          ? {
              userId: diagnosis.userId,
              profileId: diagnosis.profileId,
              workspaceId: diagnosis.workspaceId,
              organizationId: diagnosis.organizationId,
              ownerUserId: diagnosis.ownerUserId,
              membershipId: diagnosis.membershipId,
              missingRecords: diagnosis.missingRecords
            }
          : null
      },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    organizationId: result.workspace.organizationId,
    companyId: result.workspace.companyId,
    ownerUserId: result.workspace.ownerUserId
  });
}
