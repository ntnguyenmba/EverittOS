import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { buildCustomerUpdatePayload, customerDisplayName } from '@/lib/customer-record';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_RECORD_TYPES = new Set(['lead', 'customer', 'staffing']);

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    displayName?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    logo_path?: string | null;
    pipeline_stage?: string;
    lead_source?: string;
    record_type?: string;
    assigned_to?: string | null;
  };

  const ownershipFilter = `organization_id.eq.${ctx.workspace.organizationId},user_id.eq.${ctx.userId}`;

  const { data: existing, error: readError } = await ctx.supabase
    .from('customers')
    .select('id, company_name, phone, email, pipeline_stage, record_type')
    .eq('id', id)
    .or(ownershipFilter)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  if (body.record_type && !VALID_RECORD_TYPES.has(body.record_type)) {
    return NextResponse.json({ error: 'Invalid record type.' }, { status: 400 });
  }

  if (body.assigned_to) {
    const { data: assignee } = await ctx.supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', ctx.workspace.organizationId)
      .eq('user_id', body.assigned_to)
      .eq('active', true)
      .maybeSingle();
    if (!assignee) {
      return NextResponse.json({ error: 'Assigned team member is not active in this workspace.' }, { status: 400 });
    }
  }

  const payload = buildCustomerUpdatePayload({
    displayName: body.displayName,
    phone: body.phone,
    email: body.email,
    address: body.address,
    notes: body.notes,
    pipeline_stage: body.pipeline_stage,
    lead_source: body.lead_source,
    record_type: body.record_type,
    assigned_to: body.assigned_to
  });

  if (body.record_type === 'customer' && body.pipeline_stage === undefined) {
    payload.pipeline_stage = 'active';
  }
  if (body.record_type === 'lead' && body.pipeline_stage === undefined) {
    payload.pipeline_stage = 'open';
  }

  if (body.logo_path !== undefined) {
    payload.logo_path = body.logo_path;
  }

  const { error } = await ctx.supabase.from('customers').update(payload).eq('id', id).or(ownershipFilter);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  const nextType = body.record_type || existing.record_type || 'customer';
  const action = body.record_type && body.record_type !== existing.record_type ? `${nextType}_converted` : `${nextType}_updated`;

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    nextType,
    id,
    action,
    `${nextType === 'lead' ? 'Lead' : 'Customer'} updated: ${customerDisplayName(existing)}`
  );

  return NextResponse.json({ ok: true, message: nextType === 'lead' ? 'Lead saved successfully.' : 'Customer saved successfully.' });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  const ownershipFilter = `organization_id.eq.${ctx.workspace.organizationId},user_id.eq.${ctx.userId}`;

  const { data: existing, error: readError } = await ctx.supabase
    .from('customers')
    .select('id, company_name, phone, email')
    .eq('id', id)
    .or(ownershipFilter)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  const { error } = await ctx.supabase.from('customers').delete().eq('id', id).or(ownershipFilter);

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('foreign key') || msg.includes('violates')) {
      return NextResponse.json(
        { error: 'This customer is linked to jobs or records. Remove those first, then try again.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'customer',
    id,
    'customer_deleted',
    `Customer removed: ${customerDisplayName(existing)}`
  );

  return NextResponse.json({ ok: true, message: 'Customer removed successfully.' });
}
