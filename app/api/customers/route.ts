import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { insertCustomerRecord } from '@/lib/customer-insert-server';
import {
  findMatchingCustomer,
  type CustomerMatchCandidate
} from '@/lib/customer-find-or-create';
import { normalizeEmailKey, normalizePhoneKey } from '@/lib/address/normalize';
import { CUSTOMER_LIST_SELECT, buildCustomerWritePayload } from '@/lib/customer-record';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PIPELINE_STAGES = new Set([
  'open',
  'contacted',
  'qualified',
  'proposal_sent',
  'negotiation',
  'won',
  'closed_lost',
  'cancelled',
  'reopened',
  'active',
  'recurring',
  'inactive',
  'former',
  'archived',
  'past'
]);

function normalizePipelineStage(value: string | undefined, recordType: string): string {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, '_') || '';

  const legacyAliases: Record<string, string> = {
    customer: 'active',
    current: 'active',
    new_customer: 'active',
    lead: 'open',
    new_lead: 'open',
    proposal: 'proposal_sent',
    lost: 'closed_lost',
    closed: 'closed_lost'
  };

  const mapped = legacyAliases[normalized] || normalized;
  if (ALLOWED_PIPELINE_STAGES.has(mapped)) return mapped;
  return recordType === 'lead' ? 'open' : 'active';
}

function escapeExactIlike(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll(',', '\\,')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('"', '\\"');
}

async function findReusableCustomer(
  ctx: Extract<Awaited<ReturnType<typeof requireWorkspaceSession>>, { ok: true }>,
  input: { displayName: string; email?: string | null; phone?: string | null; address?: string | null }
): Promise<CustomerMatchCandidate | null> {
  const orgId = ctx.workspace.organizationId;
  const ownerUserId = ctx.workspace.ownerUserId;
  const workspaceFilter = [
    `organization_id.eq.${orgId}`,
    `and(organization_id.is.null,user_id.eq.${ownerUserId})`
  ].join(',');

  const emailKey = normalizeEmailKey(input.email);
  const phoneKey = normalizePhoneKey(input.phone);
  const name = input.displayName.trim();
  const candidates = new Map<string, CustomerMatchCandidate>();

  async function collect(filter: string) {
    const query = await ctx.supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .or(workspaceFilter)
      .or(filter)
      .limit(40);

    let rows = (query.data || []) as CustomerMatchCandidate[];
    if (query.error && isMissingSchemaError(query.error)) {
      const legacy = await ctx.supabase
        .from('customers')
        .select(
          'id, company_name, contact_name, email, phone, address_line1, service_address, property_address'
        )
        .or(workspaceFilter)
        .or(filter)
        .limit(40);
      if (legacy.error) return;
      rows = (legacy.data || []) as CustomerMatchCandidate[];
    } else if (query.error) {
      return;
    }

    for (const row of rows) candidates.set(row.id, row);
  }

  if (emailKey) {
    await collect(`email.ilike.${escapeExactIlike(emailKey)}`);
  }

  if (phoneKey) {
    const phonePattern = `%${escapeExactIlike(phoneKey.slice(-10))}%`;
    await collect(`phone.ilike.${phonePattern}`);
  }

  if (name) {
    const exactName = escapeExactIlike(name);
    await collect(`company_name.ilike.${exactName},contact_name.ilike.${exactName}`);
  }

  return findMatchingCustomer(input, Array.from(candidates.values()));
}

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
    assigned_to?: string | null;
  };

  if (!body.displayName?.trim()) {
    return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 });
  }

  const recordType = body.record_type === 'lead' ? 'lead' : 'customer';
  const pipelineStage = normalizePipelineStage(body.pipeline_stage, recordType);

  // Duplicate prevention for customers created from the New Job form (and other create paths).
  if (recordType === 'customer') {
    const existing = await findReusableCustomer(ctx, {
      displayName: body.displayName,
      email: body.email,
      phone: body.phone,
      address: body.address
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        reused: true,
        customer: { id: existing.id },
        message: 'Existing customer linked.'
      });
    }
  }

  const planCheck = await enforcePlanForUser(ctx.supabase, ctx.userId, 'customers');
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.message || 'Plan limit reached.' }, { status: 403 });
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
      return NextResponse.json({ error: 'Assigned team member is not active in this company.' }, { status: 400 });
    }
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
        record_type: recordType,
        pipeline_stage: pipelineStage,
        lead_source: body.lead_source,
        assigned_to: body.assigned_to || null
      })
    }
  });

  if (!insertResult.ok) {
    return NextResponse.json({ error: insertResult.error, code: insertResult.code }, { status: 400 });
  }

  const isLead = recordType === 'lead';
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
    metadata: { customerId: insertResult.id, lead_source: body.lead_source || null, assigned_to: body.assigned_to || null }
  });

  return NextResponse.json({
    ok: true,
    reused: false,
    customer: { id: insertResult.id },
    message: isLead ? 'Lead saved successfully.' : 'Customer saved successfully.'
  });
}
