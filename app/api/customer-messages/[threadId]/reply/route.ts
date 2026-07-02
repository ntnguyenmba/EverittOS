import { NextResponse } from 'next/server';
import { sendCustomerMessageEmail } from '@/lib/customer-messaging';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isManagerRole } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ threadId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!canSeeOrgWideData(ctx.workspace.role) || !isManagerRole(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { threadId } = await context.params;
  if (!isValidUuid(threadId)) {
    return NextResponse.json({ error: 'Invalid thread id.' }, { status: 400 });
  }

  const body = (await request.json()) as {
    recipient_email?: string;
    subject?: string;
    message?: string;
  };

  const messageBody = body.message?.trim() || '';
  if (!messageBody) {
    return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
  }

  const { data: thread, error: threadError } = await ctx.supabase
    .from('customer_message_threads')
    .select('*')
    .eq('id', threadId)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ error: threadError.message }, { status: 400 });
  }
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
  }

  let recipient = body.recipient_email?.trim() || '';
  if (!recipient) {
    const { data: lastOutbound } = await ctx.supabase
      .from('customer_messages')
      .select('recipient_email')
      .eq('thread_id', threadId)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    recipient = lastOutbound?.recipient_email?.trim() || '';
  }

  if (!recipient && thread.customer_id) {
    const { data: customer } = await ctx.supabase
      .from('customers')
      .select('email')
      .eq('id', thread.customer_id)
      .maybeSingle();
    recipient = customer?.email?.trim() || '';
  }

  if (!recipient) {
    return NextResponse.json({ error: 'Recipient email is required.' }, { status: 400 });
  }

  const subject = body.subject?.trim() || thread.subject || 'Message from your service team';
  const now = new Date().toISOString();

  const { data: orgRow } = await ctx.supabase
    .from('organizations')
    .select('name')
    .eq('id', ctx.workspace.organizationId)
    .maybeSingle();

  const sendResult = await sendCustomerMessageEmail({
    to: recipient,
    subject,
    body: messageBody,
    organizationName: orgRow?.name || 'EverittOS'
  });

  const { data: message, error: messageError } = await ctx.supabase
    .from('customer_messages')
    .insert({
      organization_id: ctx.workspace.organizationId,
      thread_id: threadId,
      customer_id: thread.customer_id,
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

  await ctx.supabase
    .from('customer_message_threads')
    .update({ last_message_at: now, updated_at: now, status: 'open' })
    .eq('id', threadId);

  return NextResponse.json({
    message,
    emailSent: sendResult.sent,
    deliveryNote: sendResult.sent ? undefined : sendResult.error
  });
}
