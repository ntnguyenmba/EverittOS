import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Stripe from 'stripe';
import { planCardAction } from '@/lib/billing-plan-actions';
import { calculateDiscountedPrice, validatePromotionCodeForPlan } from '@/lib/stripe-promo';

function mockStripe(promotion: Partial<Stripe.PromotionCode> | null): Stripe {
  return {
    promotionCodes: {
      list: async () => ({
        data: promotion ? [promotion as Stripe.PromotionCode] : []
      }),
      retrieve: async () => promotion as Stripe.PromotionCode
    },
    coupons: {
      retrieve: async () => promotion?.coupon as Stripe.Coupon
    }
  } as unknown as Stripe;
}

describe('validatePromotionCodeForPlan', () => {
  it('rejects empty codes', async () => {
    const result = await validatePromotionCodeForPlan(mockStripe(null), '   ', 'pro');
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.errorCode, 'invalid');
    }
  });

  it('rejects unknown codes', async () => {
    const result = await validatePromotionCodeForPlan(mockStripe(null), 'NOTREAL', 'pro');
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.error, /not valid/i);
    }
  });

  it('accepts EVERITTVIP for Pro checkout preview', async () => {
    const coupon: Stripe.Coupon = {
      id: 'coupon_vip',
      object: 'coupon',
      amount_off: null,
      created: 0,
      currency: 'usd',
      duration: 'forever',
      duration_in_months: null,
      livemode: false,
      max_redemptions: null,
      metadata: {},
      name: 'Everitt VIP',
      percent_off: 20,
      redeem_by: null,
      times_redeemed: 0,
      valid: true
    };

    const promotion: Stripe.PromotionCode = {
      id: 'promo_vip',
      object: 'promotion_code',
      active: true,
      code: 'EVERITTVIP',
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

    const result = await validatePromotionCodeForPlan(mockStripe(promotion), 'everittvip', 'pro');
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.code, 'EVERITTVIP');
      assert.equal(result.promotionCodeId, 'promo_vip');
      assert.equal(result.discountedPriceCents, 720);
    }
  });

  it('accepts FOUNDING for Business checkout preview', async () => {
    const coupon: Stripe.Coupon = {
      id: 'coupon_founding',
      object: 'coupon',
      amount_off: 1000,
      created: 0,
      currency: 'usd',
      duration: 'once',
      duration_in_months: null,
      livemode: false,
      max_redemptions: null,
      metadata: {},
      name: 'Founding',
      percent_off: null,
      redeem_by: null,
      times_redeemed: 0,
      valid: true
    };

    const promotion: Stripe.PromotionCode = {
      id: 'promo_founding',
      object: 'promotion_code',
      active: true,
      code: 'FOUNDING',
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

    const result = await validatePromotionCodeForPlan(mockStripe(promotion), 'FOUNDING', 'business');
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.discountedPriceCents, 2900);
    }
  });
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
});

describe('planCardAction', () => {
  it('offers Pro upgrade from Free', () => {
    const action = planCardAction('free', 'pro');
    assert.equal(action.type, 'choose');
    if (action.type === 'choose') {
      assert.equal(action.plan, 'pro');
      assert.equal(action.label, 'Choose Pro');
    }
  });

  it('offers Business upgrade from Free', () => {
    const action = planCardAction('free', 'business');
    assert.equal(action.type, 'choose');
    if (action.type === 'choose') {
      assert.equal(action.plan, 'business');
    }
  });
});
