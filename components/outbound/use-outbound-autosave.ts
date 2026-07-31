'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { resolveApiError } from '@/lib/i18n/api-error-copy';
import { getBillingOpsCopy, localizedReceiptSubject } from '@/lib/i18n/billing-ops-copy';
import {
  defaultComposerFields,
  invoiceBodyForJob,
  invoiceSubjectForJob,
  type OutboundComposerFields,
  type OutboundDocType,
  type OutboundDocument
} from '@/lib/outbound/types';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

type UseOutboundAutosaveOptions = {
  docType: OutboundDocType;
  initialJobId?: string;
  initialCustomerId?: string;
  initialInvoiceId?: string;
  initialPaymentId?: string;
  forceNew?: boolean;
  enabled?: boolean;
};

type PrefillResponse = {
  prefill?: {
    job_id?: string | null;
    customer_id?: string | null;
    recipient_name?: string;
    recipient_email?: string;
    amount?: number | null;
    job_title?: string;
    subject?: string;
    body?: string;
    invoice_id?: string | null;
    payment_id?: string | null;
    payment_date?: string | null;
    payment_method?: string | null;
    payment_reference?: string | null;
    amount_missing?: boolean;
  };
  existing_invoice?: {
    id: string;
    status: string | null;
    payment_status?: string | null;
    is_paid?: boolean;
  } | null;
  existing_receipt?: {
    id: string;
    status: string | null;
  } | null;
};

function fieldsFromDocument(doc: OutboundDocument): OutboundComposerFields {
  return {
    recipient_email: doc.recipient_email || '',
    recipient_name: doc.recipient_name || '',
    subject: doc.subject || '',
    body: doc.body || '',
    amount: doc.amount != null ? String(doc.amount) : '',
    customer_id: doc.customer_id || '',
    job_id: doc.job_id || '',
    scheduled_at: doc.scheduled_at ? doc.scheduled_at.slice(0, 16) : ''
  };
}

function hasComposerContent(fields: OutboundComposerFields): boolean {
  return Boolean(
    fields.recipient_email.trim() ||
      fields.subject.trim() ||
      fields.body.trim() ||
      fields.amount.trim() ||
      fields.recipient_name.trim()
  );
}

function isDefaultTemplate(
  docType: OutboundDocType,
  fields: OutboundComposerFields,
  locale: string
): boolean {
  const defaults = defaultComposerFields(docType, locale);
  return fields.subject === defaults.subject && fields.body === defaults.body;
}

