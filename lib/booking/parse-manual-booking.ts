import { validateBookingTimeRange } from '@/lib/booking/schema';

export type ManualBookingBody = {
  service_id?: string | null;
  manual_service_name?: string | null;
  service_name?: string | null;
  worker_id?: string | null;
  staff_name?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  notes?: string | null;
  status?: string | null;
  send_confirmation?: boolean;
};

export type ParsedManualBooking = {
  ok: true;
  serviceId: string | null;
  manualServiceName: string | null;
  workerId: string | null;
  staffName: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  status: string;
  sendConfirmation: boolean;
};

export type ParsedManualBookingError = {
  ok: false;
  error: string;
};

export function parseManualBookingInput(
  body: ManualBookingBody,
  options?: { defaultSendConfirmation?: boolean }
): ParsedManualBooking | ParsedManualBookingError {
  const clientName = body.client_name?.trim() || '';
  const startsAt = body.starts_at?.trim() || '';
  const serviceId = body.service_id?.trim() || null;
  const manualServiceName =
    body.manual_service_name?.trim() || body.service_name?.trim() || null;

  const endsAtRaw = body.ends_at?.trim() || '';

  if (!clientName || !startsAt || !endsAtRaw) {
    return { ok: false, error: 'Add client name, start time, and end time.' };
  }

  const startDate = new Date(startsAt);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, error: 'Start time is invalid.' };
  }

  const endsAt = endsAtRaw;

  const timeError = validateBookingTimeRange(startsAt, endsAt);
  if (timeError) {
    return { ok: false, error: timeError };
  }

  const clientEmail = body.client_email?.trim() || null;
  const sendConfirmation =
    body.send_confirmation !== undefined
      ? Boolean(body.send_confirmation)
      : Boolean(options?.defaultSendConfirmation ?? clientEmail);

  return {
    ok: true,
    serviceId,
    manualServiceName: manualServiceName || null,
    workerId: body.worker_id?.trim() || null,
    staffName: body.staff_name?.trim() || null,
    clientName,
    clientEmail,
    clientPhone: body.client_phone?.trim() || null,
    startsAt,
    endsAt,
    notes: body.notes?.trim() || null,
    status: body.status?.trim() || 'confirmed',
    sendConfirmation
  };
}
