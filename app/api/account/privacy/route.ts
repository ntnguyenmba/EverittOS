import { NextResponse } from 'next/server';
import { normalizeLocale } from '@/lib/i18n/config';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

type PrivacyPayload = {
  marketing_emails: boolean;
  product_updates: boolean;
  operational_notifications: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  do_not_sell: boolean;
  preferred_locale: string;
  locale: string;
};

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'marketing_emails, product_updates, operational_notifications, email_notifications, push_notifications, sms_notifications, do_not_sell, preferred_locale, locale, terms_accepted_at, privacy_accepted_at, terms_version, privacy_version'
    )
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || {});
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Partial<PrivacyPayload> = {};

  if (typeof body.marketing_emails === 'boolean') patch.marketing_emails = body.marketing_emails;
  if (typeof body.product_updates === 'boolean') patch.product_updates = body.product_updates;
  if (typeof body.operational_notifications === 'boolean') {
    patch.operational_notifications = body.operational_notifications;
  }
  if (typeof body.email_notifications === 'boolean') patch.email_notifications = body.email_notifications;
  if (typeof body.push_notifications === 'boolean') patch.push_notifications = body.push_notifications;
  if (typeof body.sms_notifications === 'boolean') patch.sms_notifications = body.sms_notifications;
  if (typeof body.do_not_sell === 'boolean') patch.do_not_sell = body.do_not_sell;

  if (typeof body.preferred_locale === 'string') {
    const nextLocale = normalizeLocale(body.preferred_locale);
    patch.preferred_locale = nextLocale;
    patch.locale = nextLocale;
  }

  if (typeof body.locale === 'string') {
    const nextLocale = normalizeLocale(body.locale);
    patch.locale = nextLocale;
    patch.preferred_locale = nextLocale;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select().maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
