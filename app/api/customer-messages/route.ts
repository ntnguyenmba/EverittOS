import { NextResponse } from 'next/server';
import { sendCustomerMessageEmail } from '@/lib/customer-messaging';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isManagerRole } from '@/lib/roles';
import { isMissingSchemaError, SCHEMA_SETUP_HINT } from '@/lib/supabase-schema-errors';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function messagingContext() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return { ok: false as const, status: ctx.status, error: ctx.error };
  }
  if (!canSeeOrgWideData(ctx.workspace.role)) {
    return { ok: false as const, status: 403, error: 'Permission denied' };
  }
  return {
    ok: true as const,
    supabase: ctx.supabase,
    userId: ctx.userId,
    email: ctx.email,
    organizationId: ctx.workspace.organizationId,
    canManage: isManagerRole(ctx.workspace.role)
  };
}

export async function GET() {
  const ctx = await messagingContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from('customer_message_threads')
    .select('*, customer_messages(id, body, status, direction, sent_at, created_at, recipient_email)')
    .eq('organization_id', ctx.organizationId)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ threads: [], schemaReady: false, setupHint: SCHEMA_SETUP_HINT });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ threads: data || [], schemaReady: true });
}

export async function POST(request: Request) {
  const ctx = await messagingContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as {
    customer_id?: string | null;
    job_id?: string | null;
    recipient_email?: string;
    subject?: string;
    message?: string;
  };

  const recipient = body.recipient_email?.trim() || '';
  const messageBody = body.message?.trim() || '';
  const subject = body.subject?.trim() || 'Message from your service team';

  if (!recipient) {
    return NextResponse.json({ error: 'Recipient email is required.' }, { status: 400 });
  }
  if (!messageBody) {
    return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data: orgRow } = await ctx.supabase
    .from('organizations')
    .select('name')
    .eq('id', ctx.organizationId)
    .maybeSingle();

  const { data: thread, error: threadError } = await ctx.supabase
    .from('customer_message_threads')
    .insert({
      organization_id: ctx.organizationId,
      customer_id: body.customer_id || null,
      job_id: body.job_id || null,
      subject,
      status: 'open',
      last_message_at: now,
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (threadError || !thread) {
    return NextResponse.json({ error: threadError?.message || 'Unable to create thread.' }, { status: 400 });
  }

  const sendResult = await sendCustomerMessageEmail({
    to: recipient,
    subject,
    body: messageBody,
    organizationName: orgRow?.name || 'EverittOS'
  });

  const { data: message, error: messageError } = await ctx.supabase
    .from('customer_messages')
    .insert({
      organization_id: ctx.organizationId,
      thread_id: thread.id,
      customer_id: body.customer_id || null,
      direction: 'outbound',
      sender_email: ctx.email,
      recipient_email: recipient,
      subject,
      body: messageBody,
      status: sendResult.sent ? 'sent' : 'failed',
      sent_at: sendResult.sent ? now : null,
      failure_reason: sendResult.error || null,
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 400 });
  }

  return NextResponse.json({
    thread,
    message,
    emailSent: sendResult.sent,
    deliveryNote: sendResult.sent ? undefined : sendResult.error
  });
}
