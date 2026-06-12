import { NextResponse } from 'next/server';
import { buildCustomerUpdatePayload } from '@/lib/customer-record';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    displayName?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    logo_path?: string | null;
  };

  const { data: existing, error: readError } = await ctx.supabase
    .from('customers')
    .select('id')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  const payload = buildCustomerUpdatePayload({
    displayName: body.displayName,
    phone: body.phone,
    email: body.email,
    address: body.address,
    notes: body.notes
  });

  if (body.logo_path !== undefined) {
    payload.logo_path = body.logo_path;
  }

  const { error } = await ctx.supabase.from('customers').update(payload).eq('id', id);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
