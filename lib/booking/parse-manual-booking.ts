import { defaultBookingEndIso } from '@/lib/booking/display';

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

  if (!clientName || !startsAt) {
    return { ok: false, error: 'Add an appointment name, client name, and start time.' };
  }

  if (!serviceId && !manualServiceName) {
    return { ok: false, error: 'Add an appointment name, client name, and start time.' };
  }

  const startDate = new Date(startsAt);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, error: 'Start time is invalid.' };
  }

  const endsAt = body.ends_at?.trim()
    ? body.ends_at.trim()
    : defaultBookingEndIso(startsAt, 60);

  const endDate = new Date(endsAt);
  if (Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    return { ok: false, error: 'End time must be after the start time.' };
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
