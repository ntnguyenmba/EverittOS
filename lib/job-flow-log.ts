import { logAuthEvent } from '@/lib/auth-logger';

const JOB_EVENTS = new Set(['job_create_failed', 'job_create_succeeded', 'job_list_failed']);

export function logJobFlowEvent(
  event: 'job_create_failed' | 'job_create_succeeded' | 'job_list_failed' | 'job_client_access_failed',
  meta: Record<string, string | number | boolean | null | undefined>
): void {
  if (JOB_EVENTS.has(event)) {
    logAuthEvent(event, meta);
    return;
  }
  logAuthEvent(event, meta);
}
