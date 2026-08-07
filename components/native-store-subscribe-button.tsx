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
import { useTranslation } from '@/components/locale-provider';
import { formatSettingsBillingCopy, getNativeStoreSubscribeCopy } from '@/lib/i18n/settings-copy';

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
  const { locale } = useTranslation();
  const c = getNativeStoreSubscribeCopy(locale);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [storePrice, setStorePrice] = useState<string | null>(null);
  const productId = productIdForPlan(plan);
  const platform = getAppPlatform();
  const storeLabel = platform === 'ios' ? c.subscribeApple : c.subscribeGoogle;

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
        {formatSettingsBillingCopy(c.availableForPlans, { store: storeLabel })}
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
    setMessage(c.activated);
    onSuccess?.(outcome);
  }

  const cta =
    platform === 'ios' ? c.subscribeApple : platform === 'android' ? c.subscribeGoogle : label;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {storePrice ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {formatSettingsBillingCopy(c.storePrice, { price: storePrice })}
        </p>
      ) : null}
      <button type="button" className={className} disabled={disabled || busy} onClick={() => void onClick()}>
        {busy ? c.processing : cta}
      </button>
      {message ? <p className="muted" style={{ margin: 0, fontSize: 12 }}>{message}</p> : null}
      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
        {platform === 'ios' ? c.chargedToApple : c.chargedToGoogle}{' '}
        {platform === 'ios' ? c.manageApple : c.manageGoogle}{' '}
        <a href="/terms">{c.terms}</a> · <a href="/privacy">{c.privacy}</a>
      </p>
    </div>
  );
}
