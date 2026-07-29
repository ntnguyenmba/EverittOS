import { NextResponse } from 'next/server';
import { buildAuthorizedCalendarFeedIcs } from '@/lib/calendar-feed';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

async function resolveFeed(context: Params, includeBody: boolean) {
  const { token } = await context.params;
  const feedToken = String(token || '')
    .trim()
    .replace(/\.ics$/i, '');
  if (!feedToken || feedToken.length < 16) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return new NextResponse('Calendar feed unavailable', { status: 503 });
  }

  const { data: row, error } = await admin
    .from('calendar_feed_tokens')
    .select('id, organization_id, user_id, revoked_at')
    .eq('token', feedToken)
    .maybeSingle();

  if (error || !row || row.revoked_at) {
    return new NextResponse('Not found', { status: 404 });
  }

  const headers = {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="everittos-schedule.ics"',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Content-Type-Options': 'nosniff'
  };

  if (!includeBody) {
    return new NextResponse(null, { status: 200, headers });
  }

  const [{ data: membership }, { data: organizationSettings }] = await Promise.all([
    admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', row.organization_id)
      .eq('user_id', row.user_id)
      .maybeSingle(),
    admin
      .from('organization_settings')
      .select('timezone')
      .eq('organization_id', row.organization_id)
      .maybeSingle()
  ]);

  const ics = await buildAuthorizedCalendarFeedIcs({
    admin,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: membership?.role || 'employee',
    timeZone: organizationSettings?.timezone || 'America/Chicago'
  });

  await admin
    .from('calendar_feed_tokens')
    .update({ last_accessed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', row.id);

  return new NextResponse(ics, {
    status: 200,
    headers
  });
}

export async function GET(_request: Request, context: Params) {
  return resolveFeed(context, true);
}

export async function HEAD(_request: Request, context: Params) {
  return resolveFeed(context, false);
}
