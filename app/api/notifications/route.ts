import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getNotificationsApiCopy } from '@/lib/i18n/notifications-api-copy';

export async function GET(request: Request) {
  const c = getNotificationsApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, read_at, related_job_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: c.loadError }, { status: 400 });

  const unread = (data || []).filter((n) => !n.read_at).length;
  return NextResponse.json({ notifications: data || [], unread });
}

export async function PATCH(request: Request) {
  const c = getNotificationsApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string; markAll?: boolean };

  if (body.markAll) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) return NextResponse.json({ error: c.updateError }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ error: c.idRequired }, { status: 400 });

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: c.updateError }, { status: 400 });
  return NextResponse.json({ ok: true });
}
