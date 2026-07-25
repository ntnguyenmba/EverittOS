import { NextResponse } from 'next/server';
import { syncOrganizationJobsToGoogleCalendar } from '@/lib/google-calendar-sync';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache'
};

const SETUP_TIMEOUT_MS = 8000;
const SYNC_TIMEOUT_MS = 22000;

class IntegrationTimeoutError extends Error {
  constructor(step: string) {
    super(`${step} timed out`);
    this.name = 'IntegrationTimeoutError';
  }
}

async function withTimeout<T>(promise: PromiseLike<T>, step: string, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new IntegrationTimeoutError(step)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function statusForSyncError(message: string): number {
  const normalized = message.toLowerCase();
  if (normalized.includes('not connected') || normalized.includes('reconnect')) return 409;
  if (normalized.includes('permission') || normalized.includes('forbidden')) return 403;
  if (normalized.includes('token') || normalized.includes('unauthorized')) return 401;
  if (normalized.includes('not configured') || normalized.includes('configuration')) return 503;
  return 400;
}

export async function POST() {
  try {
    const supabase = await withTimeout(createServerSupabase(), 'Supabase initialization', SETUP_TIMEOUT_MS);
    const {
      data: { user },
      error: authError
    } = await withTimeout(supabase.auth.getUser(), 'User authentication', SETUP_TIMEOUT_MS);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Your session could not be verified. Sign in again and retry.', code: 'calendar_sync_unauthorized' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const org = await withTimeout(
      fetchOrganizationContextForRequest(supabase, user.id),
      'Workspace lookup',
      SETUP_TIMEOUT_MS
    );
    if (!org) {
      return NextResponse.json(
        { error: 'Workspace not found.', code: 'calendar_sync_workspace_missing' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    if (!canManageOrganizationSettings(normalizeRole(org.role))) {
      return NextResponse.json(
        { error: 'Only workspace owners and admins can sync Google Calendar.', code: 'calendar_sync_forbidden' },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const admin = createAdminSupabase();
    if (!admin) {
      return NextResponse.json(
        { error: 'Google Calendar sync is not configured on the server.', code: 'calendar_sync_server_config' },
        { status: 503, headers: NO_CACHE_HEADERS }
      );
    }

    const settingsResult = await withTimeout(
      admin
        .from('organization_settings')
        .select('timezone')
        .eq('organization_id', org.organizationId)
        .maybeSingle(),
      'Workspace timezone lookup',
      SETUP_TIMEOUT_MS
    );

    if (settingsResult.error) {
      console.warn('Google Calendar timezone lookup failed', {
        organizationId: org.organizationId,
        error: settingsResult.error.message
      });
    }

    const result = await withTimeout(
      syncOrganizationJobsToGoogleCalendar(
        admin,
        org.organizationId,
        settingsResult.data?.timezone || 'America/New_York'
      ),
      'Google Calendar sync',
      SYNC_TIMEOUT_MS
    );

    if (result.error && result.synced === 0 && result.failed === 0) {
      return NextResponse.json(
        {
          error: result.error,
          code: 'calendar_sync_rejected',
          synced: 0,
          failed: 0
        },
        { status: statusForSyncError(result.error), headers: NO_CACHE_HEADERS }
      );
    }

    const partialFailure = result.failed > 0;
    return NextResponse.json(
      {
        ok: !partialFailure,
        partial: partialFailure,
        synced: result.synced,
        failed: result.failed,
        error: partialFailure ? result.error || `${result.failed} calendar event(s) could not be synced.` : null,
        message: partialFailure
          ? `Google Calendar sync finished with ${result.synced} synced and ${result.failed} failed.`
          : `Google Calendar sync completed. ${result.synced} event(s) synced.`
      },
      { status: partialFailure ? 207 : 200, headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    const timedOut = error instanceof IntegrationTimeoutError;
    console.error('Google Calendar sync error', error);
    return NextResponse.json(
      {
        error: timedOut
          ? 'Google Calendar sync timed out before it could finish. Try again in a moment.'
          : 'Google Calendar sync failed unexpectedly.',
        code: timedOut ? 'calendar_sync_timeout' : 'calendar_sync_failed'
      },
      { status: timedOut ? 504 : 500, headers: NO_CACHE_HEADERS }
    );
  }
}
