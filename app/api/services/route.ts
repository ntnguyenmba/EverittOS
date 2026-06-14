import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { ensureUniqueBookingSlug } from '@/lib/booking/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const orgId = ctx.workspace.organizationId;

  const [{ data: services, error: servicesError }, { data: staffServices }, { data: workers }] =
    await Promise.all([
      ctx.supabase
        .from('services')
        .select('*')
        .eq('organization_id', orgId)
        .order('name'),
      ctx.supabase.from('staff_services').select('*').eq('organization_id', orgId),
      ctx.supabase.from('workers').select('id, name').eq('organization_id', orgId).order('name')
    ]);

  if (servicesError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(servicesError.message) }, { status: 400 });
  }

  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('booking_slug, name')
    .eq('id', orgId)
    .maybeSingle();

  let bookingSlug = org?.booking_slug || null;
  if (!bookingSlug && org?.name) {
    const admin = createAdminSupabase();
    if (admin) {
      bookingSlug = await ensureUniqueBookingSlug(admin, orgId, org.name);
    }
  }

  return NextResponse.json({
    services: services || [],
    staffServices: staffServices || [],
    workers: workers || [],
    bookingSlug,
    organizationName: org?.name || null
  });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as {
    name?: string;
    category?: string;
    description?: string;
    duration_minutes?: number;
    price_cents?: number;
    is_active?: boolean;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Service name is required.' }, { status: 400 });
  }

  const duration = Number(body.duration_minutes ?? 60);
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'Duration must be greater than zero.' }, { status: 400 });
  }

  const priceCents = Number(body.price_cents ?? 0);
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: 'Price must be zero or greater.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('services')
    .insert({
      organization_id: ctx.workspace.organizationId,
      name: body.name.trim(),
      category: body.category?.trim() || null,
      description: body.description?.trim() || null,
      duration_minutes: Math.round(duration),
      price_cents: Math.round(priceCents),
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
    'service',
    data.id,
    'service_created',
    `Service added: ${data.name}`
  );

  return NextResponse.json({ ok: true, service: data, message: 'Service saved successfully.' });
}
