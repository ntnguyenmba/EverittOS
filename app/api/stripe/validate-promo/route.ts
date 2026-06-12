import { NextResponse } from 'next/server';
import { normalizePlan } from '@/lib/everittos-plans';
import { getStripeClient } from '@/lib/stripe-server';
import { validatePromotionCodeForPlan } from '@/lib/stripe-promo';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { code?: string; plan?: string };
  const code = (body.code || '').trim();
  const plan = normalizePlan(body.plan);

  if (!code) {
    return NextResponse.json({ valid: false, error: 'Enter a promo code.', errorCode: 'invalid' }, { status: 400 });
  }

  const result = await validatePromotionCodeForPlan(stripe, code, plan);
  if (!result.valid) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
