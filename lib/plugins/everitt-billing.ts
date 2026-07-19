/**
 * Capacitor bridge for native StoreKit 2 / Google Play Billing.
 * Purchase unlock requires backend verification — never trust client success alone.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export type StoreProductInfo = {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros?: number;
  priceCurrencyCode?: string;
  billingPeriod?: string;
};

export type NativePurchaseResult = {
  productId: string;
  /** Apple StoreKit JWS; empty on Google. */
  signedTransaction?: string;
  transactionId?: string;
  originalTransactionId?: string;
  /** Google Play purchase token. */
  purchaseToken?: string;
  pending?: boolean;
  cancelled?: boolean;
};

export interface EverittBillingPlugin {
  loadProducts(options: { productIds: string[] }): Promise<{ products: StoreProductInfo[] }>;
  purchase(options: { productId: string }): Promise<NativePurchaseResult>;
  restorePurchases(): Promise<{ purchases: NativePurchaseResult[] }>;
  manageSubscriptions(): Promise<{ opened: boolean }>;
  getProductIds(): Promise<{ productIds: string[] }>;
}

const EverittBilling = registerPlugin<EverittBillingPlugin>('EverittBilling', {
  web: () => ({
    async loadProducts() {
      return { products: [] };
    },
    async purchase() {
      throw new Error('Store purchases are only available in the iOS or Android app.');
    },
    async restorePurchases() {
      return { purchases: [] };
    },
    async manageSubscriptions() {
      return { opened: false };
    },
    async getProductIds() {
      return { productIds: [] };
    }
  })
});

export function isStoreBillingAvailable(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
}

export { EverittBilling };
