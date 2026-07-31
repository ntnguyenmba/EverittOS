'use client';

import type { AutosaveState } from '@/components/outbound/use-outbound-autosave';
import { useTranslation } from '@/components/locale-provider';
import { amountFieldLabel, composerTitle, getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import type { OutboundComposerFields, OutboundDocType } from '@/lib/outbound/types';

type OutboundComposerProps = {
  docType: OutboundDocType;
  fields: OutboundComposerFields;
  saveState: AutosaveState;
  sending: boolean;
  showAmount?: boolean;
  amountMissing?: boolean;
  prefillNotice?: string;
  prefillReady?: boolean;
  onFieldChange: <K extends keyof OutboundComposerFields>(key: K, value: OutboundComposerFields[K]) => void;
  onSend: () => void;
  onReset?: () => void;
};

function saveLabel(state: AutosaveState, billingCopy: ReturnType<typeof getBillingOpsCopy>): string {
  if (state === 'saving') return billingCopy.savingEllipsis;
  if (state === 'saved') return billingCopy.saved;
  if (state === 'error') return billingCopy.notSavedRetry;
  return billingCopy.autoSaveOn;
}

export function OutboundComposer({
  docType,
  fields,
  saveState,
  sending,
  showAmount = false,
  amountMissing = false,
  prefillNotice = '',
  prefillReady = true,
  onFieldChange,
  onSend,
  onReset
}: OutboundComposerProps) {
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);

  return (
    <div className="card form outbound-composer">
      <div className="outbound-composer-head">
        <h3>{composerTitle(billingCopy, docType)}</h3>
        <span className={`outbound-autosave-indicator outbound-autosave-${saveState}`}>
          {saveLabel(saveState, billingCopy)}
        </span>
      </div>

      {!prefillReady ? <p className="muted">{billingCopy.loadingPrefill}</p> : null}
      {prefillNotice ? <p className="muted" role="status">{prefillNotice}</p> : null}

      <label htmlFor={`${docType}-recipient-name`}>{billingCopy.customer}</label>
      <input
        id={`${docType}-recipient-name`}
        className="input"
        type="text"
        autoComplete="name"
        placeholder={billingCopy.customerNamePlaceholder}
        value={fields.recipient_name}
        onChange={(event) => onFieldChange('recipient_name', event.target.value)}
      />

      <label htmlFor={`${docType}-recipient-email`}>{billingCopy.email}</label>
      <input
        id={`${docType}-recipient-email`}
        className="input"
        type="email"
        autoComplete="email"
        placeholder="customer@example.com"
        value={fields.recipient_email}
        onChange={(event) => onFieldChange('recipient_email', event.target.value)}
      />

      {showAmount ? (
        <>
          <label htmlFor={`${docType}-amount`}>{amountFieldLabel(billingCopy, docType)}</label>
          <input
            id={`${docType}-amount`}
            className={`input${amountMissing ? ' outbound-amount-missing' : ''}`}
            type="number"
            min={docType === 'invoice' ? '0.01' : '0'}
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={fields.amount}
            onChange={(event) => onFieldChange('amount', event.target.value)}
            aria-invalid={amountMissing || undefined}
          />
          {amountMissing ? (
            <p className="muted" style={{ marginTop: 4 }}>
              {billingCopy.missingAmountHint}
            </p>
          ) : null}
        </>
      ) : null}

      <label htmlFor={`${docType}-body`}>{billingCopy.workAndMessage}</label>
      <textarea
        id={`${docType}-body`}
        className="input"
        rows={6}
        placeholder={billingCopy.messagePlaceholder}
        value={fields.body}
        onChange={(event) => onFieldChange('body', event.target.value)}
      />

      <details>
        <summary><strong>{billingCopy.more}</strong></summary>
        <div className="form" style={{ marginTop: 14 }}>
          <label htmlFor={`${docType}-subject`}>{billingCopy.emailSubject}</label>
          <input
            id={`${docType}-subject`}
            className="input"
            type="text"
            value={fields.subject}
            onChange={(event) => onFieldChange('subject', event.target.value)}
          />

          <label htmlFor={`${docType}-schedule`}>{billingCopy.sendLater}</label>
          <input
            id={`${docType}-schedule`}
            className="input"
            type="datetime-local"
            value={fields.scheduled_at}
            onChange={(event) => onFieldChange('scheduled_at', event.target.value)}
          />
        </div>
      </details>

      <div className="outbound-composer-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={sending || !fields.recipient_email.trim() || !prefillReady}
          onClick={() => void onSend()}
        >
          {sending ? billingCopy.sending : fields.scheduled_at ? billingCopy.schedule : billingCopy.send}
        </button>
        {onReset ? (
          <button type="button" className="btn btn-sm outbound-secondary-action" disabled={sending} onClick={onReset}>
            {billingCopy.startOver}
          </button>
        ) : null}
      </div>
    </div>
  );
}
