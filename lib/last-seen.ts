/** Online if last seen within this window. */
export const LAST_SEEN_ONLINE_MS = 5 * 60 * 1000;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Friendly last-active label from an ISO timestamp.
 * Never returns a raw timestamp. Null/invalid → "Never".
 */
export function formatLastSeenAt(
  value: string | null | undefined,
  nowInput: Date | number = Date.now()
): string {
  if (!value) return 'Never';

  const seenAt = new Date(value);
  if (Number.isNaN(seenAt.getTime())) return 'Never';

  const now = typeof nowInput === 'number' ? nowInput : nowInput.getTime();
  const diffMs = Math.max(0, now - seenAt.getTime());

  if (diffMs < LAST_SEEN_ONLINE_MS) {
    return 'Online now';
  }

  if (diffMs < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(diffMs / MINUTE_MS));
    return `${minutes} min ago`;
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  const todayStart = startOfLocalDay(new Date(now));
  const yesterdayStart = todayStart - DAY_MS;
  const seenDayStart = startOfLocalDay(seenAt);

  if (seenDayStart === yesterdayStart) {
    return 'Yesterday';
  }

  const dayDiff = Math.floor((todayStart - seenDayStart) / DAY_MS);
  if (dayDiff >= 2 && dayDiff < 7) {
    return `${dayDiff} days ago`;
  }

  return seenAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(seenAt.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' as const } : {})
  });
}
