import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/auth-logger';
import {
  googleCalendarHealthLabel,
  isGoogleCalendarOperational,
  resolveGoogleCalendarHealth
} from '@/lib/google-calendar-health';
import { getGoogleCalendarConnection } from '@/lib/google-calendar-sync';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { googleCalendarConfigured } from '@/lib/google-calendar-config';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache'
};

const BACKEND_TIMEOUT_MS = 8000;

class IntegrationTimeoutError extends Error {
  constructor(step: string) {
    super(`${step} timed out`);
    this.name = 'IntegrationTimeoutError';
  }
}

async function withTimeout<T>(promise: PromiseLike<T>, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new IntegrationTimeoutError(step)), BACKEND_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const supabase = await withTimeout(createServerSupabase(), 'Supabase initialization');
    const {
      data: { user },
      error: authError
    } = await withTimeout(supabase.auth.getUser(), 'User authentication');

    if (authError) {
      return NextResponse.json(
        { error: 'Could not verify your session.', code: 'calendar_auth_failed' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const org = await withTimeout(
      fetchOrganizationContextForRequest(supabase, user.id),
      'Workspace lookup'
    );
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const canManage = canManageOrganizationSettings(normalizeRole(org.role));

    if (!googleCalendarConfigured()) {
      return NextResponse.json(
        {
          configured: false,
          connected: false,
          health: 'not_connected' as const,
          healthLabel: 'Not Connected',
          canManage,
          provider: 'google_calendar',
          setupMessage: 'Google Calendar credentials are missing from the server.'
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const admin = createAdminSupabase();
    if (!admin) {
      return NextResponse.json(
        { error: 'Server not configured', code: 'calendar_admin_client_missing' },
        { status: 503, headers: NO_CACHE_HEADERS }
      );
    }

    const connection = await withTimeout(
      getGoogleCalendarConnection(admin, org.organizationId),
      'Google Calendar connection lookup'
    );
    const health = resolveGoogleCalendarHealth(connection);
    const connected = isGoogleCalendarOperational(health);

    logAuthEvent('google_calendar_status', {
      userId: user.id,
      organizationId: org.organizationId,
      connectionFound: Boolean(connection),
      expiryPresent: Boolean(connection?.token_expires_at),
      refreshPresent: Boolean(connection?.refresh_token),
      connected,
      phase: health,
      reason: connection?.last_sync_error?.slice(0, 180)
    });

    return NextResponse.json(
      {
        configured: true,
        connected,
        health,
        healthLabel: googleCalendarHealthLabel(health),
        canManage,
        provider: 'google_calendar',
        organizationId: org.organizationId,
        googleEmail: connected || health === 'reconnect_required' ? connection?.google_email || null : null,
        calendarId: connection?.calendar_id || 'primary',
        syncEnabled: connection?.sync_enabled ?? false,
        tokenExpiresAt: connection?.token_expires_at || null,
        lastSyncAt: connection?.last_sync_at || null,
        lastSyncError: connection?.last_sync_error || null
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    const timedOut = error instanceof IntegrationTimeoutError;
    console.error('Google Calendar status error', error);
    return NextResponse.json(
      {
        error: timedOut
          ? 'Google Calendar status timed out while loading workspace data.'
          : 'Google Calendar status could not be loaded.',
        code: timedOut ? 'calendar_status_timeout' : 'calendar_status_failed'
      },
      { status: timedOut ? 504 : 500, headers: NO_CACHE_HEADERS }
    );
  }
}
