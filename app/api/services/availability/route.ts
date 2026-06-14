import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
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
    .from('staff_availability')
    .select('*')
    .eq('organization_id', ctx.workspace.organizationId)
    .order('worker_id')
    .order('day_of_week');

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  const { data: workers } = await ctx.supabase
    .from('workers')
    .select('id, name')
    .eq('organization_id', ctx.workspace.organizationId)
    .order('name');

  return NextResponse.json({ availability: data || [], workers: workers || [] });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as {
    worker_id?: string;
    day_of_week?: number;
    starts_at?: string;
    ends_at?: string;
    buffer_minutes?: number;
    max_bookings?: number;
    is_active?: boolean;
  };

  if (!body.worker_id || body.day_of_week === undefined || !body.starts_at || !body.ends_at) {
    return NextResponse.json({ error: 'Worker, day, start time, and end time are required.' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 503 });
  }

  const validWorker = await workerBelongsToOrg(admin, body.worker_id, ctx.workspace.organizationId);
  if (!validWorker) {
    return NextResponse.json({ error: 'Worker not found in workspace.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('staff_availability')
    .insert({
      organization_id: ctx.workspace.organizationId,
      worker_id: body.worker_id,
      day_of_week: Number(body.day_of_week),
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      buffer_minutes: Number(body.buffer_minutes ?? 0),
      max_bookings: Number(body.max_bookings ?? 20),
      is_active: body.is_active !== false
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'worker',
    body.worker_id,
    'availability_updated',
    'Staff availability added'
  );

  return NextResponse.json({ ok: true, availability: data, message: 'Availability saved successfully.' });
}
