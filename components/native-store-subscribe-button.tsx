'use client';

import { useEffect, useState } from 'react';
import {
  loadNativeStoreProducts,
  purchaseNativePlan,
  type NativePurchaseOutcome
} from '@/lib/billing/native-purchase';
import {
  getAndroidBusinessSubscriptionId,
  getAndroidProSubscriptionId,
  getIosBusinessMonthlyProductId,
  getIosProMonthlyProductId
} from '@/lib/billing/product-catalog';
import { getAppPlatform } from '@/lib/platform/detect';
import type { PaidPlanKey } from '@/lib/billing-config';

type NativeStoreSubscribeButtonProps = {
  plan: PaidPlanKey;
  label: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: (outcome: Extract<NativePurchaseOutcome, { ok: true }>) => void;
};

function productIdForPlan(plan: PaidPlanKey): string | null {
  const platform = getAppPlatform();
  if (plan !== 'pro' && plan !== 'business') return null;
  if (platform === 'ios') {
    return plan === 'pro' ? getIosProMonthlyProductId() : getIosBusinessMonthlyProductId();
  }
  if (platform === 'android') {
    return plan === 'pro' ? getAndroidProSubscriptionId() : getAndroidBusinessSubscriptionId();
  }
  return null;
}

export function NativeStoreSubscribeButton({
  plan,
  label,
  className = 'btn btn-primary btn-block',
  disabled = false,
  onSuccess
}: NativeStoreSubscribeButtonProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [storePrice, setStorePrice] = useState<string | null>(null);
  const productId = productIdForPlan(plan);
  const platform = getAppPlatform();

  useEffect(() => {
    let cancelled = false;
    async function loadPrice() {
      if (!productId) return;
      try {
        const products = await loadNativeStoreProducts([productId]);
        if (cancelled) return;
        setStorePrice(products[0]?.price || null);
      } catch {
        if (!cancelled) setStorePrice(null);
      }
    }
    void loadPrice();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!productId) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {platform === 'ios' ? 'Subscribe with Apple' : 'Subscribe with Google Play'} is available for Pro and Business.
      </p>
    );
  }

  async function onClick() {
    if (!productId || busy || disabled) return;
    setBusy(true);
    setMessage('');
    const outcome = await purchaseNativePlan(productId);
    setBusy(false);
    if (!outcome.ok) {
      setMessage(outcome.error);
      return;
    }
    setMessage('Subscription activated.');
    onSuccess?.(outcome);
  }

  const cta =
    platform === 'ios' ? 'Subscribe with Apple' : platform === 'android' ? 'Subscribe with Google Play' : label;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {storePrice ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          Store price: {storePrice} · auto-renews monthly until cancelled
        </p>
      ) : null}
      <button type="button" className={className} disabled={disabled || busy} onClick={() => void onClick()}>
        {busy ? 'Processing…' : cta}
      </button>
      {message ? <p className="muted" style={{ margin: 0, fontSize: 12 }}>{message}</p> : null}
      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
        Payment will be charged to your {platform === 'ios' ? 'Apple ID' : 'Google Play'} account. Manage or cancel in{' '}
        {platform === 'ios' ? 'Settings → Subscriptions' : 'Google Play → Subscriptions'}.{' '}
        <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
      </p>
    </div>
  );
}
