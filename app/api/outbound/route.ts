import { NextResponse } from 'next/server';
import { requireOutboundApiAccess } from '@/lib/outbound/auth';
import { enrichOutboundDocumentPayment } from '@/lib/outbound/invoice-payment';
import { OUTBOUND_DOC_TYPES, type OutboundDocType, type OutboundStatus } from '@/lib/outbound/types';
import { assertCustomerInOrganization, assertJobInOrganization } from '@/lib/org-resource-validation';
import {
  isMissingSchemaError,
  SCHEMA_SETUP_HINT,
  schemaEmptyPayload
} from '@/lib/supabase-schema-errors';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDocType(value: string | null): OutboundDocType | null {
  if (!value) return null;
  return OUTBOUND_DOC_TYPES.includes(value as OutboundDocType) ? (value as OutboundDocType) : null;
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function findExistingDocument(
  ctx: Extract<Awaited<ReturnType<typeof requireOutboundApiAccess>>, { ok: true }>,
  input: {
    docType: OutboundDocType;
    jobId: string | null;
    sourceEntityId: string | null;
    metadata: Record<string, unknown>;
  }
) {
  if (input.docType === 'invoice' && input.jobId) {
    const { data } = await ctx.supabase
      .from('outbound_documents')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('doc_type', 'invoice')
      .eq('job_id', input.jobId)
      .order('updated_at', { ascending: false })
      .limit(10);

    return (
      (data || []).find((doc) => {
        const paymentStatus = String(doc.payment_status || '').toLowerCase();
        const status = String(doc.status || '').toLowerCase();
        return paymentStatus !== 'cancelled' && status !== 'cancelled' && status !== 'canceled';
      }) || null
    );
  }

  if (input.docType === 'receipt') {
    const paymentId = metadataString(input.metadata, 'payment_id');
    const invoiceId = metadataString(input.metadata, 'invoice_id') || input.sourceEntityId || '';

    if (!paymentId && !invoiceId) return null;

    const { data } = await ctx.supabase
      .from('outbound_documents')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('doc_type', 'receipt')
      .order('updated_at', { ascending: false })
      .limit(100);

    return (
      (data || []).find((doc) => {
        const metadata = (doc.metadata || {}) as Record<string, unknown>;
        const existingPaymentId = metadataString(metadata, 'payment_id');
        const existingInvoiceId =
          metadataString(metadata, 'invoice_id') ||
          (typeof doc.source_entity_id === 'string' ? doc.source_entity_id.trim() : '');

        if (paymentId) return existingPaymentId === paymentId;
        return Boolean(invoiceId) && existingInvoiceId === invoiceId && !existingPaymentId;
      }) || null
    );
  }

  return null;
}

export async function GET(request: Request) {
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(request.url);
  const docType = parseDocType(url.searchParams.get('docType'));
  const status = url.searchParams.get('status') as OutboundStatus | 'drafts' | null;
  const tab = url.searchParams.get('tab');

  let query = ctx.supabase
    .from('outbound_documents')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (docType) query = query.eq('doc_type', docType);

  const resolvedStatus = status === 'drafts' ? 'draft' : tab === 'drafts' ? 'draft' : status || tab;
  if (resolvedStatus && ['draft', 'scheduled', 'sent', 'failed'].includes(resolvedStatus)) {
    query = query.eq('status', resolvedStatus);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json(schemaEmptyPayload('documents', { setupHint: SCHEMA_SETUP_HINT }));
    }
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  const rows = (data || []).map((doc) =>
    doc.doc_type === 'invoice' ? enrichOutboundDocumentPayment(doc) : doc
  );

  return NextResponse.json({ documents: rows, schemaReady: true });
}

export async function POST(request: Request) {
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as {
    doc_type?: OutboundDocType;
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
    force_new?: boolean;
  };

  const docType = parseDocType(body.doc_type || null);
  if (!docType) {
    return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
  }

  const amount =
    body.amount == null || body.amount === ''
      ? null
      : Number.isFinite(Number(body.amount))
        ? Number(body.amount)
        : null;

  const status = body.scheduled_at ? 'scheduled' : body.status || 'draft';
  const jobId = body.job_id || null;
  const sourceEntityId = body.source_entity_id || null;
  const metadata = body.metadata || {};

  const jobError = await assertJobInOrganization(ctx.supabase, ctx.organizationId, jobId);
  if (jobError) {
    return NextResponse.json({ error: jobError }, { status: 400 });
  }
  const customerError = await assertCustomerInOrganization(ctx.supabase, ctx.organizationId, body.customer_id);
  if (customerError) {
    return NextResponse.json({ error: customerError }, { status: 400 });
  }

  if (!body.force_new && (docType === 'invoice' || docType === 'receipt')) {
    const existing = await findExistingDocument(ctx, {
      docType,
      jobId,
      sourceEntityId,
      metadata
    });
    if (existing) {
      return NextResponse.json({ document: existing, reused: true });
    }
  }

  const { data, error } = await ctx.supabase
    .from('outbound_documents')
    .insert({
      organization_id: ctx.organizationId,
      doc_type: docType,
      status,
      recipient_email: body.recipient_email?.trim() || null,
      recipient_name: body.recipient_name?.trim() || null,
      subject: body.subject?.trim() || null,
      body: body.body?.trim() || null,
      amount,
      customer_id: body.customer_id || null,
      job_id: jobId,
      scheduled_at: body.scheduled_at || null,
      source_entity_type: body.source_entity_type || null,
      source_entity_id: sourceEntityId,
      metadata,
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: SCHEMA_SETUP_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ document: data, reused: false });
}
