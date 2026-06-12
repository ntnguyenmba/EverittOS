import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import { buildCustomerWritePayload } from '@/lib/customer-record';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true, requireCompany: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as {
    displayName?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    record_type?: string;
    pipeline_stage?: string;
    lead_source?: string;
  };

  if (!body.displayName?.trim()) {
    return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 });
  }

  const planCheck = await enforcePlanForUser(ctx.supabase, ctx.userId, 'customers');
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.message || 'Plan limit reached.' }, { status: 403 });
  }

  const { data, error } = await ctx.supabase
    .from('customers')
    .insert({
      ...workspaceScopedFields(ctx.workspace, ctx.userId),
      ...buildCustomerWritePayload({
        displayName: body.displayName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        notes: body.notes,
        record_type: body.record_type,
        pipeline_stage: body.pipeline_stage,
        lead_source: body.lead_source
      })
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  const isLead = body.record_type === 'lead' || body.pipeline_stage === 'lead';
  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    isLead ? 'lead' : 'customer',
    data.id,
    isLead ? 'lead_created' : 'customer_created',
    `${isLead ? 'Lead' : 'Customer'} created: ${body.displayName.trim()}`
  );

  return NextResponse.json({ ok: true, customer: data, message: 'Customer saved successfully.' });
}
