import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as { name?: string; role?: string; phone?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Worker name is required.' }, { status: 400 });
  }

  const { plan } = await resolveOrganizationPlan(ctx.supabase, ctx.userId);
  if (!limitsForPlan(plan).crewAssignment) {
    return NextResponse.json(
      { error: 'Workers and crew assignment require the Business plan.' },
      { status: 403 }
    );
  }

  const usage = await fetchUsageCounts(ctx.userId, ctx.workspace.organizationId);
  if (usage.workers >= limitsForPlan(plan).crewMembers) {
    return NextResponse.json({ error: 'Crew member limit reached for this plan.' }, { status: 403 });
  }

  const { data, error } = await ctx.supabase
    .from('workers')
    .insert({
      ...workspaceScopedFields(ctx.workspace, ctx.userId),
      name: body.name.trim(),
      role: body.role?.trim() || null,
      phone: body.phone?.trim() || null
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'worker',
    data.id,
    'worker_created',
    `Worker added: ${body.name.trim()}`
  );

  await trackProductEventServer(ctx.supabase, 'worker_created', {
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    metadata: { workerId: data.id }
  });

  return NextResponse.json({ ok: true, worker: data, message: 'Worker saved successfully.' });
}
