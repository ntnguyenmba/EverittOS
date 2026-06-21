'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import type { EverittosPlan } from '@/lib/everittos-plans';

type PlanCheckoutButtonProps = {
  plan: EverittosPlan;
  label: string;
  requireRefundAck?: boolean;
  className?: string;
  disabled?: boolean;
};

type CheckoutResponseJson = {
  url?: string;
  error?: string;
  code?: string;
  redirect?: string;
};

function parseCheckoutJson(rawText: string): CheckoutResponseJson {
  if (!rawText.trim()) {
    return { error: 'Unable to start checkout. Please try again or contact support.' };
  }

  try {
    return JSON.parse(rawText) as CheckoutResponseJson;
  } catch {
    return { error: 'Unable to start checkout. Please try again or contact support.' };
  }
}

function validStripeCheckoutRedirect(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'checkout.stripe.com') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function publicCheckoutError(json: CheckoutResponseJson, fallback: string): string {
  if (json.code === 'already_subscribed') {
    return json.error || 'You already have an active subscription. Use Manage subscription to make changes.';
  }

  return json.error || fallback || 'Unable to start checkout. Please try again or contact support.';
}

export function PlanCheckoutButton({
  plan,
  label,
  requireRefundAck = true,
  className = 'btn btn-primary',
  disabled = false
}: PlanCheckoutButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedRefundPolicy, setAcceptedRefundPolicy] = useState(false);

  const checkoutBlocked = requireRefundAck && !acceptedRefundPolicy;

  async function startCheckout() {
    if (checkoutBlocked) {
      setError(t('billing.noRefund.ackRequired'));
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
          refundPolicyAcknowledged: requireRefundAck ? true : undefined
        })
      });
      const rawText = await res.text();
      const json = parseCheckoutJson(rawText);

      if (!res.ok) {
        console.error('Stripe checkout failed', { status: res.status, plan, response: json });
        if (json.code === 'already_subscribed') {
          setError(publicCheckoutError(json, t('billing.alreadySubscribedPortal')));
          window.location.assign('/settings/billing');
          return;
        }
        setError(publicCheckoutError(json, t('billing.promo.checkoutFailed')));
        return;
      }

      const redirectUrl = validStripeCheckoutRedirect(json.url);
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      console.error('Stripe checkout did not return a valid redirect URL', { plan, response: json });
      setError('Unable to start checkout. Please try again or contact support.');
    } catch (caught) {
      console.error('Stripe checkout request failed', { plan, error: caught });
      setError('Unable to start checkout. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="plan-checkout-button">
      {requireRefundAck ? (
        <label
          className="no-refund-checkout-ack no-refund-checkout-ack-inline"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '0 0 12px', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={acceptedRefundPolicy}
            onChange={(e) => setAcceptedRefundPolicy(e.target.checked)}
            style={{ flex: '0 0 auto', width: 18, height: 18, margin: '4px 0 0' }}
          />
          <span style={{ display: 'block', lineHeight: 1.45 }}>{t('billing.noRefund.checkoutAck')}</span>
        </label>
      ) : null}
      <button
        type="button"
        className={className}
        disabled={loading || checkoutBlocked || disabled}
        onClick={() => void startCheckout()}
      >
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
