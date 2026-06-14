import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { deleteBookingGoogleCalendarEvent } from '@/lib/booking/google-calendar-booking';
import { findBookingConflicts } from '@/lib/booking/conflicts';
import { defaultBookingEndIso } from '@/lib/booking/display';
import { mapBookingApiError, validateBookingTimeRange } from '@/lib/booking/schema';
import { parseManualBookingInput } from '@/lib/booking/parse-manual-booking';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_STATUS = ['confirmed', 'pending', 'cancelled', 'completed', 'no-show'] as const;

function bookingMutationError(message: string, fallback: string) {
  const mapped = mapBookingApiError(message, fallback);
  return NextResponse.json(mapped, { status: mapped.code === 'schema_missing' ? 503 : 400 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    status?: string;
    notes?: string;
    starts_at?: string;
    ends_at?: string;
    worker_id?: string | null;
    service_id?: string | null;
    manual_service_name?: string | null;
    staff_name?: string | null;
    client_name?: string;
    client_email?: string;
    client_phone?: string;
  };

  const { data: existing } = await ctx.supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  const payload: Record<string, unknown> = {};
  if (body.notes !== undefined) payload.notes = body.notes?.trim() || null;
  if (body.status !== undefined) {
    if (!ALLOWED_STATUS.includes(body.status as (typeof ALLOWED_STATUS)[number])) {
      return NextResponse.json({ error: 'Invalid booking status.' }, { status: 400 });
    }
    payload.status = body.status;
  }
  if (body.starts_at !== undefined) payload.starts_at = body.starts_at;
  if (body.ends_at !== undefined) payload.ends_at = body.ends_at;
  else if (body.starts_at !== undefined && !existing.ends_at) {
    payload.ends_at = defaultBookingEndIso(body.starts_at, 60);
  }
  if (body.worker_id !== undefined) payload.worker_id = body.worker_id;
  if (body.manual_service_name !== undefined) payload.manual_service_name = body.manual_service_name?.trim() || null;
  if (body.staff_name !== undefined) payload.staff_name = body.staff_name?.trim() || null;
  if (body.service_id !== undefined) payload.service_id = body.service_id || null;
  if (body.client_name !== undefined) payload.client_name = body.client_name.trim();
  if (body.client_email !== undefined) payload.client_email = body.client_email?.trim() || null;
  if (body.client_phone !== undefined) payload.client_phone = body.client_phone?.trim() || null;

  const nextStart = (payload.starts_at as string) || existing.starts_at;
  const nextEnd = (payload.ends_at as string) || existing.ends_at;
  const nextWorker = body.worker_id !== undefined ? body.worker_id : existing.worker_id;

  if (payload.starts_at || payload.ends_at) {
    const timeError = validateBookingTimeRange(nextStart, nextEnd);
    if (timeError) {
      return NextResponse.json({ error: timeError }, { status: 400 });
    }

    const admin = createAdminSupabase();
    if (admin) {
      const conflicts = await findBookingConflicts(admin, {
        organizationId: ctx.workspace.organizationId,
        workerId: nextWorker,
        startsAt: nextStart,
        endsAt: nextEnd,
        excludeBookingId: id
      });
      if (conflicts.length) {
        return NextResponse.json({ error: 'That time is no longer available.' }, { status: 409 });
      }
    }
  }

  const { data, error } = await ctx.supabase
    .from('bookings')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .select('*')
    .maybeSingle();

  if (error) {
    return bookingMutationError(error.message, 'Unable to update booking.');
  }

  if (body.status === 'cancelled' && existing.google_calendar_event_id) {
    const admin = createAdminSupabase();
    if (admin) {
      await deleteBookingGoogleCalendarEvent(
        admin,
        ctx.workspace.organizationId,
        existing.google_calendar_event_id
      );
    }
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'booking',
    id,
    'booking_updated',
    `Booking updated: ${existing.client_name}`
  );

  return NextResponse.json({ ok: true, booking: data, message: 'Booking updated successfully.' });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;

  const { data: existing } = await ctx.supabase
    .from('bookings')
    .select('id, client_name, google_calendar_event_id')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  const { error } = await ctx.supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    return bookingMutationError(error.message, 'Unable to cancel booking.');
  }

  const admin = createAdminSupabase();
  if (admin && existing.google_calendar_event_id) {
    await deleteBookingGoogleCalendarEvent(admin, ctx.workspace.organizationId, existing.google_calendar_event_id);
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'booking',
    id,
    'booking_cancelled',
    `Booking cancelled: ${existing.client_name}`
  );

  return NextResponse.json({ ok: true, message: 'Booking cancelled successfully.' });
}
