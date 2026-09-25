import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';

type ReferralPayoutPayload = {
  profileId?: string;
  referralSource?: string | null;
  referralDetail?: string | null;
  referredBy?: string | null;
  payoutStatus?: string | null;
  payoutAmount?: string | number | null;
  payoutDate?: string | null;
  payoutNotes?: string | null;
};

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function cleanText(value: unknown, max = 240): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

function cleanAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function cleanStatus(value: unknown): 'unpaid' | 'pending' | 'paid' {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  if (status === 'pending' || status === 'paid') return status;
  return 'unpaid';
}

function cleanDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : value;
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

async function requireReferralAdmin() {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return { ok: false as const, error: 'Unauthorized or server not configured', status: 401 };
  }

  const userEmail = normalizeEmail(user.email);
  if (!allowedAdminEmails().has(userEmail)) {
    return { ok: false as const, error: 'Only Everitt admins can view referral reports.', status: 403 };
  }

  return { ok: true as const, admin };
}

export async function GET(request: Request) {
  const ctx = await requireReferralAdmin();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const url = new URL(request.url);
  const from = cleanDateParam(url.searchParams.get('from'));
  const to = cleanDateParam(url.searchParams.get('to'));
  if (url.searchParams.get('from') && !from) {
    return NextResponse.json({ error: 'Invalid from date. Use YYYY-MM-DD.' }, { status: 400 });
  }
  if (url.searchParams.get('to') && !to) {
    return NextResponse.json({ error: 'Invalid to date. Use YYYY-MM-DD.' }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ error: 'The from date must be before or equal to the to date.' }, { status: 400 });
  }

  let query = ctx.admin
    .from('profiles')
    .select('id, email, full_name, business_name, referral_source, referral_detail, referred_by, created_at')
    .or('referral_source.not.is.null,referral_detail.not.is.null,referred_by.not.is.null');

  if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`);
  if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(500);

  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  const profileIds = (data || []).map((row) => row.id).filter(Boolean);
  const { data: payouts } = profileIds.length
    ? await ctx.admin.from('referral_payouts').select('*').in('profile_id', profileIds)
    : { data: [] };

  const payoutMap = new Map((payouts || []).map((payout) => [payout.profile_id, payout]));

  return NextResponse.json({
    filters: { from, to },
    count: data?.length || 0,
    referrals: (data || []).map((row) => ({
      ...row,
      payout: payoutMap.get(row.id) || null
    }))
  });
}

export async function PATCH(request: Request) {
  const ctx = await requireReferralAdmin();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = (await request.json()) as ReferralPayoutPayload;
  if (!body.profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  const payload = {
    profile_id: body.profileId,
    referral_source: cleanText(body.referralSource),
    referral_detail: cleanText(body.referralDetail),
    referred_by: cleanText(body.referredBy),
    payout_status: cleanStatus(body.payoutStatus),
    payout_amount: cleanAmount(body.payoutAmount),
    payout_date: cleanText(body.payoutDate, 20),
    payout_notes: cleanText(body.payoutNotes, 500),
    updated_at: new Date().toISOString()
  };

  const { data: payout, error } = await ctx.admin
    .from('referral_payouts')
    .upsert(payload, { onConflict: 'profile_id' })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }

  await ctx.admin
    .from('profiles')
    .update({
      referral_source: payload.referral_source,
      referral_detail: payload.referral_detail,
      referred_by: payload.referred_by
    })
    .eq('id', body.profileId);

  return NextResponse.json({ payout });
}
