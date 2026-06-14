import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { resolveOrganizationByBookingSlug } from '@/lib/booking/slug';
import {
  dayOfWeekFromDateKey,
  generateSlotsForDay
} from '@/lib/booking/availability';
import { fetchGoogleCalendarBusyPeriods } from '@/lib/booking/google-calendar-booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ workspaceSlug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { workspaceSlug } = await context.params;
  const url = new URL(request.url);
  const serviceId = url.searchParams.get('serviceId');
  const workerId = url.searchParams.get('workerId');
  const date = url.searchParams.get('date');

  if (!serviceId || !date) {
    return NextResponse.json({ error: 'serviceId and date are required.' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 503 });
  }

  const org = await resolveOrganizationByBookingSlug(admin, workspaceSlug);
  if (!org) {
    return NextResponse.json({ error: 'Booking page not found.' }, { status: 404 });
  }

  const { data: service } = await admin
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!service) {
    return NextResponse.json({ error: 'Service not found.' }, { status: 404 });
  }

  let workerIds: string[] = [];
  if (workerId && workerId !== 'any') {
    workerIds = [workerId];
  } else {
    const { data: links } = await admin
      .from('staff_services')
      .select('worker_id')
      .eq('organization_id', org.id)
      .eq('service_id', serviceId);
    workerIds = (links || []).map((l) => l.worker_id);
  }

  if (!workerIds.length) {
    return NextResponse.json({ slots: [] });
  }

  const dayOfWeek = dayOfWeekFromDateKey(date);
  const dayStart = new Date(`${date}T00:00:00`).toISOString();
  const dayEnd = new Date(`${date}T23:59:59`).toISOString();

  const googleBusy = await fetchGoogleCalendarBusyPeriods(admin, org.id, dayStart, dayEnd);

  const slots: { starts_at: string; ends_at: string; worker_id: string }[] = [];

  for (const wid of workerIds) {
    const { data: availabilityRows } = await admin
      .from('staff_availability')
      .select('*')
      .eq('organization_id', org.id)
      .eq('worker_id', wid)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true);

    if (!availabilityRows?.length) continue;

    const { data: existingBookings } = await admin
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('organization_id', org.id)
      .eq('worker_id', wid)
      .in('status', ['confirmed', 'pending', 'completed'])
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd);

    for (const avail of availabilityRows) {
      const daySlots = generateSlotsForDay({
        dateKey: date,
        durationMinutes: service.duration_minutes,
        availability: avail,
        existingBookings: existingBookings || [],
        externalBusy: googleBusy
      });

      for (const slot of daySlots) {
        slots.push({ ...slot, worker_id: wid });
      }
    }
  }

  slots.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return NextResponse.json({ slots });
}
