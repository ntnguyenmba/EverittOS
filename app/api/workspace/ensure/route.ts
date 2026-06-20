import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { diagnoseWorkspaceLinkage } from '@/lib/workspace-repair';
import { getCurrentWorkspaceForUser } from '@/lib/workspace-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const result = await getCurrentWorkspaceForUser(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined,
    repair: true
  });

  if (!result.ok) {
    const admin = createAdminSupabase();
    const diagnosis = admin ? await diagnoseWorkspaceLinkage(admin, user.id) : null;

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
