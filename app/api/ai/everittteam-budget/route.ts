import { NextResponse } from 'next/server';
import { getEverittteamPoolUsage, isEverittteamAccount } from '@/lib/everittteam-ai-budget';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canViewTeam, isOwner, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getAiApiCopy } from '@/lib/i18n/ai-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const c = getAiApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: c.noWorkspace }, { status: 404 });
  }

  const role = normalizeRole(org.role);
  if (!canViewTeam(role)) {
    return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  }

  let applies = false;
  try {
    applies = await isEverittteamAccount(admin, user.id, org.ownerUserId);
  } catch {
    return NextResponse.json({ error: c.budgetVerificationFailed }, { status: 503 });
  }

  if (!applies) {
    return NextResponse.json({ applies: false });
  }

  const usage = await getEverittteamPoolUsage(admin);
  const owner = isOwner(role);
  const warning = !owner || !usage.applies
    ? null
    : usage.verificationFailed
      ? c.budgetVerificationFailed
      : usage.usedUsd >= usage.budgetUsd
        ? c.budgetLocked
        : usage.percentUsed >= 80
          ? c.budgetWarning
          : null;

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
    verificationFailed: usage.verificationFailed,
    canReset: owner
  });
}
