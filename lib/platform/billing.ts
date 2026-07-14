import { getAppPlatform, isNativePlatform } from '@/lib/platform/detect';

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
  /** Explain that billing is managed on the web. */
  showWebBillingNotice: boolean;
};

/**
 * Native store policy: hide Stripe purchase initiation until legal approves a release model.
 * Existing paid subscribers can sign in and use authorized features.
 */
export function resolveBillingVisibility(): BillingVisibility {
  const native = isNativePlatform();
  const platform = getAppPlatform();

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
    showWebBillingNotice: true,
    ...(platform === 'ios' || platform === 'android' ? {} : {})
  };
}

export function nativeBillingNotice(): string {
  return 'Subscription changes are managed at app.everittventures.com. Sign in with your existing account to use your current plan in the mobile app.';
}
