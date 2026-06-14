import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createPublicBooking } from '@/lib/booking/create-public-booking';
import { resolveOrganizationByBookingSlug, ensureUniqueBookingSlug } from '@/lib/booking/slug';
import type { PublicBookingPayload } from '@/lib/booking/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ workspaceSlug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { workspaceSlug } = await context.params;
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 503 });
  }

  let org = await resolveOrganizationByBookingSlug(admin, workspaceSlug);
  if (!org) {
    return NextResponse.json({ error: 'Booking page not found.' }, { status: 404 });
  }

  if (!org.booking_slug) {
    const slug = await ensureUniqueBookingSlug(admin, org.id, org.name);
    org = { ...org, booking_slug: slug };
  }

  const [{ data: services }, { data: staffServices }, { data: workers }, { data: settings }] =
    await Promise.all([
      admin
        .from('services')
        .select('*')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('name'),
      admin.from('staff_services').select('worker_id, service_id').eq('organization_id', org.id),
      admin.from('workers').select('id, name').eq('organization_id', org.id).order('name'),
      admin.from('organization_settings').select('timezone').eq('organization_id', org.id).maybeSingle()
    ]);

  const workerMap = new Map<string, { id: string; name: string; service_ids: string[] }>();
  for (const w of workers || []) {
    workerMap.set(w.id, { id: w.id, name: w.name, service_ids: [] });
  }
  for (const row of staffServices || []) {
    const entry = workerMap.get(row.worker_id);
    if (entry) entry.service_ids.push(row.service_id);
  }

  const payload: PublicBookingPayload = {
    organization_id: org.id,
    organization_name: org.name,
    booking_slug: org.booking_slug,
    timezone: settings?.timezone || 'America/New_York',
    services: services || [],
    workers: Array.from(workerMap.values()).filter((w) => w.service_ids.length > 0)
  };

  return NextResponse.json(payload);
}

export async function POST(request: Request, context: RouteContext) {
  const { workspaceSlug } = await context.params;
  const body = (await request.json()) as {
    service_id?: string;
    worker_id?: string | null;
    starts_at?: string;
    ends_at?: string;
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    notes?: string;
  };

  if (!body.service_id || !body.starts_at || !body.ends_at || !body.client_name?.trim()) {
    return NextResponse.json({ error: 'Service, time, and name are required.' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 503 });
  }

  const org = await resolveOrganizationByBookingSlug(admin, workspaceSlug);
  if (!org) {
    return NextResponse.json({ error: 'Booking page not found.' }, { status: 404 });
  }

  const result = await createPublicBooking(admin, {
    organizationId: org.id,
    organizationName: org.name,
    serviceId: body.service_id,
    workerId: body.worker_id,
    startsAt: body.starts_at,
    endsAt: body.ends_at,
    clientName: body.client_name,
    clientEmail: body.client_email,
    clientPhone: body.client_phone,
    notes: body.notes
  });

  if (result.error) {
    return NextResponse.json({ error: result.error, warnings: result.warnings || [] }, { status: result.status || 400 });
  }

  const booking = result.booking as {
    id: string;
    client_name: string;
    starts_at: string;
    ends_at: string;
    status: string;
    client_email?: string | null;
  };

  return NextResponse.json({
    ok: true,
    booking: {
      id: booking.id,
      client_name: booking.client_name,
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      status: booking.status
    },
    organizationName: org.name,
    serviceName: result.serviceName || null,
    confirmationSent: Boolean(result.confirmationSent),
    warnings: result.warnings || [],
    message: 'Booking confirmed.'
  });
}
