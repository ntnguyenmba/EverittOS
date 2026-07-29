import { NextRequest, NextResponse } from 'next/server';
import { syncOrganizationJobsToGoogleCalendar } from '@/lib/google-calendar-sync';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache'
};

// The wall-clock timezone fix shipped in this release. Connections that have
// synced successfully after this instant already use the corrected event body.
const TIMEZONE_FIX_RELEASED_AT = '2026-07-29T11:49:10.000Z';
const BATCH_SIZE = 5;

type ConnectionCandidate = {
  organization_id: string;
  last_sync_at: string | null;
};

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized.' },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: 'Supabase admin client is not configured.' },
      { status: 503, headers: NO_CACHE_HEADERS }
    );
  }

  const { data: connections, error: connectionError } = await admin
    .from('google_calendar_connections')
    .select('organization_id, last_sync_at')
    .eq('sync_enabled', true)
    .or(`last_sync_at.is.null,last_sync_at.lt.${TIMEZONE_FIX_RELEASED_AT}`)
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (connectionError) {
    console.error('Google Calendar timezone resync candidate lookup failed', connectionError);
    return NextResponse.json(
      { error: 'Could not load Google Calendar connections.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  const candidates = (connections || []) as ConnectionCandidate[];
  const results: Array<{
    organizationId: string;
    synced: number;
    failed: number;
    error?: string;
  }> = [];

  for (const connection of candidates) {
    const { data: settings, error: settingsError } = await admin
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', connection.organization_id)
      .maybeSingle();

    if (settingsError) {
      console.warn('Google Calendar timezone resync settings lookup failed', {
        organizationId: connection.organization_id,
        error: settingsError.message
      });
    }

    const result = await syncOrganizationJobsToGoogleCalendar(
      admin,
      connection.organization_id,
      settings?.timezone || 'America/New_York'
    );

    results.push({
      organizationId: connection.organization_id,
      synced: result.synced,
      failed: result.failed,
      ...(result.error ? { error: result.error } : {})
    });
  }

  const failedOrganizations = results.filter((result) => result.failed > 0 || result.error).length;

  return NextResponse.json(
    {
      ok: failedOrganizations === 0,
      releaseCutoff: TIMEZONE_FIX_RELEASED_AT,
      processed: results.length,
      failedOrganizations,
      remainingBatchPossible: candidates.length === BATCH_SIZE,
      results
    },
    { status: failedOrganizations > 0 ? 207 : 200, headers: NO_CACHE_HEADERS }
  );
}
