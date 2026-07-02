import { NextResponse } from 'next/server';
import { quickbooksConfigured, quickbooksMissingCredentialsMessage } from '@/lib/quickbooks';
import { isValidUuid } from '@/lib/input-validation';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isManagerRole } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function logSyncAttempt(input: {
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase-server').createServerSupabase>>;
  organizationId: string;
  userId: string;
  entityType: string;
  entityId: string | null;
  action: string;
  status: string;
  errorMessage?: string;
  externalId?: string;
}) {
  await input.supabase.from('quickbooks_sync_logs').insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    direction: 'export',
    status: input.status,
    external_id: input.externalId || null,
    error_message: input.errorMessage || null
  });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!isManagerRole(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { customer_id?: string };
  const customerId = body.customer_id?.trim();
  if (!customerId || !isValidUuid(customerId)) {
    return NextResponse.json({ error: 'Valid customer id is required.' }, { status: 400 });
  }

  if (!quickbooksConfigured()) {
    await logSyncAttempt({
      supabase: ctx.supabase,
      organizationId: ctx.workspace.organizationId,
      userId: ctx.userId,
      entityType: 'customer',
      entityId: customerId,
      action: 'sync_customer',
      status: 'failed',
      errorMessage: quickbooksMissingCredentialsMessage()
    });
    return NextResponse.json({ error: quickbooksMissingCredentialsMessage() }, { status: 503 });
  }

  const { data: connection } = await ctx.supabase
    .from('quickbooks_connections')
    .select('status, realm_id')
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (!connection || connection.status !== 'connected') {
    await logSyncAttempt({
      supabase: ctx.supabase,
      organizationId: ctx.workspace.organizationId,
      userId: ctx.userId,
      entityType: 'customer',
      entityId: customerId,
      action: 'sync_customer',
      status: 'failed',
      errorMessage: 'QuickBooks is not connected for this workspace.'
    });
    return NextResponse.json({ error: 'Connect QuickBooks before syncing customers.' }, { status: 400 });
  }

  const { data: customer } = await ctx.supabase
    .from('customers')
    .select('id, company_name, email, phone')
    .eq('id', customerId)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  await logSyncAttempt({
    supabase: ctx.supabase,
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    entityType: 'customer',
    entityId: customerId,
    action: 'sync_customer',
    status: 'queued',
    errorMessage: 'Customer sync is queued. Full QuickBooks API mapping will complete once credentials are verified.'
  });

  await ctx.supabase
    .from('quickbooks_connections')
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('organization_id', ctx.workspace.organizationId);

  return NextResponse.json({
    ok: true,
    message: 'Customer sync logged. QuickBooks remains your accounting system of record.'
  });
}
