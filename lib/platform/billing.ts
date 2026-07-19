import { getAppPlatform, isNativePlatform } from '@/lib/platform/detect';

export type BillingSurface = 'web' | 'native';

export type BillingVisibility = {
  surface: BillingSurface;
  platform: 'web' | 'ios' | 'android';
  /** Stripe Checkout may be started from this surface. */
  allowCheckout: boolean;
  /** Stripe Customer Portal may be opened from this surface. */
  allowPortal: boolean;
  /** Native store purchase sheet (StoreKit / Play Billing). */
  allowNativeStorePurchase: boolean;
  /** Show plan prices on upgrade cards (store-localized on native). */
  showUpgradePrices: boolean;
  /** Show upgrade / checkout call-to-action buttons. */
  showUpgradeActions: boolean;
  /** Neutral plan summary is permitted on native. */
  showPlanSummary: boolean;
  /** Explain web-only Stripe management when entitlement source is Stripe. */
  showWebBillingNotice: boolean;
  /** Show Restore Purchases (iOS primarily; Android query purchases). */
  showRestorePurchases: boolean;
  /** Show manage-subscription control for the active store. */
  showManageStoreSubscription: boolean;
};

/**
 * Platform-aware billing visibility.
 * Web: Stripe Checkout + Customer Portal.
 * iOS: StoreKit 2 only (no Stripe checkout).
 * Android: Google Play Billing only (no Stripe checkout WebView).
 */
export function resolveBillingVisibility(): BillingVisibility {
  const platform = getAppPlatform();
  const native = isNativePlatform();

  if (!native || platform === 'web') {
    return {
      surface: 'web',
      platform: 'web',
      allowCheckout: true,
      allowPortal: true,
      allowNativeStorePurchase: false,
      showUpgradePrices: true,
      showUpgradeActions: true,
      showPlanSummary: true,
      showWebBillingNotice: false,
      showRestorePurchases: false,
      showManageStoreSubscription: false
    };
  }

  if (platform === 'ios') {
    return {
      surface: 'native',
      platform: 'ios',
      allowCheckout: false,
      allowPortal: false,
      allowNativeStorePurchase: true,
      showUpgradePrices: true,
      showUpgradeActions: true,
      showPlanSummary: true,
      showWebBillingNotice: false,
      showRestorePurchases: true,
      showManageStoreSubscription: true
    };
  }

  // android
  return {
    surface: 'native',
    platform: 'android',
    allowCheckout: false,
    allowPortal: false,
    allowNativeStorePurchase: true,
    showUpgradePrices: true,
    showUpgradeActions: true,
    showPlanSummary: true,
    showWebBillingNotice: false,
    showRestorePurchases: true,
    showManageStoreSubscription: true
  };
}

export function nativeBillingNotice(): string {
  const platform = getAppPlatform();
  if (platform === 'ios') {
    return 'Subscriptions are purchased through Apple. Prices shown are provided by the App Store.';
  }
  if (platform === 'android') {
    return 'Subscriptions are purchased through Google Play. Prices shown are provided by Google Play.';
  }
  return 'Subscription changes are managed on the web for Stripe-billed accounts.';
}

export function manageSubscriptionLabel(source: string | null | undefined): string {
  const s = String(source || '').toLowerCase();
  if (s === 'apple') return 'Manage Apple Subscription';
  if (s === 'google') return 'Manage Google Play Subscription';
  if (s === 'stripe') return 'Manage Stripe Billing';
  return 'Manage Subscription';
}
