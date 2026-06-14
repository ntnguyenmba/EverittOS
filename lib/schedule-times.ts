/** Local date/time helpers for job scheduling. */

export function localTimeFromIso(iso: string | null | undefined, fallback = '09:00'): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function localDateFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Combine YYYY-MM-DD and HH:mm in the user's local timezone. */
export function combineDateAndTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr?.trim()) return null;
  const time = timeStr?.trim() || '09:00';
  const d = new Date(`${dateStr}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function hoursBetween(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round(((end - start) / 3600000) * 100) / 100;
}

export function formatScheduleDuration(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): string {
  const hours = hoursBetween(startIso, endIso);
  if (hours == null) return '';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours} hr${hours === 1 ? '' : 's'}`;
}

export function formatScheduleTimeRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  startDate?: string | null,
  dueDate?: string | null
): string {
  const datePart = startDate || localDateFromIso(startIso) || dueDate || 'No date';
  const startTime = localTimeFromIso(startIso, '');
  const endTime = localTimeFromIso(endIso, '');
  if (startTime && endTime) {
    const duration = formatScheduleDuration(startIso, endIso);
    return `${datePart} · ${startTime}–${endTime}${duration ? ` (${duration})` : ''}`;
  }
  return datePart;
}
