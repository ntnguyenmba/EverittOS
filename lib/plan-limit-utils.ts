/** -1 means unlimited for numeric plan caps */
export const UNLIMITED = -1;

export function isUnlimited(limit: number): boolean {
  return limit < 0;
}

export function limitReached(limit: number, count: number): boolean {
  if (isUnlimited(limit)) return false;
  return count >= limit;
}

export function formatUsageLabel(used: number, limit: number): string {
  if (isUnlimited(limit)) return 'Unlimited';
  return `${used} / ${limit} used`;
}
