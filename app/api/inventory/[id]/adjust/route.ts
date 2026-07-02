import { NextResponse } from 'next/server';
import { INVENTORY_ADJUSTMENT_TYPES } from '@/lib/inventory';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isManagerRole } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!canSeeOrgWideData(ctx.workspace.role) || !isManagerRole(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid item id.' }, { status: 400 });
  }

  const body = (await request.json()) as {
    adjustment_type?: string;
    quantity_delta?: number | string;
    reason?: string;
    job_id?: string | null;
  };

  const adjustmentType = body.adjustment_type || 'count';
  if (!INVENTORY_ADJUSTMENT_TYPES.includes(adjustmentType as (typeof INVENTORY_ADJUSTMENT_TYPES)[number])) {
    return NextResponse.json({ error: 'Invalid adjustment type.' }, { status: 400 });
  }

  const delta = Number(body.quantity_delta);
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: 'Enter a non-zero quantity change.' }, { status: 400 });
  }

  const { data: item, error: readError } = await ctx.supabase
    .from('inventory_items')
    .select('id, quantity')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }
  if (!item) {
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
  }

  const nextQuantity = Math.max(0, Number(item.quantity || 0) + delta);

  const { error: adjustError } = await ctx.supabase.from('inventory_adjustments').insert({
    organization_id: ctx.workspace.organizationId,
    item_id: id,
    adjustment_type: adjustmentType,
    quantity_delta: delta,
    reason: body.reason?.trim() || null,
    job_id: body.job_id || null,
    created_by: ctx.userId
  });

  if (adjustError) {
    return NextResponse.json({ error: adjustError.message }, { status: 400 });
  }

  const { data: updated, error: updateError } = await ctx.supabase
    .from('inventory_items')
    .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .select('*')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ item: updated });
}
