import type { StaffAvailabilityRecord } from '@/lib/booking/types';
import { hasBookingConflict, type TimeRange } from '@/lib/booking/conflicts';

function parseTimeOnDate(dateKey: string, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${dateKey}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function formatLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function generateSlotsForDay(params: {
  dateKey: string;
  durationMinutes: number;
  availability: Pick<StaffAvailabilityRecord, 'starts_at' | 'ends_at' | 'buffer_minutes' | 'max_bookings'>;
  existingBookings: TimeRange[];
  externalBusy?: TimeRange[];
}): { starts_at: string; ends_at: string }[] {
  const dayStart = parseTimeOnDate(params.dateKey, params.availability.starts_at.slice(0, 5));
  const dayEnd = parseTimeOnDate(params.dateKey, params.availability.ends_at.slice(0, 5));
  const durationMs = params.durationMinutes * 60_000;
  const bufferMs = params.availability.buffer_minutes * 60_000;
  const stepMs = Math.max(durationMs, 15 * 60_000);

  const slots: { starts_at: string; ends_at: string }[] = [];
  let cursor = dayStart.getTime();

  while (cursor + durationMs <= dayEnd.getTime()) {
    const start = new Date(cursor);
    const end = new Date(cursor + durationMs);
    const candidate = {
      starts_at: start.toISOString(),
      ends_at: end.toISOString()
    };

    const localCandidate = {
      starts_at: formatLocalIso(start),
      ends_at: formatLocalIso(end)
    };

    const blocked =
      hasBookingConflict(params.existingBookings, candidate, params.availability.buffer_minutes) ||
      (params.externalBusy?.some((b) =>
        hasBookingConflict([b], candidate, params.availability.buffer_minutes)
      ) ?? false);

    if (!blocked) {
      slots.push(localCandidate);
      if (slots.length >= params.availability.max_bookings) break;
    }

    cursor += stepMs + bufferMs;
  }

  return slots;
}

export function dayOfWeekFromDateKey(dateKey: string): number {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.getDay();
}
