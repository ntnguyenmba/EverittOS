import { NextResponse } from 'next/server';
import { INVENTORY_ADJUSTMENT_TYPES } from '@/lib/inventory';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isManagerRole } from '@/lib/roles';
import { isMissingSchemaError, SCHEMA_SETUP_HINT } from '@/lib/supabase-schema-errors';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function inventoryContext() {
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
    organizationId: ctx.workspace.organizationId,
    canManage: isManagerRole(ctx.workspace.role)
  };
}

export async function GET(request: Request) {
  const ctx = await inventoryContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let query = ctx.supabase
    .from('inventory_items')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .order('name', { ascending: true });

  const includeInactive = new URL(request.url).searchParams.get('includeInactive') === '1';
  if (!includeInactive) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ items: [], schemaReady: false, setupHint: SCHEMA_SETUP_HINT });
    }
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ items: data || [], schemaReady: true });
}

export async function POST(request: Request) {
  const ctx = await inventoryContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    category?: string;
    item_type?: string;
    quantity?: number | string;
    unit?: string;
    reorder_level?: number | string | null;
    location?: string;
    vendor?: string;
    notes?: string;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'Item name is required.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('inventory_items')
    .insert({
      organization_id: ctx.organizationId,
      name,
      category: body.category?.trim() || null,
      item_type: body.item_type?.trim() || 'supply',
      quantity: Number(body.quantity || 0),
      unit: body.unit?.trim() || null,
      reorder_level: body.reorder_level == null || body.reorder_level === '' ? null : Number(body.reorder_level),
      location: body.location?.trim() || null,
      vendor: body.vendor?.trim() || null,
      notes: body.notes?.trim() || null,
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: SCHEMA_SETUP_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ item: data });
}
