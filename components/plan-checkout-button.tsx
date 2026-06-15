'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import type { EverittosPlan } from '@/lib/everittos-plans';
import type { PromoDiscountPreview } from '@/lib/stripe-promo';

type PlanCheckoutButtonProps = {
  plan: EverittosPlan;
  label: string;
  promoCode?: string;
  promoPreview?: PromoDiscountPreview | null;
  requireValidPromo?: boolean;
  className?: string;
};

export function PlanCheckoutButton({
  plan,
  label,
  promoCode = '',
  promoPreview = null,
  requireValidPromo = false,
  className = 'btn btn-primary'
}: PlanCheckoutButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout() {
    if (requireValidPromo && promoCode.trim() && !promoPreview) {
      setError(t('billing.promo.applyFirst'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          promoCode: promoCode.trim() || undefined
        })
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.code === 'already_subscribed') {
          window.location.href = json.redirect || '/settings/billing';
          return;
        }
        setError(json.error || json.message || t('billing.promo.checkoutFailed'));
        return;
      }

      if (json.url) {
        window.location.href = json.url;
        return;
      }

      setError(t('billing.promo.checkoutFailed'));
    } catch {
      setError(t('billing.promo.checkoutFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="plan-checkout-button">
      <button type="button" className={className} disabled={loading} onClick={() => void startCheckout()}>
        {loading ? t('billing.promo.startingCheckout') : label}
      </button>
      {error ? (
        <p className="auth-message auth-message-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
