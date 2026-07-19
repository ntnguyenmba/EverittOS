/**
 * Server-side product catalog mapping store product IDs to EverittOS plans.
 * Product IDs come from environment variables; defaults match the app bundle/package.
 */
import { MOBILE_APP_CONFIG } from '@/lib/mobile-app-config';
import { sanitizeBillingEnvValue } from '@/lib/billing-env';

export type BillingPlatform = 'stripe' | 'apple' | 'google';

/** Plans available via App Store / Play Store digital subscriptions. */
export type StoreEverittPlan = 'pro' | 'business';

export type EverittPlan = 'free' | 'pro' | 'business' | 'starter' | 'growth' | 'enterprise';

export type BillingPeriod = 'monthly' | 'annual';

export interface BillingProductDefinition {
  platform: BillingPlatform;
  productId: string;
  plan: StoreEverittPlan;
  billingPeriod: BillingPeriod;
  /** Google Play base plan id when platform is google. */
  basePlanId?: string;
}

function envOr(key: string, fallback: string): string {
  return sanitizeBillingEnvValue(process.env[key]) || fallback;
}

const DEFAULT_IOS_PRO = `${MOBILE_APP_CONFIG.iosBundleId}.pro.monthly`;
const DEFAULT_IOS_BUSINESS = `${MOBILE_APP_CONFIG.iosBundleId}.business.monthly`;
const DEFAULT_ANDROID_PRO = 'everittos_pro';
const DEFAULT_ANDROID_BUSINESS = 'everittos_business';
const DEFAULT_ANDROID_BASE_PLAN = 'monthly';

export function getIosProMonthlyProductId(): string {
  return envOr('NEXT_PUBLIC_IOS_PRO_MONTHLY_PRODUCT_ID', DEFAULT_IOS_PRO);
}

export function getIosBusinessMonthlyProductId(): string {
  return envOr('NEXT_PUBLIC_IOS_BUSINESS_MONTHLY_PRODUCT_ID', DEFAULT_IOS_BUSINESS);
}

export function getAndroidProSubscriptionId(): string {
  return envOr('NEXT_PUBLIC_ANDROID_PRO_SUBSCRIPTION_ID', DEFAULT_ANDROID_PRO);
}

export function getAndroidBusinessSubscriptionId(): string {
  return envOr('NEXT_PUBLIC_ANDROID_BUSINESS_SUBSCRIPTION_ID', DEFAULT_ANDROID_BUSINESS);
}

export function getAndroidMonthlyBasePlanId(): string {
  return envOr('NEXT_PUBLIC_ANDROID_MONTHLY_BASE_PLAN_ID', DEFAULT_ANDROID_BASE_PLAN);
}

export function getStoreProductCatalog(): BillingProductDefinition[] {
  return [
    {
      platform: 'apple',
      productId: getIosProMonthlyProductId(),
      plan: 'pro',
      billingPeriod: 'monthly'
    },
    {
      platform: 'apple',
      productId: getIosBusinessMonthlyProductId(),
      plan: 'business',
      billingPeriod: 'monthly'
    },
    {
      platform: 'google',
      productId: getAndroidProSubscriptionId(),
      plan: 'pro',
      billingPeriod: 'monthly',
      basePlanId: getAndroidMonthlyBasePlanId()
    },
    {
      platform: 'google',
      productId: getAndroidBusinessSubscriptionId(),
      plan: 'business',
      billingPeriod: 'monthly',
      basePlanId: getAndroidMonthlyBasePlanId()
    }
  ];
}

/** Resolve EverittOS plan from a verified Apple product ID. */
export function planFromAppleProductId(productId: string): StoreEverittPlan | null {
  const id = productId.trim();
  if (!id) return null;
  const match = getStoreProductCatalog().find((p) => p.platform === 'apple' && p.productId === id);
  return match?.plan ?? null;
}

/** Resolve EverittOS plan from a verified Google Play subscription product ID. */
export function planFromGoogleProductId(productId: string): StoreEverittPlan | null {
  const id = productId.trim();
  if (!id) return null;
  const match = getStoreProductCatalog().find((p) => p.platform === 'google' && p.productId === id);
  return match?.plan ?? null;
}

export function isKnownStoreProduct(platform: 'apple' | 'google', productId: string): boolean {
  if (platform === 'apple') return planFromAppleProductId(productId) !== null;
  return planFromGoogleProductId(productId) !== null;
}

export function appleBundleId(): string {
  return sanitizeBillingEnvValue(process.env.APPLE_BUNDLE_ID) || MOBILE_APP_CONFIG.iosBundleId;
}

export function googlePlayPackageName(): string {
  return (
    sanitizeBillingEnvValue(process.env.GOOGLE_PLAY_PACKAGE_NAME) || MOBILE_APP_CONFIG.androidPackage
  );
}

/** Public product IDs safe to send to native clients for StoreKit / Play queries. */
export function publicStoreProductIds(platform: 'ios' | 'android'): string[] {
  if (platform === 'ios') {
    return [getIosProMonthlyProductId(), getIosBusinessMonthlyProductId()];
  }
  return [getAndroidProSubscriptionId(), getAndroidBusinessSubscriptionId()];
}
