import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function allowedAdminEmails(): Set<string> {
  const configured = [process.env.EVERITT_ADMIN_EMAILS, process.env.ADMIN_EMAILS]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  return new Set([
    ...configured,
    'team@everittventures.com',
    'tien@everittventures.com',
    'ntnguyenmba@gmail.com'
  ]);
}

export async function GET() {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized or server not configured' }, { status: 401 });
  }

  const userEmail = normalizeEmail(user.email);
  if (!allowedAdminEmails().has(userEmail)) {
    return NextResponse.json({ error: 'Only Everitt admins can view referral reports.' }, { status: 403 });
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name, business_name, referral_source, referral_detail, referred_by, created_at')
    .or('referral_source.not.is.null,referral_detail.not.is.null,referred_by.not.is.null')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ referrals: data || [] });
}
