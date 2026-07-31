import { NextResponse } from 'next/server';
import { sendAssignmentNotification } from '@/lib/assignment-notifications';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { buildCustomerUpdatePayload, customerDisplayName } from '@/lib/customer-record';
import { normalizePreferredContactMethod, validateOptionalContact } from '@/lib/contact-validation';
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
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    billingAddress?: string;
    preferredContactMethod?: string;
    notes?: string;
    logo_path?: string | null;
    pipeline_stage?: string;
    lead_source?: string;
    record_type?: string;
    assigned_to?: string | null;
  };

  const contactCheck = validateOptionalContact({ email: body.email, phone: body.phone });
  if (!contactCheck.ok) {
    return NextResponse.json({ error: contactCheck.error }, { status: 400 });
  }
  if (
    body.preferredContactMethod !== undefined &&
    body.preferredContactMethod &&
    !normalizePreferredContactMethod(body.preferredContactMethod)
  ) {
    return NextResponse.json({ error: 'Preferred contact method must be email, phone, text, or any.' }, { status: 400 });
  }

  const ownershipFilter = `organization_id.eq.${ctx.workspace.organizationId},user_id.eq.${ctx.userId}`;

  const { data: existing, error: readError } = await ctx.supabase
    .from('customers')
    .select('id, company_name, phone, email, pipeline_stage, record_type, assigned_to')
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
    contactName: body.contactName,
    phone: body.phone,
    email: body.email,
    address: body.address,
    billingAddress: body.billingAddress,
    preferredContactMethod: body.preferredContactMethod,
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
  const previousStage = existing.pipeline_stage || null;
  const nextStage = body.pipeline_stage !== undefined ? body.pipeline_stage : previousStage;
  const stageChanged = body.pipeline_stage !== undefined && body.pipeline_stage !== previousStage;
  const typeChanged = Boolean(body.record_type && body.record_type !== existing.record_type);
  const action = typeChanged
    ? `${nextType}_converted`
    : stageChanged
      ? `${nextType}_stage_changed`
      : `${nextType}_updated`;
  const title = customerDisplayName(existing);
  const activityMessage = stageChanged
    ? `${nextType === 'lead' ? 'Lead' : 'Customer'} status changed to ${String(nextStage || 'active')}: ${title}`
    : `${nextType === 'lead' ? 'Lead' : 'Customer'} updated: ${title}`;

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    nextType,
    id,
    action,
    activityMessage
  );

  if (body.assigned_to && body.assigned_to !== existing.assigned_to) {
    await sendAssignmentNotification({
      supabase: ctx.supabase,
      organizationId: ctx.workspace.organizationId,
      assignedUserId: body.assigned_to,
      kind: nextType === 'lead' ? 'lead' : 'customer',
      recordId: id,
      title
    });
  }

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
    .select('id, company_name, phone, email, record_type')
    .eq('id', id)
    .or(ownershipFilter)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  const recordType = existing.record_type || 'customer';
  const archivedStage = recordType === 'lead' ? 'cancelled' : 'archived';
  const { error } = await ctx.supabase
    .from('customers')
    .update({ pipeline_stage: archivedStage })
    .eq('id', id)
    .or(ownershipFilter);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    recordType,
    id,
    `${recordType}_archived`,
    `${recordType === 'lead' ? 'Lead' : 'Customer'} archived: ${customerDisplayName(existing)}`
  );

  return NextResponse.json({
    ok: true,
    message:
      recordType === 'lead'
        ? 'Lead archived successfully. You can reopen it later.'
        : 'Customer archived successfully. Their jobs and history are preserved.'
  });
}
