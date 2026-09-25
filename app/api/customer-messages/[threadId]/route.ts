import { NextResponse } from 'next/server';
import { sendCustomerMessageEmail } from '@/lib/customer-messaging';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isManagerRole } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ threadId: string }> };

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

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await messagingContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { threadId } = await context.params;
  if (!isValidUuid(threadId)) {
    return NextResponse.json({ error: 'Invalid thread id.' }, { status: 400 });
  }

  const { data: thread, error: threadError } = await ctx.supabase
    .from('customer_message_threads')
    .select('*')
    .eq('id', threadId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ error: publicErrorMessage(threadError) }, { status: 400 });
  }
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await ctx.supabase
    .from('customer_messages')
    .select('*')
    .eq('thread_id', threadId)
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: publicErrorMessage(messagesError) }, { status: 400 });
  }

  return NextResponse.json({ thread, messages: messages || [] });
}

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await messagingContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { threadId } = await context.params;
  if (!isValidUuid(threadId)) {
    return NextResponse.json({ error: 'Invalid thread id.' }, { status: 400 });
  }

  const body = (await request.json()) as { status?: string; subject?: string };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) patch.status = body.status;
  if (body.subject !== undefined) patch.subject = body.subject?.trim() || null;

  const { data, error } = await ctx.supabase
    .from('customer_message_threads')
    .update(patch)
    .eq('id', threadId)
    .eq('organization_id', ctx.organizationId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Thread not found.' }, { status: 404 });
  }

  return NextResponse.json({ thread: data });
}
