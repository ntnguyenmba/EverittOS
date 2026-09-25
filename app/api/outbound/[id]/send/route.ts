import { NextResponse } from 'next/server';
import { requireOutboundApiAccess } from '@/lib/outbound/auth';
import { sendOutboundDocument } from '@/lib/outbound/send-document';
import type { OutboundDocument } from '@/lib/outbound/types';
import { isMissingSchemaError, SCHEMA_SETUP_HINT } from '@/lib/supabase-schema-errors';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { data: document, error } = await ctx.supabase
    .from('outbound_documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: SCHEMA_SETUP_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 404 });
  }
  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (document.status === 'sent') {
    return NextResponse.json({ error: 'This item was already sent.' }, { status: 400 });
  }

  if (document.doc_type === 'invoice') {
    const amount = Number(document.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid invoice amount before sending.' }, { status: 400 });
    }
  }

  try {
    const result = await sendOutboundDocument({
      supabase: ctx.supabase,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      document: document as OutboundDocument
    });

    return NextResponse.json({
      document: result.document,
      emailSent: result.emailSent,
      deliveryNote: result.deliveryNote,
      message:
        result.document.status === 'sent'
          ? 'Sent successfully and saved to sent history.'
          : 'Send failed. Check the Failed tab to retry.'
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to send';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
