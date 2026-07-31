'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  defaultComposerFields,
  type OutboundComposerFields,
  type OutboundDocType,
  type OutboundDocument
} from '@/lib/outbound/types';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

type UseOutboundAutosaveOptions = {
  docType: OutboundDocType;
  initialJobId?: string;
  initialCustomerId?: string;
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
  };
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

export function useOutboundAutosave({
  docType,
  initialJobId = '',
  initialCustomerId = '',
  enabled = true
}: UseOutboundAutosaveOptions) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [fields, setFields] = useState<OutboundComposerFields>(() => {
    const base = defaultComposerFields(docType);
    return {
      ...base,
      job_id: initialJobId || base.job_id,
      customer_id: initialCustomerId || base.customer_id
    };
  });
  const [saveState, setSaveState] = useState<AutosaveState>('idle');
  const [sending, setSending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(false);
  const prefillKeyRef = useRef('');

  useEffect(() => {
    if (!enabled || (!initialJobId && !initialCustomerId)) return;
    const key = `${docType}:${initialJobId}:${initialCustomerId}`;
    if (prefillKeyRef.current === key) return;
    prefillKeyRef.current = key;

    const params = new URLSearchParams();
    if (initialJobId) params.set('jobId', initialJobId);
    if (initialCustomerId) params.set('customerId', initialCustomerId);

    let cancelled = false;
    void fetch(`/api/outbound/prefill?${params.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const json = (await response.json()) as PrefillResponse & { error?: string };
        if (!response.ok) throw new Error(json.error || 'Unable to load invoice details.');
        return json.prefill;
      })
      .then((prefill) => {
        if (cancelled || !prefill) return;
        skipNextSaveRef.current = true;
        setFields((current) => {
          const jobLabel = prefill.job_title?.trim();
          const subject =
            docType === 'invoice' && jobLabel && current.subject === defaultComposerFields('invoice').subject
              ? `Invoice for ${jobLabel}`
              : current.subject;
          return {
            ...current,
            recipient_name: current.recipient_name || prefill.recipient_name || '',
            recipient_email: current.recipient_email || prefill.recipient_email || '',
            amount: current.amount || (prefill.amount != null ? String(prefill.amount) : ''),
            customer_id: current.customer_id || prefill.customer_id || '',
            job_id: current.job_id || prefill.job_id || '',
            subject
          };
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [docType, enabled, initialCustomerId, initialJobId]);

  const resetComposer = useCallback(() => {
    skipNextSaveRef.current = true;
    setDocumentId(null);
    setFields({
      ...defaultComposerFields(docType),
      job_id: initialJobId || '',
      customer_id: initialCustomerId || ''
    });
    setSaveState('idle');
    prefillKeyRef.current = '';
  }, [docType, initialCustomerId, initialJobId]);

  const persist = useCallback(
    async (nextFields: OutboundComposerFields, id: string | null) => {
      if (!enabled || !hasComposerContent(nextFields)) return id;

      setSaveState('saving');
      const payload = {
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

      try {
        if (id) {
          const res = await fetch(`/api/outbound/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Auto-save failed');
          setSaveState('saved');
          return id;
        }

        const res = await fetch('/api/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Auto-save failed');
        const newId = json.document?.id as string | undefined;
        if (newId) setDocumentId(newId);
        setSaveState('saved');
        return newId || null;
      } catch {
        setSaveState('error');
        return id;
      }
    },
    [docType, enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (!hasComposerContent(fields)) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist(fields, documentId).then((id) => {
        if (id && id !== documentId) setDocumentId(id);
      });
    }, 650);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fields, documentId, enabled, persist]);

  const updateField = useCallback(<K extends keyof OutboundComposerFields>(key: K, value: OutboundComposerFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
    if (saveState === 'saved') setSaveState('idle');
  }, [saveState]);

  const sendNow = useCallback(async () => {
    if (sending) return null;
    setSending(true);
    try {
      const id = await persist(fields, documentId);
      if (!id) {
        throw new Error('Add a recipient and message before sending.');
      }
      const res = await fetch(`/api/outbound/${id}/send`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Send failed');
      resetComposer();
      return json as { message?: string; deliveryNote?: string; document?: OutboundDocument };
    } finally {
      setSending(false);
    }
  }, [documentId, fields, persist, resetComposer, sending]);

  const loadDocument = useCallback((doc: OutboundDocument) => {
    skipNextSaveRef.current = true;
    setDocumentId(doc.id);
    setFields(fieldsFromDocument(doc));
    setSaveState('saved');
  }, []);

  return {
    documentId,
    fields,
    updateField,
    saveState,
    sending,
    sendNow,
    resetComposer,
    loadDocument
  };
}
