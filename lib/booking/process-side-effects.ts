import type { SupabaseClient } from '@supabase/supabase-js';
import { bookingAppointmentName, bookingStaffLabel } from '@/lib/booking/display';
import {
  sendCustomerBookingConfirmation,
  sendStaffBookingNotification,
  type CustomerConfirmationEmailInput
} from '@/lib/booking/booking-email';
import {
  createBookingGoogleCalendarEvent,
  type BookingCalendarInput
} from '@/lib/booking/google-calendar-booking';
import { appBookingsUrl } from '@/lib/booking/public-url';
import type { BookingRecord } from '@/lib/booking/types';

export type ProcessBookingSideEffectsInput = {
  organizationId: string;
  organizationName: string;
  timezone: string;
  booking: BookingRecord & {
    services?: { name: string } | null;
    workers?: { name: string } | null;
    manual_service_name?: string | null;
    staff_name?: string | null;
  };
  appointmentName?: string;
  staffDisplayName?: string | null;
  staffEmail?: string | null;
  sourceLabel: string;
  sendCustomerConfirmation?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export type ProcessBookingSideEffectsResult = {
  warnings: string[];
  confirmationSent: boolean;
  staffNotified: boolean;
  calendarEventId: string | null;
};

async function resolveStaffEmail(
  admin: SupabaseClient,
  workerId: string | null | undefined
): Promise<string | null> {
  if (!workerId) return null;

  const { data: worker } = await admin
    .from('workers')
    .select('auth_user_id, user_id, phone')
    .eq('id', workerId)
    .maybeSingle();

  const userId = worker?.auth_user_id || worker?.user_id || null;
  if (!userId) return null;

  const { data: profile } = await admin.from('profiles').select('email').eq('id', userId).maybeSingle();
  return profile?.email?.trim() || null;
}

export async function processBookingSideEffects(
  admin: SupabaseClient,
  input: ProcessBookingSideEffectsInput
): Promise<ProcessBookingSideEffectsResult> {
  const warnings: string[] = [];
  let confirmationSent = false;
  let staffNotified = false;
  let calendarEventId = input.booking.google_calendar_event_id || null;

  const appointmentName = input.appointmentName || bookingAppointmentName(input.booking);
  const staffName = input.staffDisplayName ?? bookingStaffLabel(input.booking);
  const bookingId = input.booking.id;

  if (!calendarEventId && input.booking.status === 'confirmed') {
    const calendarInput: BookingCalendarInput = {
      bookingId,
      clientName: input.booking.client_name,
      serviceName: appointmentName,
      workerName: staffName !== 'Unassigned' ? staffName : null,
      notes: input.booking.notes,
      startsAt: input.booking.starts_at,
      endsAt: input.booking.ends_at,
      source: input.sourceLabel
    };

    const calendar = await createBookingGoogleCalendarEvent(
      admin,
      input.organizationId,
      input.timezone,
      calendarInput
    );

    if (calendar.eventId) {
      calendarEventId = calendar.eventId;
      await admin
        .from('bookings')
        .update({
          google_calendar_event_id: calendar.eventId,
          calendar_sync_error: null
        })
        .eq('id', bookingId);
    } else if (calendar.error) {
      await admin
        .from('bookings')
        .update({ calendar_sync_error: calendar.error.slice(0, 500) })
        .eq('id', bookingId);
    }
  }

  if (input.sendCustomerConfirmation && input.booking.client_email?.trim()) {
    const customerInput: CustomerConfirmationEmailInput = {
      to: input.booking.client_email,
      businessName: input.organizationName,
      clientName: input.booking.client_name,
      appointmentName,
      startsAt: input.booking.starts_at,
      endsAt: input.booking.ends_at,
      staffName: staffName !== 'Unassigned' ? staffName : null,
      notes: input.booking.notes,
      bookingId,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone
    };

    const customerResult = await sendCustomerBookingConfirmation(customerInput);
    if (customerResult.sent) {
      confirmationSent = true;
      await admin
        .from('bookings')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', bookingId);
    } else if (customerResult.warning) {
      warnings.push(customerResult.warning);
    }
  }

  const staffEmail = input.staffEmail || (await resolveStaffEmail(admin, input.booking.worker_id));
  if (staffEmail && input.booking.worker_id) {
    const staffResult = await sendStaffBookingNotification({
      to: staffEmail,
      businessName: input.organizationName,
      clientName: input.booking.client_name,
      clientEmail: input.booking.client_email,
      clientPhone: input.booking.client_phone,
      appointmentName,
      startsAt: input.booking.starts_at,
      endsAt: input.booking.ends_at,
      notes: input.booking.notes,
      bookingUrl: appBookingsUrl(),
      source: input.sourceLabel
    });

    if (staffResult.sent) {
      staffNotified = true;
      await admin
        .from('bookings')
        .update({ staff_notified_at: new Date().toISOString() })
        .eq('id', bookingId);
    } else if (staffResult.warning) {
      warnings.push(staffResult.warning);
    }
  }

  return { warnings, confirmationSent, staffNotified, calendarEventId };
}

export async function resendBookingConfirmation(
  admin: SupabaseClient,
  input: Omit<ProcessBookingSideEffectsInput, 'sendCustomerConfirmation'>
): Promise<{ sent: boolean; warning?: string }> {
  if (!input.booking.client_email?.trim()) {
    return { sent: false, warning: 'This booking has no customer email.' };
  }

  const appointmentName = input.appointmentName || bookingAppointmentName(input.booking);
  const staffName = input.staffDisplayName ?? bookingStaffLabel(input.booking);

  const result = await sendCustomerBookingConfirmation({
    to: input.booking.client_email,
    businessName: input.organizationName,
    clientName: input.booking.client_name,
    appointmentName,
    startsAt: input.booking.starts_at,
    endsAt: input.booking.ends_at,
    staffName: staffName !== 'Unassigned' ? staffName : null,
    notes: input.booking.notes,
    bookingId: input.booking.id,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone
  });

  if (result.sent) {
    await admin
      .from('bookings')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('id', input.booking.id);
  }

  return result;
}
