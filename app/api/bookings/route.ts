import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const url = new URL(request.url);
  const upcoming = url.searchParams.get('upcoming') === '1';

  let query = ctx.supabase
    .from('bookings')
    .select(
      '*, services(name, duration_minutes, price_cents), workers(name)'
    )
    .eq('organization_id', ctx.workspace.organizationId)
    .order('starts_at', { ascending: true });

  if (upcoming) {
    query = query.gte('starts_at', new Date().toISOString()).not('status', 'eq', 'cancelled');
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  return NextResponse.json({ bookings: data || [] });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as {
    service_id?: string;
    worker_id?: string | null;
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    starts_at?: string;
    ends_at?: string;
    notes?: string;
    status?: string;
  };

  if (!body.service_id || !body.client_name?.trim() || !body.starts_at || !body.ends_at) {
    return NextResponse.json({ error: 'Service, client name, and time are required.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('bookings')
    .insert({
      organization_id: ctx.workspace.organizationId,
      service_id: body.service_id,
      worker_id: body.worker_id || null,
      client_name: body.client_name.trim(),
      client_email: body.client_email?.trim() || null,
      client_phone: body.client_phone?.trim() || null,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      notes: body.notes?.trim() || null,
      status: body.status || 'confirmed',
      source: 'manual'
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'booking',
    data.id,
    'booking_created',
    `Booking created for ${data.client_name}`
  );

  return NextResponse.json({ ok: true, booking: data, message: 'Booking saved successfully.' });
}
