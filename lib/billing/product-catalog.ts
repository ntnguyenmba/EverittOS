/**
 * Store product catalog mapping App Store and Google Play product IDs to EverittOS plans.
 */
import { MOBILE_APP_CONFIG } from '@/lib/mobile-app-config';
import { sanitizeBillingEnvValue } from '@/lib/billing-env';

export type BillingPlatform = 'stripe' | 'apple' | 'google';

/** Plans available via App Store / Play Store digital subscriptions. */
export type StoreEverittPlan = 'pro' | 'business' | 'starter' | 'growth' | 'enterprise';

export type EverittPlan = 'free' | StoreEverittPlan;

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

const IOS_PRO = 'com.everittventures.everittos.pro.monthly.v3';
const IOS_BUSINESS = 'com.everittventures.everittos.business.monthly.v2';
const IOS_STARTER = 'com.everittventures.everittos.starter.monthly.v4';
const IOS_GROWTH = 'com.everittventures.everittos.growth.monthly.v2';
const IOS_ENTERPRISE = 'com.everittventures.everittos.enterprise.monthly.v2';

const DEFAULT_ANDROID_PRO = 'everittos_pro';
const DEFAULT_ANDROID_BUSINESS = 'everittos_business';
const DEFAULT_ANDROID_BASE_PLAN = 'monthly';

export function getIosProMonthlyProductId(): string {
  return IOS_PRO;
}

export function getIosBusinessMonthlyProductId(): string {
  return IOS_BUSINESS;
}

export function getIosStarterMonthlyProductId(): string {
  return IOS_STARTER;
}

export function getIosGrowthMonthlyProductId(): string {
  return IOS_GROWTH;
}

export function getIosEnterpriseMonthlyProductId(): string {
  return IOS_ENTERPRISE;
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
    { platform: 'apple', productId: getIosProMonthlyProductId(), plan: 'pro', billingPeriod: 'monthly' },
    { platform: 'apple', productId: getIosBusinessMonthlyProductId(), plan: 'business', billingPeriod: 'monthly' },
    { platform: 'apple', productId: getIosStarterMonthlyProductId(), plan: 'starter', billingPeriod: 'monthly' },
    { platform: 'apple', productId: getIosGrowthMonthlyProductId(), plan: 'growth', billingPeriod: 'monthly' },
    { platform: 'apple', productId: getIosEnterpriseMonthlyProductId(), plan: 'enterprise', billingPeriod: 'monthly' },
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
  return sanitizeBillingEnvValue(process.env.GOOGLE_PLAY_PACKAGE_NAME) || MOBILE_APP_CONFIG.androidPackage;
}

/** Public product IDs safe to send to native clients for StoreKit / Play queries. */
export function publicStoreProductIds(platform: 'ios' | 'android'): string[] {
  if (platform === 'ios') {
    return [
      getIosProMonthlyProductId(),
      getIosBusinessMonthlyProductId(),
      getIosStarterMonthlyProductId(),
      getIosGrowthMonthlyProductId(),
      getIosEnterpriseMonthlyProductId()
    ];
  }
  return [getAndroidProSubscriptionId(), getAndroidBusinessSubscriptionId()];
}
