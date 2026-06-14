import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookingStatus } from '@/lib/booking/types';

const BLOCKING_STATUSES: BookingStatus[] = ['confirmed', 'pending', 'completed'];

export type TimeRange = { starts_at: string; ends_at: string };

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return new Date(a.starts_at).getTime() < new Date(b.ends_at).getTime()
    && new Date(a.ends_at).getTime() > new Date(b.starts_at).getTime();
}

export async function findBookingConflicts(
  admin: SupabaseClient,
  params: {
    organizationId: string;
    workerId: string | null;
    startsAt: string;
    endsAt: string;
    excludeBookingId?: string;
  }
): Promise<{ id: string; starts_at: string; ends_at: string }[]> {
  let query = admin
    .from('bookings')
    .select('id, starts_at, ends_at, worker_id, status')
    .eq('organization_id', params.organizationId)
    .in('status', BLOCKING_STATUSES)
    .lt('starts_at', params.endsAt)
    .gt('ends_at', params.startsAt);

  if (params.excludeBookingId) {
    query = query.neq('id', params.excludeBookingId);
  }

  const { data } = await query;

  const rows = (data || []) as { id: string; starts_at: string; ends_at: string; worker_id: string | null }[];

  if (!params.workerId) {
    return rows;
  }

  return rows.filter((row) => !row.worker_id || row.worker_id === params.workerId);
}

export function hasBookingConflict(
  existing: TimeRange[],
  candidate: TimeRange,
  bufferMinutes = 0
): boolean {
  const bufferMs = bufferMinutes * 60_000;
  const start = new Date(candidate.starts_at).getTime() - bufferMs;
  const end = new Date(candidate.ends_at).getTime() + bufferMs;

  return existing.some((row) => {
    const rowStart = new Date(row.starts_at).getTime();
    const rowEnd = new Date(row.ends_at).getTime();
    return start < rowEnd && end > rowStart;
  });
}
