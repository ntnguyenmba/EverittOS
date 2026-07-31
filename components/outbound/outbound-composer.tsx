'use client';

import type { AutosaveState } from '@/components/outbound/use-outbound-autosave';
import { useTranslation } from '@/components/locale-provider';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
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

function saveLabel(state: AutosaveState): string {
  if (state === 'saving') return 'Saving...';
  if (state === 'saved') return 'Saved';
  if (state === 'error') return 'Not saved. Keep typing to retry.';
  return 'Auto-save on';
}

function composerTitle(docType: OutboundDocType): string {
  if (docType === 'estimate') return 'New estimate';
  if (docType === 'proposal') return 'New proposal';
  if (docType === 'invoice') return 'New invoice';
  if (docType === 'receipt') return 'Payment receipt';
  return 'New message';
}

function amountLabel(docType: OutboundDocType): string {
  if (docType === 'estimate') return 'Estimate total';
  if (docType === 'proposal') return 'Proposal total';
  if (docType === 'invoice') return 'Amount due';
  if (docType === 'receipt') return 'Amount paid';
  return 'Amount';
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
        <h3>{composerTitle(docType)}</h3>
        <span className={`outbound-autosave-indicator outbound-autosave-${saveState}`}>{saveLabel(saveState)}</span>
      </div>

      {!prefillReady ? <p className="muted">{billingCopy.loadingPrefill}</p> : null}
      {prefillNotice ? <p className="muted" role="status">{prefillNotice}</p> : null}

      <label htmlFor={`${docType}-recipient-name`}>Customer</label>
      <input
        id={`${docType}-recipient-name`}
        className="input"
        type="text"
        autoComplete="name"
        placeholder="Customer name"
        value={fields.recipient_name}
        onChange={(event) => onFieldChange('recipient_name', event.target.value)}
      />

      <label htmlFor={`${docType}-recipient-email`}>Email</label>
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
          <label htmlFor={`${docType}-amount`}>{amountLabel(docType)}</label>
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

      <label htmlFor={`${docType}-body`}>Work and message</label>
      <textarea
        id={`${docType}-body`}
        className="input"
        rows={6}
        placeholder="Describe the work, price, and anything the customer needs to know."
        value={fields.body}
        onChange={(event) => onFieldChange('body', event.target.value)}
      />

      <details>
        <summary><strong>More</strong></summary>
        <div className="form" style={{ marginTop: 14 }}>
          <label htmlFor={`${docType}-subject`}>Email subject</label>
          <input
            id={`${docType}-subject`}
            className="input"
            type="text"
            value={fields.subject}
            onChange={(event) => onFieldChange('subject', event.target.value)}
          />

          <label htmlFor={`${docType}-schedule`}>Send later</label>
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
          {sending ? 'Sending...' : fields.scheduled_at ? 'Schedule' : 'Send'}
        </button>
        {onReset ? (
          <button type="button" className="btn btn-sm outbound-secondary-action" disabled={sending} onClick={onReset}>
            Start over
          </button>
        ) : null}
      </div>
    </div>
  );
}
