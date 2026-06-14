import type { SupabaseClient } from '@supabase/supabase-js';
import { findBookingConflicts } from '@/lib/booking/conflicts';
import { fetchGoogleCalendarBusyPeriods } from '@/lib/booking/google-calendar-booking';
import { processBookingSideEffects } from '@/lib/booking/process-side-effects';
import { buildCustomerWritePayload } from '@/lib/customer-record';

export type CreatePublicBookingInput = {
  organizationId: string;
  organizationName: string;
  serviceId: string;
  workerId?: string | null;
  startsAt: string;
  endsAt: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  notes?: string;
};

export type CreatePublicBookingResult = {
  booking: Record<string, unknown>;
  error?: string;
  status?: number;
  warnings?: string[];
  confirmationSent?: boolean;
  serviceName?: string;
};

export async function createPublicBooking(
  admin: SupabaseClient,
  input: CreatePublicBookingInput
): Promise<CreatePublicBookingResult> {
  const { data: service } = await admin
    .from('services')
    .select('*')
    .eq('id', input.serviceId)
    .eq('organization_id', input.organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (!service) {
    return { booking: {}, error: 'Service not available.', status: 400 };
  }

  let workerId = input.workerId && input.workerId !== 'any' ? input.workerId : null;

  if (!workerId) {
    const { data: links } = await admin
      .from('staff_services')
      .select('worker_id')
      .eq('organization_id', input.organizationId)
      .eq('service_id', input.serviceId);

    for (const row of links || []) {
      const conflicts = await findBookingConflicts(admin, {
        organizationId: input.organizationId,
        workerId: row.worker_id,
        startsAt: input.startsAt,
        endsAt: input.endsAt
      });
      if (!conflicts.length) {
        workerId = row.worker_id;
        break;
      }
    }
  }

  const conflicts = await findBookingConflicts(admin, {
    organizationId: input.organizationId,
    workerId,
    startsAt: input.startsAt,
    endsAt: input.endsAt
  });

  if (conflicts.length) {
    return { booking: {}, error: 'That time was just booked. Please choose another slot.', status: 409 };
  }

  const googleBusy = await fetchGoogleCalendarBusyPeriods(
    admin,
    input.organizationId,
    input.startsAt,
    input.endsAt
  );
  if (googleBusy.some((b) => b.starts_at < input.endsAt && b.ends_at > input.startsAt)) {
    return { booking: {}, error: 'That time is no longer available.', status: 409 };
  }

  let customerId: string | null = null;
  if (input.clientEmail?.trim()) {
    const { data: existingCustomer } = await admin
      .from('customers')
      .select('id')
      .eq('organization_id', input.organizationId)
      .ilike('email', input.clientEmail.trim())
      .maybeSingle();

    if (existingCustomer?.id) {
      customerId = existingCustomer.id;
    } else {
      const { data: createdCustomer } = await admin
        .from('customers')
        .insert({
          organization_id: input.organizationId,
          ...buildCustomerWritePayload({
            displayName: input.clientName.trim(),
            email: input.clientEmail.trim(),
            phone: input.clientPhone?.trim() || null,
            notes: input.notes?.trim() || null,
            pipeline_stage: 'lead',
            record_type: 'lead',
            lead_source: 'website'
          })
        })
        .select('id')
        .single();
      customerId = createdCustomer?.id || null;
    }
  }

  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      organization_id: input.organizationId,
      workspace_id: input.organizationId,
      service_id: input.serviceId,
      worker_id: workerId,
      customer_id: customerId,
      client_name: input.clientName.trim(),
      client_email: input.clientEmail?.trim() || null,
      client_phone: input.clientPhone?.trim() || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      notes: input.notes?.trim() || null,
      status: 'confirmed',
      source: 'public_booking'
    })
    .select('*, services(name), workers(name)')
    .single();

  if (error || !booking) {
    return { booking: {}, error: 'Unable to create booking. Please try again.', status: 400 };
  }

  const { data: settings } = await admin
    .from('organization_settings')
    .select('timezone, company_phone, company_email')
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  const sideEffects = await processBookingSideEffects(admin, {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    timezone: settings?.timezone || 'America/New_York',
    booking,
    appointmentName: service.name,
    sourceLabel: 'Public booking page',
    sendCustomerConfirmation: Boolean(input.clientEmail?.trim()),
    contactEmail: settings?.company_email || null,
    contactPhone: settings?.company_phone || null
  });

  if (sideEffects.calendarEventId) {
    booking.google_calendar_event_id = sideEffects.calendarEventId;
  }

  return {
    booking,
    warnings: sideEffects.warnings,
    confirmationSent: sideEffects.confirmationSent,
    serviceName: service.name
  };
}
