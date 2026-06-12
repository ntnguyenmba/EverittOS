import { NextResponse } from 'next/server';
import { resetEverittteamBudget } from '@/lib/everittteam-ai-budget';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { isOwner, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: 'No active workspace found.' }, { status: 404 });
  }

  const role = normalizeRole(org.role);
  if (!isOwner(role)) {
    return NextResponse.json({ error: 'Only the workspace owner can reset the AI budget.' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  try {
    await resetEverittteamBudget(admin);
    return NextResponse.json({ ok: true, message: 'EVERITTTEAM AI budget has been reset for this month.' });
  } catch {
    return NextResponse.json({ error: 'Could not reset AI budget. Please try again.' }, { status: 503 });
  }
}
