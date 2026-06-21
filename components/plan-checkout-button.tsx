'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';

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
  ownerDiagnostic?: string;
  priceEnvKey?: string | null;
  priceIdPreview?: string | null;
  stripeCode?: string | null;
};

type CheckoutFailureDebug = {
  code: string;
  priceEnvKey: string;
  priceIdPreview: string;
  stripeCode: string;
  ownerDiagnostic: string;
};

function checkoutFailureDebug(json: CheckoutResponseJson): CheckoutFailureDebug {
  return {
    code: json.code || 'unknown',
    priceEnvKey: json.priceEnvKey || '—',
    priceIdPreview: json.priceIdPreview || '—',
    stripeCode: json.stripeCode || '—',
    ownerDiagnostic: json.ownerDiagnostic || '—'
  };
}

function formatCheckoutDebugLine(debug: CheckoutFailureDebug): string {
  return [
    `code: ${debug.code}`,
    `priceEnvKey: ${debug.priceEnvKey}`,
    `priceIdPreview: ${debug.priceIdPreview}`,
    `stripeCode: ${debug.stripeCode}`,
    `ownerDiagnostic: ${debug.ownerDiagnostic}`
  ].join(' · ');
}

function parseCheckoutJson(rawText: string): CheckoutResponseJson {
  if (!rawText.trim()) return {};

  try {
    return JSON.parse(rawText) as CheckoutResponseJson;
  } catch {
    return {
      error: 'Checkout returned a response the browser could not read.',
      code: 'invalid_checkout_response',
      ownerDiagnostic: 'Checkout returned a response that was not valid JSON. Check the Vercel function logs for /api/stripe/checkout.'
    };
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

export function PlanCheckoutButton({
  plan,
  label,
  requireRefundAck = true,
  className = 'btn btn-primary',
  disabled = false
}: PlanCheckoutButtonProps) {
  const { t } = useTranslation();
  const workspacePlan = useWorkspacePlanOptional();
  const canShowOwnerDiagnostics = canManageBilling(normalizeRole(workspacePlan?.role || 'employee'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugLine, setDebugLine] = useState('');
  const [acceptedRefundPolicy, setAcceptedRefundPolicy] = useState(false);

  const checkoutBlocked = requireRefundAck && !acceptedRefundPolicy;

  function handleCheckoutFailure(status: number, json: CheckoutResponseJson) {
    console.error('Stripe checkout failed', { status, plan, response: json });

    const debug = checkoutFailureDebug(json);
    if (canShowOwnerDiagnostics) {
      setDebugLine(formatCheckoutDebugLine(debug));
      setError(json.ownerDiagnostic || json.error || t('billing.promo.checkoutFailed'));
      return;
    }

    setDebugLine('');
    setError(json.error || t('billing.promo.checkoutFailed'));
  }

  async function startCheckout() {
    if (checkoutBlocked) {
      setError(t('billing.noRefund.ackRequired'));
      setDebugLine('');
      return;
    }

    setLoading(true);
    setError('');
    setDebugLine('');

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
        if (json.code === 'already_subscribed') {
          setError(json.error || t('billing.alreadySubscribedPortal'));
          setDebugLine('');
          window.location.assign('/settings/billing');
          return;
        }

        handleCheckoutFailure(res.status, json);
        return;
      }

      const redirectUrl = validStripeCheckoutRedirect(json.url);
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      handleCheckoutFailure(res.status, {
        error: 'Stripe checkout did not return a valid Stripe redirect URL.',
        code: 'invalid_checkout_redirect',
        ownerDiagnostic: `Stripe checkout response did not include a valid checkout.stripe.com URL. Received: ${json.url || 'empty'}`
      });
    } catch (caught) {
      console.error('Stripe checkout request failed', { plan, error: caught });
      handleCheckoutFailure(0, {
        error: caught instanceof Error ? caught.message : t('billing.promo.checkoutFailed'),
        code: 'checkout_request_failed',
        ownerDiagnostic:
          caught instanceof Error
            ? `Browser failed before completing checkout request or redirect: ${caught.message}`
            : 'Browser failed before completing checkout request or redirect.'
      });
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
      {debugLine ? (
        <p className="plan-checkout-debug muted" role="status">
          {debugLine}
        </p>
      ) : null}
    </div>
  );
}
