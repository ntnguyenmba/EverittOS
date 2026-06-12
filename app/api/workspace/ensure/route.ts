import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
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
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    organizationId: result.workspace.organizationId,
    companyId: result.workspace.companyId
  });
}
