import { NextRequest, NextResponse } from 'next/server';
import { listEnabledCalendarImportConnections } from '@/lib/calendar-import/connections';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache'
};

const BATCH_SIZE = 25;

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

  try {
    const connections = await listEnabledCalendarImportConnections(admin, BATCH_SIZE);

    // Calendar Import is review-first. The scheduled task must never create,
    // update, cancel, or otherwise modify Jobs without an explicit user approval.
    return NextResponse.json(
      {
        ok: true,
        processed: connections.length,
        reviewRequired: true,
        automaticJobWrites: false,
        organizations: connections.map((connection) => connection.organization_id)
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { error: 'Could not load calendar import connections.' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
