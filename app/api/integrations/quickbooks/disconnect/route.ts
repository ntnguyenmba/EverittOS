import { NextResponse } from 'next/server';
import { loadQuickBooksConnection, revokeQuickBooksToken } from '@/lib/quickbooks/client';
import { writeQuickBooksSyncLog } from '@/lib/quickbooks/logging';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!canManageOrganizationSettings(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 503 });
  }

  const connection = await loadQuickBooksConnection(admin, ctx.workspace.organizationId);
  let revokeOk = false;
  let intuitTid: string | null = null;

  const tokenToRevoke = connection?.refresh_token || connection?.access_token;
  if (tokenToRevoke) {
    try {
      const revoked = await revokeQuickBooksToken(tokenToRevoke);
      revokeOk = revoked.ok;
      intuitTid = revoked.intuitTid;
    } catch {
      revokeOk = false;
    }
  }

  const { error } = await admin.from('quickbooks_connections').upsert(
    {
      organization_id: ctx.workspace.organizationId,
      provider: 'quickbooks',
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      realm_id: null,
      token_expires_at: null,
      refresh_token_expires_at: null,
      company_name: null,
      last_error: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'organization_id' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeQuickBooksSyncLog(admin, {
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    entityType: 'connection',
    action: 'disconnect',
    status: 'completed',
    intuitTid,
    errorMessage: tokenToRevoke && !revokeOk ? 'Local disconnect completed; Intuit revoke was unavailable.' : null
  });

  return NextResponse.json({
    ok: true,
    message: 'QuickBooks disconnected.',
    revokedAtIntuit: revokeOk
  });
}
