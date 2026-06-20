import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Stripe from 'stripe';
import { planCardAction } from '@/lib/billing-plan-actions';
import { checkoutPromotionParams } from '@/lib/stripe-checkout-params';
import { calculateDiscountedPrice, validatePromotionCodeForPlan } from '@/lib/stripe-promo';

/** Stripe promotion codes configured for EverittOS billing. */
export const STRIPE_PROMO_CODES = ['VIP', 'FOUNDING', 'STAY25', 'EVERITTTEAM'] as const;

function mockStripeForCode(code: string, coupon: Stripe.Coupon): Stripe {
  const promotion: Stripe.PromotionCode = {
    id: `promo_${code.toLowerCase()}`,
    object: 'promotion_code',
    active: true,
    code,
    coupon,
    created: 0,
    customer: null,
    expires_at: null,
    livemode: false,
    max_redemptions: null,
    metadata: {},
    restrictions: { first_time_transaction: false, minimum_amount: null, minimum_amount_currency: null },
    times_redeemed: 0
  };

  return {
    promotionCodes: {
      list: async ({ code: lookup }: { code?: string }) => ({
        data: lookup?.toUpperCase() === code ? [promotion] : []
      }),
      retrieve: async () => promotion
    },
    coupons: {
      retrieve: async () => coupon
    }
  } as unknown as Stripe;
}

function baseCoupon(overrides: Partial<Stripe.Coupon>): Stripe.Coupon {
  return {
    id: 'coupon_test',
    object: 'coupon',
    amount_off: null,
    created: 0,
    currency: 'usd',
    duration: 'forever',
    duration_in_months: null,
    livemode: false,
    max_redemptions: null,
    metadata: {},
    name: 'Test coupon',
    percent_off: null,
    redeem_by: null,
    times_redeemed: 0,
    valid: true,
    ...overrides
  };
}

describe('checkoutPromotionParams', () => {
  it('enables Stripe Checkout promotion codes when no in-app code is applied', () => {
    assert.deepEqual(checkoutPromotionParams(undefined), { allow_promotion_codes: true });
    assert.deepEqual(checkoutPromotionParams(''), { allow_promotion_codes: true });
  });

  it('pre-applies a validated promotion code on the checkout session', () => {
    assert.deepEqual(checkoutPromotionParams('promo_abc123'), {
      discounts: [{ promotion_code: 'promo_abc123' }]
    });
  });
});

describe('validatePromotionCodeForPlan', () => {
  it('rejects empty codes', async () => {
    const stripe = mockStripeForCode('VIP', baseCoupon({ percent_off: 20 }));
    const result = await validatePromotionCodeForPlan(stripe, '   ', 'pro');
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.errorCode, 'invalid');
    }
  });

  it('rejects unknown codes', async () => {
    const stripe = mockStripeForCode('VIP', baseCoupon({ percent_off: 20 }));
    const result = await validatePromotionCodeForPlan(stripe, 'NOTREAL', 'pro');
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.error, /not valid/i);
    }
  });

  it('accepts VIP for Pro and returns discounted preview', async () => {
    const stripe = mockStripeForCode(
      'VIP',
      baseCoupon({ id: 'coupon_vip', name: 'VIP', percent_off: 20, duration: 'forever' })
    );
    const result = await validatePromotionCodeForPlan(stripe, 'vip', 'pro');
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.code, 'VIP');
      assert.equal(result.discountedPriceCents, 720);
      assert.equal(result.originalPriceCents, 900);
      assert.match(result.discountedPriceLabel, /\$7/);
    }
  });

  it('accepts FOUNDING for Business checkout preview', async () => {
    const stripe = mockStripeForCode(
      'FOUNDING',
      baseCoupon({ id: 'coupon_founding', name: 'Founding member', amount_off: 1000, duration: 'once' })
    );
    const result = await validatePromotionCodeForPlan(stripe, 'FOUNDING', 'business');
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.code, 'FOUNDING');
      assert.equal(result.discountedPriceCents, 2900);
    }
  });

  it('accepts STAY25 for Pro checkout preview', async () => {
    const stripe = mockStripeForCode(
      'STAY25',
      baseCoupon({
        id: 'coupon_stay25',
        name: 'Stay 25',
        percent_off: 25,
        duration: 'repeating',
        duration_in_months: 3
      })
    );
    const result = await validatePromotionCodeForPlan(stripe, 'stay25', 'pro');
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.code, 'STAY25');
      assert.equal(result.discountedPriceCents, 675);
      assert.match(result.durationLabel, /25%/);
    }
  });

  it('accepts EVERITTTEAM for Business checkout preview', async () => {
    const stripe = mockStripeForCode(
      'EVERITTTEAM',
      baseCoupon({ id: 'coupon_team', name: 'Everitt Team', percent_off: 15, duration: 'forever' })
    );
    const result = await validatePromotionCodeForPlan(stripe, 'everittteam', 'business');
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.code, 'EVERITTTEAM');
      assert.equal(result.discountedPriceCents, 3315);
    }
  });

  for (const code of STRIPE_PROMO_CODES) {
    it(`normalizes ${code} input case-insensitively`, async () => {
      const stripe = mockStripeForCode(code, baseCoupon({ percent_off: 10, name: code }));
      const result = await validatePromotionCodeForPlan(stripe, code.toLowerCase(), 'pro');
      assert.equal(result.valid, true);
      if (result.valid) {
        assert.equal(result.code, code);
      }
    });
  }
});

describe('calculateDiscountedPrice', () => {
  it('applies percent discounts', () => {
    const { discountedPriceCents, discountAmountCents } = calculateDiscountedPrice(3900, {
      percent_off: 25,
      amount_off: null,
      currency: 'usd'
    });
    assert.equal(discountAmountCents, 975);
    assert.equal(discountedPriceCents, 2925);
  });

  it('applies fixed amount discounts without going below zero', () => {
    const { discountedPriceCents } = calculateDiscountedPrice(900, {
      percent_off: null,
      amount_off: 1000,
      currency: 'usd'
    });
    assert.equal(discountedPriceCents, 0);
  });
});

describe('planCardAction', () => {
  it('offers Pro checkout from Free when Stripe prices are configured', () => {
    const original = process.env.STRIPE_PRICE_PRO;
    process.env.STRIPE_PRICE_PRO = 'price_pro_test';

    const action = planCardAction('free', 'pro');
    assert.equal(action.type, 'checkout');
    if (action.type === 'checkout') {
      assert.equal(action.plan, 'pro');
      assert.match(action.label, /Pro/i);
    }

    process.env.STRIPE_PRICE_PRO = original;
  });

  it('offers Business checkout from Free when Stripe prices are configured', () => {
    const original = process.env.STRIPE_PRICE_BUSINESS;
    process.env.STRIPE_PRICE_BUSINESS = 'price_business_test';

    const action = planCardAction('free', 'business');
    assert.equal(action.type, 'checkout');
    if (action.type === 'checkout') {
      assert.equal(action.plan, 'business');
    }

    process.env.STRIPE_PRICE_BUSINESS = original;
  });
});
