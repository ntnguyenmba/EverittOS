'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import type { EverittosPlan } from '@/lib/everittos-plans';
import type { PromoDiscountPreview } from '@/lib/stripe-promo';

type StripePromoCodeFieldProps = {
  plan: EverittosPlan;
  initialCode?: string;
  onValidated?: (preview: PromoDiscountPreview | null) => void;
  disabled?: boolean;
};

type ValidationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'valid'; preview: PromoDiscountPreview }
  | { status: 'error'; message: string };

export function StripePromoCodeField({ plan, initialCode = '', onValidated, disabled }: StripePromoCodeFieldProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<ValidationState>({ status: 'idle' });

  async function validatePromo(nextCode = code) {
    const trimmed = nextCode.trim();
    if (!trimmed) {
      setState({ status: 'idle' });
      onValidated?.(null);
      return;
    }

    setState({ status: 'loading' });
    const res = await fetch('/api/stripe/validate-promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed, plan })
    });
    const json = await res.json();

    if (!res.ok || !json.valid) {
      const message = json.error || t('billing.promo.invalid');
      setState({ status: 'error', message });
      onValidated?.(null);
      return;
    }

    setState({ status: 'valid', preview: json as PromoDiscountPreview });
    onValidated?.(json as PromoDiscountPreview);
  }

  useEffect(() => {
    if (!initialCode.trim()) return;
    setCode(initialCode);
    void validatePromo(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, plan]);

  const preview = state.status === 'valid' ? state.preview : null;

  return (
    <div className="promo-code-field">
      <label className="auth-field" htmlFor="promo-code">
        <span>{t('billing.promo.label')}</span>
        <div className="promo-code-input-row">
          <input
            id="promo-code"
            className="input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (state.status === 'error') setState({ status: 'idle' });
            }}
            placeholder={t('billing.promo.placeholder')}
            autoComplete="off"
            disabled={disabled || state.status === 'loading'}
          />
          <button
            type="button"
            className="btn"
            onClick={() => void validatePromo()}
            disabled={disabled || state.status === 'loading' || !code.trim()}
          >
            {state.status === 'loading' ? t('billing.promo.validating') : t('billing.promo.apply')}
          </button>
        </div>
      </label>

      {state.status === 'error' ? (
        <p className="auth-message auth-message-error" role="alert">
          {state.message}
        </p>
      ) : null}

      {preview ? (
        <div className="promo-code-preview card" aria-live="polite">
          <p className="promo-code-preview-title">{t('billing.promo.applied', { name: preview.couponName })}</p>
          <p className="muted">{preview.durationLabel}</p>
          <div className="promo-code-price-row">
            <span className="promo-code-price-original">{preview.originalPriceLabel}</span>
            <span className="promo-code-price-discounted">{preview.discountedPriceLabel}</span>
            <span className="promo-code-price-savings">
              {t('billing.promo.savings', { amount: preview.discountAmountLabel })}
            </span>
          </div>
          {preview.expiresAt ? (
            <p className="muted promo-code-expires">
              {t('billing.promo.expires', {
                date: new Date(preview.expiresAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
