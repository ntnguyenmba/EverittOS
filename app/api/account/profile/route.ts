import { NextResponse } from 'next/server';
import { normalizeLocale } from '@/lib/i18n/config';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildDisplayName(firstName: string | null, lastName: string | null, displayName: string | null): string | null {
  if (displayName?.trim()) return displayName.trim();
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

export async function GET() {
  const { supabase } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'first_name, last_name, display_name, full_name, phone, avatar_url, email, deleted_at, deletion_scheduled_at, marketing_emails, product_updates, operational_notifications, email_notifications, push_notifications, sms_notifications, preferred_locale, locale'
    )
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({
    email: user.email,
    firstName: data?.first_name || '',
    lastName: data?.last_name || '',
    displayName: data?.display_name || data?.full_name || '',
    phone: data?.phone || '',
    avatarUrl: data?.avatar_url || null,
    deletedAt: data?.deleted_at || null,
    deletionScheduledAt: data?.deletion_scheduled_at || null,
    notifications: {
      marketingEmails: data?.marketing_emails ?? false,
      productUpdates: data?.product_updates ?? true,
      operationalNotifications: data?.operational_notifications ?? true,
      emailNotifications: data?.email_notifications ?? true,
      pushNotifications: data?.push_notifications ?? false,
      smsNotifications: data?.sms_notifications ?? false
    },
    locale: data?.locale || data?.preferred_locale || 'en'
  });
}

export async function PATCH(request: Request) {
  const { supabase } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body.firstName === 'string') patch.first_name = body.firstName.trim() || null;
  if (typeof body.lastName === 'string') patch.last_name = body.lastName.trim() || null;
  if (typeof body.displayName === 'string') patch.display_name = body.displayName.trim() || null;
  if (typeof body.phone === 'string') patch.phone = body.phone.trim() || null;

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : undefined;
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : undefined;
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;

  if (firstName !== undefined || lastName !== undefined || displayName !== undefined) {
    const { data: current } = await supabase
      .from('profiles')
      .select('first_name, last_name, display_name')
      .eq('id', user.id)
      .maybeSingle();

    patch.full_name = buildDisplayName(
      firstName ?? current?.first_name ?? null,
      lastName ?? current?.last_name ?? null,
      displayName ?? current?.display_name ?? null
    );
  }

  if (typeof body.newEmail === 'string') {
    const nextEmail = body.newEmail.trim().toLowerCase();
    if (!nextEmail || !nextEmail.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail });
    if (emailError) {
      return NextResponse.json({ error: publicErrorMessage(emailError) }, { status: 400 });
    }
    patch.email = nextEmail;
  }

  if (typeof body.newPassword === 'string' && body.newPassword.trim()) {
    if (String(body.newPassword).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    const { error: passwordError } = await supabase.auth.updateUser({ password: body.newPassword });
    if (passwordError) {
      return NextResponse.json({ error: publicErrorMessage(passwordError) }, { status: 400 });
    }
  }

  const notifications = body.notifications;
  if (notifications && typeof notifications === 'object') {
    if (typeof notifications.marketingEmails === 'boolean') patch.marketing_emails = notifications.marketingEmails;
    if (typeof notifications.productUpdates === 'boolean') patch.product_updates = notifications.productUpdates;
    if (typeof notifications.operationalNotifications === 'boolean') {
      patch.operational_notifications = notifications.operationalNotifications;
    }
    if (typeof notifications.emailNotifications === 'boolean') patch.email_notifications = notifications.emailNotifications;
    if (typeof notifications.pushNotifications === 'boolean') patch.push_notifications = notifications.pushNotifications;
    if (typeof notifications.smsNotifications === 'boolean') patch.sms_notifications = notifications.smsNotifications;
  }

  if (typeof body.locale === 'string') {
    const nextLocale = normalizeLocale(body.locale);
    patch.locale = nextLocale;
    patch.preferred_locale = nextLocale;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'Account settings saved.' });
}
