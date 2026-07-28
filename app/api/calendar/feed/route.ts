import { NextResponse } from 'next/server';
import {
  calendarFeedUrl,
  generateCalendarFeedToken,
  maskCalendarToken,
  webcalFeedUrl
} from '@/lib/calendar-feed';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from('calendar_feed_tokens')
    .select('id, token, created_at, revoked_at, last_accessed_at')
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('user_id', ctx.userId)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    const missing = /does not exist|schema cache|42p01/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? 'Calendar feed is unavailable until the database migration is applied.'
          : error.message,
        configured: !missing,
        feed: null
      },
      { status: missing ? 503 : 400 }
    );
  }

  if (!data?.token) {
    return NextResponse.json({ feed: null });
  }

  return NextResponse.json({
    feed: {
      id: data.id,
      tokenMasked: maskCalendarToken(data.token),
      url: calendarFeedUrl(data.token),
      webcalUrl: webcalFeedUrl(data.token),
      createdAt: data.created_at,
      lastAccessedAt: data.last_accessed_at
    }
  });
}

export async function POST() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  // Revoke any existing active token for this user.
  await ctx.supabase
    .from('calendar_feed_tokens')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('user_id', ctx.userId)
    .is('revoked_at', null);

  const token = generateCalendarFeedToken();
  const { data, error } = await ctx.supabase
    .from('calendar_feed_tokens')
    .insert({
      organization_id: ctx.workspace.organizationId,
      user_id: ctx.userId,
      token,
      label: 'Personal schedule feed'
    })
    .select('id, token, created_at')
    .single();

  if (error) {
    const missing = /does not exist|schema cache|42p01/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? 'Calendar feed is unavailable until the database migration is applied.'
          : error.message
      },
      { status: missing ? 503 : 400 }
    );
  }

  return NextResponse.json({
    feed: {
      id: data.id,
      tokenMasked: maskCalendarToken(data.token),
      url: calendarFeedUrl(data.token),
      webcalUrl: webcalFeedUrl(data.token),
      createdAt: data.created_at,
      lastAccessedAt: null
    }
  });
}

export async function DELETE() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { error } = await ctx.supabase
    .from('calendar_feed_tokens')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('user_id', ctx.userId)
    .is('revoked_at', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
