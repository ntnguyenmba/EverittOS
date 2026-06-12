'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import type { EverittosPlan } from '@/lib/everittos-plans';
import type { PromoDiscountPreview } from '@/lib/stripe-promo';

type StripePromoCodeFieldProps = {
  plan: EverittosPlan;
  initialCode?: string;
  /** Called when validation completes. Pass null when code is cleared or invalid. */
  onValidated?: (preview: PromoDiscountPreview | null) => void;
  disabled?: boolean;
  fieldId?: string;
};

type ValidationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'valid'; preview: PromoDiscountPreview }
  | { status: 'error'; message: string };

export function StripePromoCodeField({
  plan,
  initialCode = '',
  onValidated,
  disabled,
  fieldId
}: StripePromoCodeFieldProps) {
  const { t } = useTranslation();
  const autoId = useId();
  const inputId = fieldId || `promo-code-${autoId.replace(/:/g, '')}`;
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<ValidationState>({ status: 'idle' });

  const validatePromo = useCallback(
    async (nextCode = code) => {
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
    },
    [code, onValidated, plan, t]
  );

  useEffect(() => {
    if (!initialCode.trim()) return;
    setCode(initialCode.toUpperCase());
    void validatePromo(initialCode);
    // Re-run when plan changes so price preview matches the selected tier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, plan]);

  const preview = state.status === 'valid' ? state.preview : null;

  function handleInputChange(value: string) {
    setCode(value.toUpperCase());
    if (state.status === 'error') setState({ status: 'idle' });
    if (state.status === 'valid') {
      setState({ status: 'idle' });
      onValidated?.(null);
    }
  }

  return (
    <div className="promo-code-field">
      <label className="promo-code-label" htmlFor={inputId}>
        {t('billing.promo.label')}
      </label>
      <div className="promo-code-input-row">
        <input
          id={inputId}
          className="input promo-code-input"
          value={code}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void validatePromo();
            }
          }}
          placeholder={t('billing.promo.placeholder')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-invalid={state.status === 'error'}
          aria-describedby={
            state.status === 'error'
              ? `${inputId}-error`
              : preview
                ? `${inputId}-success`
                : undefined
          }
          disabled={disabled || state.status === 'loading'}
        />
        <button
          type="button"
          className="btn btn-primary promo-code-apply-btn"
          onClick={() => void validatePromo()}
          disabled={disabled || state.status === 'loading' || !code.trim()}
        >
          {state.status === 'loading' ? t('billing.promo.validating') : t('billing.promo.apply')}
        </button>
      </div>

      {state.status === 'error' ? (
        <p id={`${inputId}-error`} className="auth-message auth-message-error promo-code-message" role="alert">
          {state.message}
        </p>
      ) : null}

      {preview ? (
        <div id={`${inputId}-success`} className="promo-code-applied-banner" role="status" aria-live="polite">
          <p className="promo-code-applied-text">{t('billing.promo.applied', { code: preview.code })}</p>
          <p className="muted promo-code-applied-detail">{preview.durationLabel}</p>
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
