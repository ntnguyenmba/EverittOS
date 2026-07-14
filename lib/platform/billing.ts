import { isNativePlatform } from '@/lib/platform/detect';

export type BillingSurface = 'web' | 'native';

export type BillingVisibility = {
  surface: BillingSurface;
  /** Stripe Checkout may be started from this surface. */
  allowCheckout: boolean;
  /** Stripe Customer Portal may be opened from this surface. */
  allowPortal: boolean;
  /** Show plan prices on upgrade cards. */
  showUpgradePrices: boolean;
  /** Show upgrade / checkout call-to-action buttons. */
  showUpgradeActions: boolean;
  /** Neutral plan summary is permitted on native. */
  showPlanSummary: boolean;
  /** Explain that billing changes are unavailable in the native app. */
  showWebBillingNotice: boolean;
};

/**
 * Native store policy: EverittOS native apps are existing-account access apps.
 * Subscription purchase, pricing, Stripe checkout/portal, and external purchase
 * direction are web-only. Existing paid subscribers retain their features.
 */
export function resolveBillingVisibility(): BillingVisibility {
  const native = isNativePlatform();

  if (!native) {
    return {
      surface: 'web',
      allowCheckout: true,
      allowPortal: true,
      showUpgradePrices: true,
      showUpgradeActions: true,
      showPlanSummary: true,
      showWebBillingNotice: false
    };
  }

  return {
    surface: 'native',
    allowCheckout: false,
    allowPortal: false,
    showUpgradePrices: false,
    showUpgradeActions: false,
    showPlanSummary: true,
    showWebBillingNotice: true
  };
}

export function nativeBillingNotice(): string {
  return 'Subscription changes are not available in this app. Sign in with your existing account to use your current plan.';
}
