import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { bookingAppointmentName } from '@/lib/booking/display';
import { mapBookingApiError } from '@/lib/booking/schema';
import { resendBookingConfirmation } from '@/lib/booking/process-side-effects';
import { requireBookingsPlan } from '@/lib/booking/plan-gate';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const planCheck = await requireBookingsPlan(ctx.supabase, ctx.userId);
  if (!planCheck.ok) {
    return NextResponse.json(planCheck.payload, { status: 403 });
  }

  const { id } = await context.params;
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 503 });
  }

  const { data: booking } = await ctx.supabase
    .from('bookings')
    .select('*, services(name), workers(name)')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  if (!booking.client_email?.trim()) {
    return NextResponse.json({ error: 'This booking has no customer email.' }, { status: 400 });
  }

  const { data: settings } = await admin
    .from('organization_settings')
    .select('company_phone, company_email')
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  const result = await resendBookingConfirmation(admin, {
    organizationId: ctx.workspace.organizationId,
    organizationName: ctx.workspace.organizationName,
    timezone: 'America/New_York',
    booking,
    appointmentName: bookingAppointmentName(booking),
    sourceLabel: booking.source || 'Booking',
    contactEmail: settings?.company_email || null,
    contactPhone: settings?.company_phone || null
  });

  if (!result.sent) {
    return NextResponse.json(
      { error: result.warning || 'Confirmation email could not be sent.' },
      { status: 400 }
    );
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'booking',
    id,
    'booking_confirmation_resent',
    `Confirmation resent to ${booking.client_name}`
  );

  return NextResponse.json({ ok: true, message: 'Confirmation email sent.' });
}
