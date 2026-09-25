import { NextResponse } from 'next/server';
import { requireOutboundApiAccess } from '@/lib/outbound/auth';
import type { OutboundStatus } from '@/lib/outbound/types';
import { isMissingSchemaError, SCHEMA_SETUP_HINT } from '@/lib/supabase-schema-errors';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from('outbound_documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: SCHEMA_SETUP_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({ document: data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as {
    recipient_email?: string;
    recipient_name?: string;
    subject?: string;
    body?: string;
    amount?: number | string | null;
    customer_id?: string | null;
    job_id?: string | null;
    scheduled_at?: string | null;
    status?: OutboundStatus;
    source_entity_type?: string | null;
    source_entity_id?: string | null;
    metadata?: Record<string, unknown>;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.recipient_email !== undefined) patch.recipient_email = body.recipient_email?.trim() || null;
  if (body.recipient_name !== undefined) patch.recipient_name = body.recipient_name?.trim() || null;
  if (body.subject !== undefined) patch.subject = body.subject?.trim() || null;
  if (body.body !== undefined) patch.body = body.body?.trim() || null;
  if (body.customer_id !== undefined) patch.customer_id = body.customer_id || null;
  if (body.job_id !== undefined) patch.job_id = body.job_id || null;
  if (body.source_entity_type !== undefined) patch.source_entity_type = body.source_entity_type || null;
  if (body.source_entity_id !== undefined) patch.source_entity_id = body.source_entity_id || null;
  if (body.metadata !== undefined) patch.metadata = body.metadata || {};
  if (body.amount !== undefined) {
    patch.amount =
      body.amount == null || body.amount === ''
        ? null
        : Number.isFinite(Number(body.amount))
          ? Number(body.amount)
          : null;
  }

  if (body.scheduled_at !== undefined) {
    patch.scheduled_at = body.scheduled_at || null;
    if (body.scheduled_at) {
      patch.status = 'scheduled';
    } else if (body.status === undefined) {
      patch.status = 'draft';
    }
  }

  if (body.status) {
    patch.status = body.status;
    if (body.status === 'draft') {
      patch.scheduled_at = null;
      patch.failed_at = null;
      patch.failure_reason = null;
    }
  }

  const { data, error } = await ctx.supabase
    .from('outbound_documents')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .select('*')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: SCHEMA_SETUP_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ document: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { error } = await ctx.supabase
    .from('outbound_documents')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.organizationId);

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: SCHEMA_SETUP_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
