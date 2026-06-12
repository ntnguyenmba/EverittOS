import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as {
    title?: string;
    customer_name?: string;
    phone?: string;
    address?: string;
    notes?: string;
    customer_id?: string | null;
    status?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Job title is required.' }, { status: 400 });
  }

  const planCheck = await enforcePlanForUser(ctx.supabase, ctx.userId, 'jobs');
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.message || 'Plan limit reached.' }, { status: 403 });
  }

  const { data, error } = await ctx.supabase
    .from('jobs')
    .insert({
      ...workspaceScopedFields(ctx.workspace, ctx.userId),
      title: body.title.trim(),
      customer_name: body.customer_name?.trim() || null,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      notes: body.notes?.trim() || null,
      customer_id: body.customer_id || null,
      status: body.status?.trim() || 'new'
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    data.id,
    'job_created',
    `Job created: ${body.title.trim()}`
  );

  await trackProductEventServer(ctx.supabase, 'job_created', {
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    metadata: { jobId: data.id }
  });

  return NextResponse.json({ ok: true, job: data, message: 'Job saved successfully.' });
}
