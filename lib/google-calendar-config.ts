import { appUrl } from '@/lib/app-url';

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email'
] as const;

/** Production OAuth callback registered in Google Cloud Console. */
export const GOOGLE_CALENDAR_CALLBACK_PATH = '/api/integrations/google-calendar/callback';

/** Canonical redirect URI shown when server OAuth credentials are missing. */
export const GOOGLE_CALENDAR_PRODUCTION_REDIRECT_URI =
  'https://app.everittventures.com/api/integrations/google-calendar/callback';

export function googleCalendarRedirectUri(): string {
  const explicit = (process.env.GOOGLE_CALENDAR_REDIRECT_URI || '').trim();
  if (explicit) return explicit;
  return appUrl(GOOGLE_CALENDAR_CALLBACK_PATH);
}

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = (process.env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

export function googleCalendarClientId(): string {
  return readEnv('GOOGLE_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_ID');
}

export function googleCalendarClientSecret(): string {
  return readEnv('GOOGLE_CLIENT_SECRET', 'GOOGLE_CALENDAR_CLIENT_SECRET');
}

export function googleCalendarConfigured(): boolean {
  return Boolean(googleCalendarClientId() && googleCalendarClientSecret());
}

export function googleOAuthAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: googleCalendarClientId(),
    redirect_uri: googleCalendarRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
