import { NextResponse } from 'next/server';
import { canManageOrganizationSettings } from '@/lib/roles';
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

  const { error } = await ctx.supabase
    .from('quickbooks_connections')
    .upsert(
      {
        organization_id: ctx.workspace.organizationId,
        provider: 'quickbooks',
        status: 'disconnected',
        access_token: null,
        refresh_token: null,
        realm_id: null,
        token_expires_at: null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'organization_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await ctx.supabase.from('quickbooks_sync_logs').insert({
    organization_id: ctx.workspace.organizationId,
    user_id: ctx.userId,
    entity_type: 'connection',
    action: 'disconnect',
    direction: 'export',
    status: 'completed'
  });

  return NextResponse.json({ ok: true, message: 'QuickBooks disconnected.' });
}
