import { NextResponse } from 'next/server';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { workerBelongsToOrg } from '@/lib/org-validation';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from('staff_services')
    .select('id, worker_id, service_id, created_at')
    .eq('organization_id', ctx.workspace.organizationId);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  return NextResponse.json({ staffServices: data || [] });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as { worker_id?: string; service_ids?: string[] };
  if (!body.worker_id) {
    return NextResponse.json({ error: 'Worker is required.' }, { status: 400 });
  }

  const serviceIds = Array.isArray(body.service_ids) ? body.service_ids.filter(Boolean) : [];
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 503 });
  }

  const validWorker = await workerBelongsToOrg(admin, body.worker_id, ctx.workspace.organizationId);
  if (!validWorker) {
    return NextResponse.json({ error: 'Worker not found in workspace.' }, { status: 400 });
  }

  await ctx.supabase
    .from('staff_services')
    .delete()
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('worker_id', body.worker_id);

  if (serviceIds.length) {
    const rows = serviceIds.map((serviceId) => ({
      organization_id: ctx.workspace.organizationId,
      worker_id: body.worker_id,
      service_id: serviceId
    }));

    const { error } = await ctx.supabase.from('staff_services').insert(rows);
    if (error) {
      return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, message: 'Staff services updated successfully.' });
}
