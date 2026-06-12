import { logAuthEvent } from '@/lib/auth-logger';

export function logSaveFlowEvent(
  event: string,
  meta: Record<string, string | number | boolean | null | undefined>
): void {
  logAuthEvent(event, meta);
}
