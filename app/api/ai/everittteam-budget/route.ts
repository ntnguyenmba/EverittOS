import { NextResponse } from 'next/server';
import {
  getEverittteamBudgetWarning,
  getEverittteamPoolUsage,
  isEverittteamAccount
} from '@/lib/everittteam-ai-budget';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canViewTeam, isOwner, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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
  if (!canViewTeam(role)) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const applies = await isEverittteamAccount(admin, user.id, org.ownerUserId);
  if (!applies) {
    return NextResponse.json({ applies: false });
  }

  const usage = await getEverittteamPoolUsage(admin);
  const warning = getEverittteamBudgetWarning(usage, isOwner(role));

  return NextResponse.json({
    applies: true,
    budgetUsd: usage.budgetUsd,
    usedUsd: usage.usedUsd,
    remainingUsd: usage.remainingUsd,
    percentUsed: usage.percentUsed,
    periodStart: usage.periodStart,
    manualResetAt: usage.manualResetAt,
    byUser: usage.byUser,
    warning,
    canReset: isOwner(role)
  });
}
