/** Stripe Checkout discount params — discounts and allow_promotion_codes are mutually exclusive. */
export function checkoutPromotionParams(promotionCodeId?: string): {
  discounts?: { promotion_code: string }[];
  allow_promotion_codes?: boolean;
} {
  if (promotionCodeId) {
    return { discounts: [{ promotion_code: promotionCodeId }] };
  }
  return { allow_promotion_codes: true };
}
