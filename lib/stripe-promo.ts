import type Stripe from 'stripe';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { formatMoneyFromCents, isPaidCheckoutPlan, PLAN_AMOUNT_CENTS } from '@/lib/stripe-prices';

export type PromoValidationErrorCode =
  | 'invalid'
  | 'expired'
  | 'max_redemptions'
  | 'inactive'
  | 'not_applicable';

export type PromoDiscountPreview = {
  valid: true;
  code: string;
  promotionCodeId: string;
  couponId: string;
  couponName: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: string;
  duration: Stripe.Coupon.Duration;
  durationInMonths: number | null;
  durationLabel: string;
  expiresAt: string | null;
  originalPriceCents: number;
  discountedPriceCents: number;
  discountAmountCents: number;
  originalPriceLabel: string;
  discountedPriceLabel: string;
  discountAmountLabel: string;
};

export type PromoValidationResult =
  | PromoDiscountPreview
  | { valid: false; code: string; error: string; errorCode: PromoValidationErrorCode };

export type StoredCouponDiscount = {
  stripe_promotion_code: string | null;
  stripe_coupon_id: string | null;
  coupon_name: string | null;
  coupon_percent_off: number | null;
  coupon_amount_off: number | null;
  coupon_duration: string | null;
  coupon_duration_in_months: number | null;
  coupon_expires_at: string | null;
};

/** Production Stripe promotion codes (customer-facing). */
export const EVERITTOS_PROMOTION_CODES = ['VIP', 'FOUNDING', 'STAY25', 'EVERITTTEAM'] as const;

function normalizePromoCodeInput(code: string): string {
  return code.trim().toUpperCase();
}

export function formatCouponDuration(
  duration: Stripe.Coupon.Duration,
  durationInMonths: number | null,
  percentOff: number | null,
  amountOff: number | null
): string {
  const discount =
    percentOff != null ? `${percentOff}% off` : amountOff != null ? `${formatMoneyFromCents(amountOff)} off` : 'Discount';

  if (duration === 'forever') return `${discount} forever`;
  if (duration === 'once') return `${discount} once`;
  if (duration === 'repeating' && durationInMonths) {
    return `${discount} for ${durationInMonths} month${durationInMonths === 1 ? '' : 's'}`;
  }
  return discount;
}

export function calculateDiscountedPrice(
  originalCents: number,
  coupon: Pick<Stripe.Coupon, 'percent_off' | 'amount_off' | 'currency'>
): { discountedPriceCents: number; discountAmountCents: number } {
  if (coupon.percent_off != null) {
    const discountAmountCents = Math.round((originalCents * coupon.percent_off) / 100);
    return {
      discountedPriceCents: Math.max(0, originalCents - discountAmountCents),
      discountAmountCents
    };
  }

  if (coupon.amount_off != null) {
    const discountAmountCents = Math.min(originalCents, coupon.amount_off);
    return {
      discountedPriceCents: Math.max(0, originalCents - discountAmountCents),
      discountAmountCents
    };
  }

  return { discountedPriceCents: originalCents, discountAmountCents: 0 };
}

function promoError(code: string, error: string, errorCode: PromoValidationErrorCode): PromoValidationResult {
  return { valid: false, code, error, errorCode };
}

export async function validatePromotionCodeForPlan(
  stripe: Stripe,
  rawCode: string,
  plan: EverittosPlan
): Promise<PromoValidationResult> {
  const code = normalizePromoCodeInput(rawCode);
  if (!code) {
    return promoError('', 'Enter a promo code.', 'invalid');
  }

  if (!isPaidCheckoutPlan(plan)) {
    return promoError(code, 'Select a paid plan before applying a promo code.', 'not_applicable');
  }

  const listed = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 1,
    expand: ['data.coupon']
  });

  const promotion = listed.data[0];
  if (!promotion) {
    return promoError(code, 'This promo code is not valid.', 'invalid');
  }

  if (!promotion.active) {
    return promoError(code, 'This promo code is no longer active.', 'inactive');
  }

  const now = Math.floor(Date.now() / 1000);
  if (promotion.expires_at && promotion.expires_at <= now) {
    return promoError(code, 'This promo code has expired.', 'expired');
  }

  if (
    promotion.max_redemptions != null &&
    promotion.times_redeemed != null &&
    promotion.times_redeemed >= promotion.max_redemptions
  ) {
    return promoError(code, 'This promo code has reached its redemption limit.', 'max_redemptions');
  }

  const coupon =
    typeof promotion.coupon === 'string'
      ? await stripe.coupons.retrieve(promotion.coupon)
      : promotion.coupon;

  if (!coupon.valid) {
    return promoError(code, 'The coupon behind this promo code is no longer valid.', 'inactive');
  }

  if (coupon.redeem_by && coupon.redeem_by <= now) {
    return promoError(code, 'This promo code has expired.', 'expired');
  }

  const originalPriceCents = PLAN_AMOUNT_CENTS[plan];
  const { discountedPriceCents, discountAmountCents } = calculateDiscountedPrice(originalPriceCents, coupon);
  const currency = coupon.currency || 'usd';

  return {
    valid: true,
    code,
    promotionCodeId: promotion.id,
    couponId: coupon.id,
    couponName: coupon.name || code,
    percentOff: coupon.percent_off ?? null,
    amountOff: coupon.amount_off ?? null,
    currency,
    duration: coupon.duration,
    durationInMonths: coupon.duration_in_months ?? null,
    durationLabel: formatCouponDuration(coupon.duration, coupon.duration_in_months ?? null, coupon.percent_off, coupon.amount_off),
    expiresAt: promotion.expires_at ? new Date(promotion.expires_at * 1000).toISOString() : null,
    originalPriceCents,
    discountedPriceCents,
    discountAmountCents,
    originalPriceLabel: formatMoneyFromCents(originalPriceCents, currency),
    discountedPriceLabel: formatMoneyFromCents(discountedPriceCents, currency),
    discountAmountLabel: formatMoneyFromCents(discountAmountCents, currency)
  };
}

export function discountFieldsFromStripe(
  promotionCode: string | null,
  coupon: Stripe.Coupon | null,
  expiresAt: number | null
): StoredCouponDiscount {
  return {
    stripe_promotion_code: promotionCode,
    stripe_coupon_id: coupon?.id ?? null,
    coupon_name: coupon?.name ?? promotionCode,
    coupon_percent_off: coupon?.percent_off ?? null,
    coupon_amount_off: coupon?.amount_off ?? null,
    coupon_duration: coupon?.duration ?? null,
    coupon_duration_in_months: coupon?.duration_in_months ?? null,
    coupon_expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : null
  };
}

export async function extractSubscriptionDiscount(
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<StoredCouponDiscount> {
  const discount = subscription.discount;
  if (!discount) {
    return {
      stripe_promotion_code: null,
      stripe_coupon_id: null,
      coupon_name: null,
      coupon_percent_off: null,
      coupon_amount_off: null,
      coupon_duration: null,
      coupon_duration_in_months: null,
      coupon_expires_at: null
    };
  }

  const coupon =
    typeof discount.coupon === 'string' ? await stripe.coupons.retrieve(discount.coupon) : discount.coupon;

  let promotionCode: string | null = null;
  let expiresAt: number | null = null;

  if (discount.promotion_code) {
    const promo =
      typeof discount.promotion_code === 'string'
        ? await stripe.promotionCodes.retrieve(discount.promotion_code)
        : discount.promotion_code;
    promotionCode = promo.code;
    expiresAt = promo.expires_at ?? null;
  }

  return discountFieldsFromStripe(promotionCode, coupon, expiresAt);
}
