import type { GoogleCalendarConnectionRow } from '@/lib/google-calendar-sync';

export type GoogleCalendarHealth =
  | 'not_connected'
  | 'connected'
  | 'token_expired'
  | 'reconnect_required';

const REVOKED_TOKEN_PATTERN = /invalid_grant|token has been expired|revoked|unauthorized_client|invalid credentials/i;

export const GOOGLE_CALENDAR_PROVIDER = 'google_calendar' as const;

export function isRevokedTokenError(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  return REVOKED_TOKEN_PATTERN.test(message);
}

export function resolveGoogleCalendarHealth(
  connection: GoogleCalendarConnectionRow | null | undefined,
  nowMs = Date.now()
): GoogleCalendarHealth {
  if (!connection) return 'not_connected';

  if (!connection.sync_enabled) return 'reconnect_required';
  if (!connection.refresh_token?.trim()) return 'reconnect_required';
  if (!connection.access_token?.trim()) return 'reconnect_required';

  if (isRevokedTokenError(connection.last_sync_error)) {
    return 'reconnect_required';
  }

  const expiresAt = Date.parse(connection.token_expires_at);
  if (!Number.isFinite(expiresAt)) return 'reconnect_required';

  if (expiresAt - nowMs <= 60_000) {
    return 'token_expired';
  }

  return 'connected';
}

/** Integration is present and may auto-refresh or sync. */
export function isGoogleCalendarOperational(health: GoogleCalendarHealth): boolean {
  return health === 'connected' || health === 'token_expired';
}

export function googleCalendarHealthLabel(health: GoogleCalendarHealth): string {
  switch (health) {
    case 'connected':
      return 'Connected';
    case 'token_expired':
      return 'Token Expired';
    case 'reconnect_required':
      return 'Reconnect Required';
    default:
      return 'Not Connected';
  }
}
