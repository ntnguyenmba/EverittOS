import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { isValidUuid } from '@/lib/input-validation';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function assertCustomerAccess(
  ctx: Awaited<ReturnType<typeof requireWorkspaceSession>>,
  customerId: string
) {
  if (!ctx.ok) return null;
  const { data } = await ctx.supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();
  return data;
}

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid customer id.' }, { status: 400 });
  }

  const customer = await assertCustomerAccess(ctx, id);
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  const { data, error } = await ctx.supabase
    .from('customer_properties')
    .select('id, customer_id, name, address')
    .eq('customer_id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: mapWorkspaceSaveError(error.message, 'Unable to load properties.') },
      { status: 400 }
    );
  }

  return NextResponse.json({ properties: data || [] });
}

export async function POST(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid customer id.' }, { status: 400 });
  }

  const customer = await assertCustomerAccess(ctx, id);
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string; address?: string };
  const name = String(body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Property name is required.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('customer_properties')
    .insert({
      organization_id: ctx.workspace.organizationId,
      customer_id: id,
      name,
      address: String(body.address || '').trim() || null
    })
    .select('id, customer_id, name, address')
    .single();

  if (error) {
    return NextResponse.json(
      { error: mapWorkspaceSaveError(error.message, 'Unable to create property. Please try again.') },
      { status: 400 }
    );
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'customer',
    id,
    'customer_property_created',
    `Customer property created: ${data.name}`
  );

  return NextResponse.json({ property: data, message: 'Property created successfully.' });
}
