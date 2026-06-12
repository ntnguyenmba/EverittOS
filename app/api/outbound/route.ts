import { NextResponse } from 'next/server';
import { requireOutboundApiAccess } from '@/lib/outbound/auth';
import { OUTBOUND_DOC_TYPES, type OutboundDocType, type OutboundStatus } from '@/lib/outbound/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDocType(value: string | null): OutboundDocType | null {
  if (!value) return null;
  return OUTBOUND_DOC_TYPES.includes(value as OutboundDocType) ? (value as OutboundDocType) : null;
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ documents: data || [] });
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
      job_id: body.job_id || null,
      scheduled_at: body.scheduled_at || null,
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ document: data });
}