export function useOutboundAutosave({
  docType,
  initialJobId = '',
  initialCustomerId = '',
  initialInvoiceId = '',
  initialPaymentId = '',
  forceNew = false,
  enabled = true
}: UseOutboundAutosaveOptions) {
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [fields, setFields] = useState<OutboundComposerFields>(() => {
    const base = defaultComposerFields(docType, locale);
    return {
      ...base,
      job_id: initialJobId || base.job_id,
      customer_id: initialCustomerId || base.customer_id
    };
  });
  const [saveState, setSaveState] = useState<AutosaveState>('idle');
  const [sending, setSending] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState('');
  const [amountMissing, setAmountMissing] = useState(false);
  const [prefillReady, setPrefillReady] = useState(
    !(initialJobId || initialCustomerId || initialInvoiceId || initialPaymentId)
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(false);
  const prefillKeyRef = useRef('');
  const userEditedRef = useRef<Partial<Record<keyof OutboundComposerFields, boolean>>>({});
  const loadedExistingRef = useRef(false);
  const receiptMetaRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    if (!enabled) {
      setPrefillReady(true);
      return;
    }
    if (!initialJobId && !initialCustomerId && !initialInvoiceId && !initialPaymentId) {
      setPrefillReady(true);
      return;
    }

    const key = `${docType}:${initialJobId}:${initialCustomerId}:${initialInvoiceId}:${initialPaymentId}:${forceNew ? '1' : '0'}:${locale}`;
    if (prefillKeyRef.current === key) return;
    prefillKeyRef.current = key;
    loadedExistingRef.current = false;
    setPrefillReady(false);
    setPrefillNotice('');

    const params = new URLSearchParams();
    params.set('docType', docType);
    params.set('locale', locale);
    if (initialJobId) params.set('jobId', initialJobId);
    if (initialCustomerId) params.set('customerId', initialCustomerId);
    if (initialInvoiceId) params.set('invoiceId', initialInvoiceId);
    if (initialPaymentId) params.set('paymentId', initialPaymentId);
    if (forceNew) params.set('forceNew', '1');

    let cancelled = false;
    void fetch(`/api/outbound/prefill?${params.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const json = (await response.json()) as PrefillResponse & { error?: string; code?: string };
        if (!response.ok) throw new Error(resolveApiError(json, locale));
        return json;
      })
      .then(async (json) => {
        if (cancelled) return;

        const existingId =
          docType === 'receipt'
            ? json.existing_receipt?.id
            : !forceNew
              ? json.existing_invoice?.id
              : undefined;

        if (existingId && !forceNew) {
          const res = await fetch(`/api/outbound/${existingId}`, { cache: 'no-store' });
          const existingJson = await res.json();
          if (res.ok && existingJson.document) {
            loadedExistingRef.current = true;
            skipNextSaveRef.current = true;
            setDocumentId(existingJson.document.id);
            setFields(fieldsFromDocument(existingJson.document as OutboundDocument));
            setSaveState('saved');
            setPrefillNotice(
              docType === 'receipt' ? billingCopy.existingReceiptFound : billingCopy.existingInvoiceFound
            );
            setAmountMissing(!(Number(existingJson.document.amount) > 0));
            setPrefillReady(true);
            return;
          }
        }

        const prefill = json.prefill;
        if (!prefill) {
          setPrefillReady(true);
          return;
        }

        receiptMetaRef.current = {
          invoice_id: prefill.invoice_id || null,
          payment_id: prefill.payment_id || null,
          payment_date: prefill.payment_date || null,
          payment_method: prefill.payment_method || null,
          payment_reference: prefill.payment_reference || null,
          receipt: docType === 'receipt'
        };

        skipNextSaveRef.current = true;
        setFields((current) => {
          const defaults = defaultComposerFields(docType, locale);
          const jobLabel = prefill.job_title?.trim() || '';
          const canReplaceSubject =
            !userEditedRef.current.subject &&
            (current.subject === defaults.subject || !current.subject.trim());
          const canReplaceBody =
            !userEditedRef.current.body && (current.body === defaults.body || !current.body.trim());

          let subject = current.subject;
          let body = current.body;
          if (canReplaceSubject) {
            subject =
              prefill.subject ||
              (docType === 'invoice' && jobLabel
                ? invoiceSubjectForJob(jobLabel, locale)
                : docType === 'receipt'
                  ? localizedReceiptSubject(locale)
                  : current.subject);
          }
          if (canReplaceBody) {
            body =
              prefill.body ||
              (docType === 'invoice' && jobLabel
                ? invoiceBodyForJob(jobLabel, locale)
                : docType === 'receipt'
                  ? billingCopy.thankYouPaymentReceived
                  : current.body);
          }

          return {
            ...current,
            recipient_name: userEditedRef.current.recipient_name
              ? current.recipient_name
              : current.recipient_name || prefill.recipient_name || '',
            recipient_email: userEditedRef.current.recipient_email
              ? current.recipient_email
              : current.recipient_email || prefill.recipient_email || '',
            amount: userEditedRef.current.amount
              ? current.amount
              : current.amount || (prefill.amount != null ? String(prefill.amount) : ''),
            customer_id: current.customer_id || prefill.customer_id || '',
            job_id: current.job_id || prefill.job_id || '',
            subject,
            body
          };
        });
        setAmountMissing(Boolean(prefill.amount_missing));
        setPrefillReady(true);
      })
      .catch(() => {
        if (!cancelled) setPrefillReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [
    billingCopy.existingInvoiceFound,
    billingCopy.existingReceiptFound,
    billingCopy.thankYouPaymentReceived,
    docType,
    enabled,
    forceNew,
    initialCustomerId,
    initialInvoiceId,
    initialJobId,
    initialPaymentId,
    locale
  ]);

  const resetComposer = useCallback(() => {
    skipNextSaveRef.current = true;
    setDocumentId(null);
    setFields({
      ...defaultComposerFields(docType, locale),
      job_id: initialJobId || '',
      customer_id: initialCustomerId || ''
    });
    setSaveState('idle');
    setPrefillNotice('');
    setAmountMissing(false);
    prefillKeyRef.current = '';
    userEditedRef.current = {};
    loadedExistingRef.current = false;
    receiptMetaRef.current = {};
  }, [docType, initialCustomerId, initialJobId, locale]);

  const persist = useCallback(
    async (nextFields: OutboundComposerFields, id: string | null) => {
      if (!enabled || !prefillReady || !hasComposerContent(nextFields)) return id;
      if (loadedExistingRef.current && !id) return id;

      setSaveState('saving');
      const payload: Record<string, unknown> = {
        doc_type: docType,
        recipient_email: nextFields.recipient_email,
        recipient_name: nextFields.recipient_name,
        subject: nextFields.subject,
        body: nextFields.body,
        amount: nextFields.amount ? Number(nextFields.amount) : null,
        customer_id: nextFields.customer_id || null,
        job_id: nextFields.job_id || null,
        scheduled_at: nextFields.scheduled_at ? new Date(nextFields.scheduled_at).toISOString() : null,
        status: nextFields.scheduled_at ? 'scheduled' : 'draft'
      };

      if (docType === 'receipt') {
        payload.source_entity_type = 'invoice_receipt';
        payload.source_entity_id = receiptMetaRef.current.invoice_id || initialInvoiceId || null;
        payload.metadata = {
          ...receiptMetaRef.current,
          receipt: true
        };
      }

      try {
        if (id) {
          const res = await fetch(`/api/outbound/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (!res.ok) throw new Error(resolveApiError(json, locale));
          setSaveState('saved');
          return id;
        }

        const res = await fetch('/api/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(resolveApiError(json, locale));
        const newId = json.document?.id as string | undefined;
        if (newId) setDocumentId(newId);
        setSaveState('saved');
        return newId || null;
      } catch {
        setSaveState('error');
        return id;
      }
    },
    [docType, enabled, initialInvoiceId, locale, prefillReady]
  );

  useEffect(() => {
    if (!enabled || !prefillReady) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (!hasComposerContent(fields)) return;
    // Avoid creating empty/default drafts before the user edits or prefill settles.
    if (
      !documentId &&
      isDefaultTemplate(docType, fields, locale) &&
      !fields.recipient_email.trim() &&
      !fields.amount.trim()
    ) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist(fields, documentId).then((id) => {
        if (id && id !== documentId) setDocumentId(id);
      });
    }, 650);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fields, documentId, enabled, persist, prefillReady, docType, locale]);

  const updateField = useCallback(<K extends keyof OutboundComposerFields>(key: K, value: OutboundComposerFields[K]) => {
    userEditedRef.current[key] = true;
    setFields((current) => ({ ...current, [key]: value }));
    if (key === 'amount') {
      setAmountMissing(!(Number(value) > 0));
    }
    if (saveState === 'saved') setSaveState('idle');
  }, [saveState]);

  const sendNow = useCallback(async () => {
    if (sending) return null;
    setSending(true);
    try {
      const id = await persist(fields, documentId);
      if (!id) {
        throw new Error(billingCopy.addRecipientAndMessage);
      }
      const res = await fetch(`/api/outbound/${id}/send`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(resolveApiError(json, locale));
      resetComposer();
      return json as { message?: string; deliveryNote?: string; document?: OutboundDocument };
    } finally {
      setSending(false);
    }
  }, [billingCopy.addRecipientAndMessage, documentId, fields, locale, persist, resetComposer, sending]);

  const loadDocument = useCallback((doc: OutboundDocument) => {
    skipNextSaveRef.current = true;
    loadedExistingRef.current = true;
    setDocumentId(doc.id);
    setFields(fieldsFromDocument(doc));
    setSaveState('saved');
    setPrefillReady(true);
    setAmountMissing(!(Number(doc.amount) > 0));
  }, []);

  return {
    documentId,
    fields,
    updateField,
    saveState,
    sending,
    sendNow,
    resetComposer,
    loadDocument,
    prefillReady,
    prefillNotice,
    amountMissing
  };
}
