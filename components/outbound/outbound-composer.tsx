'use client';

import type { AutosaveState } from '@/components/outbound/use-outbound-autosave';
import type { OutboundComposerFields, OutboundDocType } from '@/lib/outbound/types';

type OutboundComposerProps = {
  docType: OutboundDocType;
  fields: OutboundComposerFields;
  saveState: AutosaveState;
  sending: boolean;
  showAmount?: boolean;
  onFieldChange: <K extends keyof OutboundComposerFields>(key: K, value: OutboundComposerFields[K]) => void;
  onSend: () => void;
  onReset?: () => void;
};

function saveLabel(state: AutosaveState): string {
  if (state === 'saving') return 'Saving…';
  if (state === 'saved') return 'Saved automatically';
  if (state === 'error') return 'Save issue — keep typing to retry';
  return 'Auto-save on';
}

function amountHelp(docType: OutboundDocType): string {
  if (docType === 'invoice') return 'Required before sending an invoice. Payment status is tracked after the invoice is sent.';
  if (docType === 'estimate') return 'Optional estimate total shown in the email.';
  if (docType === 'proposal') return 'Optional proposal amount shown in the email.';
  return '';
}

export function OutboundComposer({
  docType,
  fields,
  saveState,
  sending,
  showAmount = false,
  onFieldChange,
  onSend,
  onReset
}: OutboundComposerProps) {
  const amountNote = amountHelp(docType);

  return (
    <div className="card form outbound-composer">
      <div className="outbound-composer-head">
        <h3>Compose</h3>
        <span className={`outbound-autosave-indicator outbound-autosave-${saveState}`}>{saveLabel(saveState)}</span>
      </div>

      <label htmlFor={`${docType}-recipient-email`}>Recipient email</label>
      <input
        id={`${docType}-recipient-email`}
        className="input"
        type="email"
        autoComplete="email"
        placeholder="customer@example.com"
        value={fields.recipient_email}
        onChange={(e) => onFieldChange('recipient_email', e.target.value)}
      />

      <label htmlFor={`${docType}-recipient-name`}>Recipient name (optional)</label>
      <input
        id={`${docType}-recipient-name`}
        className="input"
        type="text"
        placeholder="Customer name"
        value={fields.recipient_name}
        onChange={(e) => onFieldChange('recipient_name', e.target.value)}
      />

      <label htmlFor={`${docType}-subject`}>Subject</label>
      <input
        id={`${docType}-subject`}
        className="input"
        type="text"
        value={fields.subject}
        onChange={(e) => onFieldChange('subject', e.target.value)}
      />

      <label htmlFor={`${docType}-body`}>Message</label>
      <textarea
        id={`${docType}-body`}
        className="input"
        rows={5}
        value={fields.body}
        onChange={(e) => onFieldChange('body', e.target.value)}
      />

      {showAmount ? (
        <>
          <label htmlFor={`${docType}-amount`}>{docType === 'invoice' ? 'Invoice amount' : 'Amount'}</label>
          <input
            id={`${docType}-amount`}
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={fields.amount}
            onChange={(e) => onFieldChange('amount', e.target.value)}
          />
          {amountNote ? <p className="muted">{amountNote}</p> : null}
        </>
      ) : null}

      <label htmlFor={`${docType}-schedule`}>Schedule send (optional)</label>
      <input
        id={`${docType}-schedule`}
        className="input"
        type="datetime-local"
        value={fields.scheduled_at}
        onChange={(e) => onFieldChange('scheduled_at', e.target.value)}
      />

      <div className="outbound-composer-actions">
        <button type="button" className="btn btn-primary" disabled={sending} onClick={() => void onSend()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
        {onReset ? (
          <button type="button" className="btn btn-sm outbound-secondary-action" disabled={sending} onClick={onReset}>
            Clear
          </button>
        ) : null}
      </div>
      <p className="muted outbound-composer-note">
        Work saves automatically while you type. Send when you are ready — no manual save required.
      </p>
    </div>
  );
}
