import {
  googleCalendarClientId,
  googleCalendarClientSecret,
  googleCalendarRedirectUri
} from '@/lib/google-calendar-config';

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type GoogleUserInfo = {
  email?: string;
};

export async function exchangeGoogleAuthCode(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: googleCalendarClientId(),
      client_secret: googleCalendarClientSecret(),
      redirect_uri: googleCalendarRedirectUri(),
      grant_type: 'authorization_code'
    })
  });

  const json = (await res.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(json.error_description || json.error || 'Google token exchange failed.');
  }
  if (!json.access_token) {
    throw new Error('Google did not return an access token.');
  }
  return json;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: googleCalendarClientId(),
      client_secret: googleCalendarClientSecret(),
      grant_type: 'refresh_token'
    })
  });

  const json = (await res.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(json.error_description || json.error || 'Google token refresh failed.');
  }
  if (!json.access_token) {
    throw new Error('Google did not return a refreshed access token.');
  }
  return json;
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const json = (await res.json()) as GoogleUserInfo;
  return json.email || null;
}
