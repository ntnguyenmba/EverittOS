import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { insertCustomerRecord } from '@/lib/customer-insert-server';
import { buildCustomerWritePayload } from '@/lib/customer-record';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
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

  const insertResult = await insertCustomerRecord({
    supabase: ctx.supabase,
    userId: ctx.userId,
    workspace: ctx.workspace,
    row: {
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
    }
  });

  if (!insertResult.ok) {
    return NextResponse.json({ error: insertResult.error, code: insertResult.code }, { status: 400 });
  }

  const isLead = body.record_type === 'lead' || body.pipeline_stage === 'lead';
  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    isLead ? 'lead' : 'customer',
    insertResult.id,
    isLead ? 'lead_created' : 'customer_created',
    `${isLead ? 'Lead' : 'Customer'} created: ${body.displayName.trim()}`
  );

  await trackProductEventServer(ctx.supabase, isLead ? 'lead_created' : 'customer_created', {
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    metadata: { customerId: insertResult.id, lead_source: body.lead_source || null }
  });

  return NextResponse.json({
    ok: true,
    customer: { id: insertResult.id },
    message: isLead ? 'Lead saved successfully.' : 'Customer saved successfully.'
  });
}
