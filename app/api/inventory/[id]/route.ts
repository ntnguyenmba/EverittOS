import { NextResponse } from 'next/server';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isManagerRole } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
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

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const fields = ['name', 'category', 'item_type', 'quantity', 'unit', 'reorder_level', 'location', 'vendor', 'notes', 'active'] as const;
  for (const field of fields) {
    if (body[field] !== undefined) {
      patch[field] = body[field];
    }
  }

  const { data, error } = await ctx.supabase
    .from('inventory_items')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  const { error } = await ctx.supabase
    .from('inventory_items')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId);

  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ ok: true, deactivated: true });
}
