import { getAppPlatform, isNativePlatform } from '@/lib/platform/detect';
import { getNativeBillingCopy } from '@/lib/i18n/native-billing-copy';

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

export function nativeBillingNotice(locale?: string | null): string {
  const copy = getNativeBillingCopy(locale);
  const platform = getAppPlatform();
  if (platform === 'ios') return copy.appleNotice;
  if (platform === 'android') return copy.googleNotice;
  return copy.webNotice;
}

export function manageSubscriptionLabel(
  source: string | null | undefined,
  locale?: string | null
): string {
  const copy = getNativeBillingCopy(locale);
  const s = String(source || '').toLowerCase();
  if (s === 'apple') return copy.manageApple;
  if (s === 'google') return copy.manageGoogle;
  if (s === 'stripe') return copy.manageStripe;
  return copy.manageGeneric;
}
