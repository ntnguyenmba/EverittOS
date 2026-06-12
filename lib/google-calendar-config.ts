import { appUrl } from '@/lib/app-url';

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email'
] as const;

export function googleCalendarRedirectUri(): string {
  const explicit = (process.env.GOOGLE_CALENDAR_REDIRECT_URI || '').trim();
  if (explicit) return explicit;
  return appUrl('/api/integrations/google-calendar/callback');
}

export function googleCalendarConfigured(): boolean {
  return Boolean(
    (process.env.GOOGLE_CALENDAR_CLIENT_ID || '').trim() &&
      (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '').trim()
  );
}

export function googleCalendarClientId(): string {
  return (process.env.GOOGLE_CALENDAR_CLIENT_ID || '').trim();
}

export function googleCalendarClientSecret(): string {
  return (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '').trim();
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
