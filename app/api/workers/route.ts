import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { resolveEffectiveOrganizationPlan } from '@/lib/effective-plan-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { validatePlanAction } from '@/lib/plan-validate';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { logWorkerPlan } from '@/lib/worker-plan-logs';

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

  const workspaceId = ctx.workspace.organizationId;
  const { plan: effectivePlan, ownerUserId, syncedFromStripe } = await resolveEffectiveOrganizationPlan(
    ctx.supabase,
    ctx.userId
  );
  const limits = limitsForPlan(effectivePlan);
  const usage = await fetchUsageCounts(ctx.userId, workspaceId);
  const validation = validatePlanAction({
    plan: effectivePlan,
    resource: 'workers',
    currentCount: usage.workers
  });

  logWorkerPlan('worker_save:check', {
    workspaceId,
    userId: ctx.userId,
    ownerUserId,
    effectivePlan,
    syncedFromStripe,
    currentWorkerCount: usage.workers,
    workerLimit: limits.crewMembers,
    allowed: validation.allowed
  });

  if (!validation.allowed) {
    logWorkerPlan('worker_save:blocked', {
      workspaceId,
      userId: ctx.userId,
      ownerUserId,
      effectivePlan,
      currentWorkerCount: usage.workers,
      workerLimit: limits.crewMembers,
      blockReason: validation.message || 'worker_limit'
    });
    return NextResponse.json({ error: validation.message || 'Team member limit reached for this plan.' }, { status: 403 });
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

  logWorkerPlan('worker_save:allowed', {
    workspaceId,
    userId: ctx.userId,
    ownerUserId,
    effectivePlan,
    currentWorkerCount: usage.workers + 1,
    workerLimit: limits.crewMembers,
    workerId: data.id
  });

  await logWorkspaceActivity(
    workspaceId,
    ctx.userId,
    'worker',
    data.id,
    'worker_created',
    `Worker added: ${body.name.trim()}`
  );

  await trackProductEventServer(ctx.supabase, 'worker_created', {
    organizationId: workspaceId,
    userId: ctx.userId,
    metadata: { workerId: data.id }
  });

  return NextResponse.json({ ok: true, worker: data, message: 'Worker saved successfully.' });
}
