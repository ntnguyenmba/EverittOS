/**
 * Client helpers for native purchase → backend verification → entitlement refresh.
 */
import { EverittBilling, isStoreBillingAvailable, type StoreProductInfo } from '@/lib/plugins/everitt-billing';
import { getAppPlatform } from '@/lib/platform/detect';

export type NativePurchaseOutcome =
  | { ok: true; plan: string; status: string; expiresAt: string | null }
  | { ok: false; pending?: boolean; cancelled?: boolean; error: string };

function customerStoreError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error || '');
  const technical = /plugin|implemented on ios|implemented on android|bridge|productId|purchaseToken|signed transaction|unsupported platform|native app/i.test(message);
  return technical ? fallback : message || fallback;
}

function notifyWorkspacePlanRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('everittos:workspace-plan-refresh'));
}

export async function loadNativeStoreProducts(productIds: string[]): Promise<StoreProductInfo[]> {
  if (!isStoreBillingAvailable()) return [];
  try {
    const result = await EverittBilling.loadProducts({ productIds });
    return result.products || [];
  } catch {
    return [];
  }
}

export async function purchaseNativePlan(productId: string): Promise<NativePurchaseOutcome> {
  if (!isStoreBillingAvailable()) {
    return { ok: false, error: 'Purchases are available in the mobile app.' };
  }

  try {
    const purchase = await EverittBilling.purchase({ productId });
    if (purchase.cancelled) {
      return { ok: false, cancelled: true, error: 'Purchase cancelled.' };
    }
    if (purchase.pending) {
      return {
        ok: false,
        pending: true,
        error: 'Your purchase is pending. Access will activate after the store confirms payment.'
      };
    }

    const platform = getAppPlatform();
    if (platform === 'ios') {
      if (!purchase.signedTransaction) {
        return { ok: false, error: 'We could not confirm this purchase. Please try again.' };
      }
      const res = await fetch('/api/billing/apple/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          signedTransaction: purchase.signedTransaction,
          productId: purchase.productId || productId
        })
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        plan?: string;
        status?: string;
        expiresAt?: string | null;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        return { ok: false, error: 'We could not confirm this purchase. Please try again.' };
      }
      notifyWorkspacePlanRefresh();
      return {
        ok: true,
        plan: json.plan || 'free',
        status: json.status || 'active',
        expiresAt: json.expiresAt ?? null
      };
    }

    if (platform === 'android') {
      if (!purchase.purchaseToken) {
        return { ok: false, error: 'We could not confirm this purchase. Please try again.' };
      }
      const res = await fetch('/api/billing/google/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          purchaseToken: purchase.purchaseToken,
          productId: purchase.productId || productId
        })
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pending?: boolean;
        plan?: string;
        status?: string;
        expiresAt?: string | null;
        error?: string;
        message?: string;
      };
      if (json.pending) {
        return { ok: false, pending: true, error: 'Your purchase is pending. Access will activate after Google Play confirms payment.' };
      }
      if (!res.ok || !json.ok) {
        return { ok: false, error: 'We could not confirm this purchase. Please try again.' };
      }
      notifyWorkspacePlanRefresh();
      return {
        ok: true,
        plan: json.plan || 'free',
        status: json.status || 'active',
        expiresAt: json.expiresAt ?? null
      };
    }

    return { ok: false, error: 'Purchases are unavailable right now. Please try again.' };
  } catch (error) {
    return { ok: false, error: customerStoreError(error, 'Purchases are unavailable right now. Please try again.') };
  }
}

export async function restoreNativePurchases(): Promise<{
  restored: boolean;
  message: string;
  plan?: string;
}> {
  if (!isStoreBillingAvailable()) {
    return { restored: false, message: 'Restore purchases is available in the mobile app.' };
  }

  try {
    const { purchases } = await EverittBilling.restorePurchases();
    if (!purchases?.length) {
      return { restored: false, message: 'No active purchases found.' };
    }

    const platform = getAppPlatform();
    let lastPlan: string | undefined;

    for (const purchase of purchases) {
      if (platform === 'ios' && purchase.signedTransaction) {
        const res = await fetch('/api/billing/apple/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            signedTransaction: purchase.signedTransaction,
            productId: purchase.productId
          })
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; plan?: string; pending?: boolean };
        if (json.pending) {
          return { restored: false, message: 'Purchase still pending.' };
        }
        if (res.ok && json.ok) lastPlan = json.plan;
      }
      if (platform === 'android' && purchase.purchaseToken && purchase.productId) {
        const res = await fetch('/api/billing/google/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            purchaseToken: purchase.purchaseToken,
            productId: purchase.productId
          })
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; plan?: string; pending?: boolean };
        if (json.pending) {
          return { restored: false, message: 'Purchase still pending.' };
        }
        if (res.ok && json.ok) lastPlan = json.plan;
      }
    }

    if (!lastPlan) {
      return { restored: false, message: 'We could not restore purchases. Please try again.' };
    }
    notifyWorkspacePlanRefresh();
    return { restored: true, message: 'Purchases restored', plan: lastPlan };
  } catch (error) {
    return { restored: false, message: customerStoreError(error, 'We could not restore purchases. Please try again.') };
  }
}

export async function openNativeSubscriptionManagement(): Promise<boolean> {
  if (!isStoreBillingAvailable()) return false;
  try {
    const result = await EverittBilling.manageSubscriptions();
    return Boolean(result.opened);
  } catch {
    return false;
  }
}
