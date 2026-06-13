import { NextResponse } from 'next/server';
import { normalizePlan } from '@/lib/everittos-plans';
import { logPromoCodeFailure } from '@/lib/promo-code-logging';
import { createServerSupabase } from '@/lib/supabase-server';
import { getStripeClient } from '@/lib/stripe-server';
import { validatePromotionCodeForPlan } from '@/lib/stripe-promo';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured.', errorCode: 'stripe_not_configured' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { code?: string; plan?: string };
  const code = (body.code || '').trim();
  const plan = normalizePlan(body.plan);

  if (!code) {
    return NextResponse.json({ valid: false, error: 'Enter a promo code.', errorCode: 'invalid' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
    : { data: null };

  const result = await validatePromotionCodeForPlan(stripe, code, plan);
  if (!result.valid) {
    void logPromoCodeFailure({
      userId: user?.id || null,
      organizationId: profile?.organization_id || null,
      stage: 'validate',
      code,
      plan,
      errorCode: result.errorCode,
      error: result.error
    }).catch((error) => console.warn('[promo] failure log skipped', error));

    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
