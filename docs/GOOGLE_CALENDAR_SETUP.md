# Google Calendar OAuth setup (EverittOS)

Production domain: **https://app.everittventures.com**

## Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select (or create) your project.
2. Enable **Google Calendar API** (APIs & Services → Library → Google Calendar API → Enable).
3. Configure the OAuth consent screen (External or Internal per your Google Workspace policy).
4. Create **OAuth 2.0 Client ID** (APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application).

### Authorized JavaScript origins

Add exactly:

```
https://app.everittventures.com
```

### Authorized redirect URIs

Add exactly:

```
https://app.everittventures.com/api/integrations/google-calendar/callback
```

Do not add trailing slashes. Do not use `http://` for production.

### Required OAuth scopes

EverittOS requests these scopes during connect:

| Scope | Purpose |
|-------|---------|
| `https://www.googleapis.com/auth/calendar.events` | Create and update job events on the connected calendar |
| `https://www.googleapis.com/auth/userinfo.email` | Show which Google account is connected |

In the OAuth consent screen, add the Calendar scope under **Data Access** if prompted during verification.

## Vercel environment variables

Set these on the **Production** environment for the EverittOS project:

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_APP_URL` | `https://app.everittventures.com` |
| `GOOGLE_CALENDAR_CLIENT_ID` | Your Google OAuth Web client ID (ends with `.apps.googleusercontent.com`) |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Your Google OAuth client secret |
| `GOOGLE_CALENDAR_REDIRECT_URI` | `https://app.everittventures.com/api/integrations/google-calendar/callback` |

Optional:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CALENDAR_OAUTH_STATE_SECRET` | HMAC secret for OAuth state tokens (defaults to client secret) |

Existing variables (unchanged):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

After saving env vars, ** redeploy** the production deployment on Vercel.

## Supabase migration

Apply:

```
supabase/migrations/202606140001_google_calendar_integration.sql
```

This creates `google_calendar_connections` and `job_google_calendar_events`. OAuth tokens are stored server-side only (no client RLS read access).

## Connect in EverittOS

1. Sign in as workspace **owner** or **admin**.
2. Open **Settings → Integrations**.
3. Click **Connect Google Calendar** and approve access in Google.
4. Scheduled jobs with `scheduled_start` / `scheduled_end` or `due_date` sync to the **primary** calendar.
5. Schedule changes sync automatically; use **Sync now** to backfill existing jobs.

## Local development (optional)

If you test OAuth locally, create a separate Google OAuth client or add:

**Authorized JavaScript origin**

```
http://localhost:3000
```

**Authorized redirect URI**

```
http://localhost:3000/api/integrations/google-calendar/callback
```

Set in `.env.local`:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/integrations/google-calendar/callback
```

Production Google Cloud values above remain required for `app.everittventures.com`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `redirect_uri_mismatch` | Redirect URI in Google Console must match `GOOGLE_CALENDAR_REDIRECT_URI` exactly |
| `Google Calendar is not configured` | Set `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET` in Vercel and redeploy |
| `missing_refresh_token` | Revoke EverittOS in [Google Account permissions](https://myaccount.google.com/permissions) and reconnect (consent uses `prompt=consent`) |
| Events not appearing | Job needs a schedule or due date; open Integrations → **Sync now** |
