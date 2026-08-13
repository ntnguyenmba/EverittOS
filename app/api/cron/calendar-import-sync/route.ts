import { NextRequest, NextResponse } from 'next/server';
import { listEnabledCalendarImportConnections } from '@/lib/calendar-import/connections';
import { importCalendarConnection } from '@/lib/calendar-import/import-calendar';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache'
};

const BATCH_SIZE = 5;

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: 'Supabase admin client is not configured.' },
      { status: 503, headers: NO_CACHE_HEADERS }
    );
  }

  let connections;
  try {
    connections = await listEnabledCalendarImportConnections(admin, BATCH_SIZE);
  } catch {
    return NextResponse.json(
      { error: 'Could not load calendar import connections.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  const results: Array<{
    organizationId: string;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    error?: string;
  }> = [];

  for (const connection of connections) {
    try {
      const result = await importCalendarConnection(admin, connection, {
        ownerUserId: connection.created_by || undefined,
        writeActivity: false
      });
      results.push({
        organizationId: connection.organization_id,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed
      });
    } catch {
      results.push({
        organizationId: connection.organization_id,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 1,
        error: 'sync_failed'
      });
    }
  }

  const failedOrganizations = results.filter((result) => result.failed > 0 || result.error).length;

  return NextResponse.json(
    {
      ok: failedOrganizations === 0,
      processed: results.length,
      failedOrganizations,
      rotatingBatch: true,
      remainingBatchPossible: connections.length === BATCH_SIZE,
      results
    },
    { status: failedOrganizations > 0 ? 207 : 200, headers: NO_CACHE_HEADERS }
  );
}
