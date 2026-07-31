import {
  getBillingOpsCopy,
  localizedInvoiceBody,
  localizedInvoiceSubject,
  localizedReceiptSubject
} from '@/lib/i18n/billing-ops-copy';
import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export const OUTBOUND_DOC_TYPES = ['review', 'proposal', 'estimate', 'invoice', 'message', 'receipt'] as const;
export type OutboundDocType = (typeof OUTBOUND_DOC_TYPES)[number];

export const OUTBOUND_STATUSES = ['draft', 'scheduled', 'sent', 'failed'] as const;
export type OutboundStatus = (typeof OUTBOUND_STATUSES)[number];

export type OutboundTab = 'sent' | 'scheduled' | 'drafts' | 'failed';

export type OutboundDocument = {
  id: string;
  organization_id: string;
  doc_type: OutboundDocType;
  status: OutboundStatus;
  recipient_email: string | null;
  recipient_name: string | null;
  subject: string | null;
  body: string | null;
  customer_id: string | null;
  job_id: string | null;
  amount: number | null;
  scheduled_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  amount_paid?: number | null;
  balance_due?: number | null;
  payment_status?: string | null;
  due_date?: string | null;
  invoice_date?: string | null;
  paid_at?: string | null;
  last_payment_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  payment_notes?: string | null;
};

export type OutboundComposerFields = {
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  amount: string;
  customer_id: string;
  job_id: string;
  scheduled_at: string;
};

function localizedDefaultTemplates(locale: Locale): Record<OutboundDocType, Partial<OutboundComposerFields>> {
  const billing = getBillingOpsCopy(locale);
  if (locale === 'es') {
    return {
      review: {
        subject: 'Nos encantaría tu opinión',
        body: 'Gracias por elegirnos. Esperamos que hayas tenido una gran experiencia. Nos encantaría conocer tu opinión. Tómate un momento para completar nuestro breve formulario.\n\nCompartir opinión: https://docs.google.com/forms/d/e/1FAIpQLScKoDhMAuGu8RyvFQE9dBbrazjpGhPxm-C7lAlrdnDurGhDgQ/viewform?usp=header'
      },
      proposal: {
        subject: 'Propuesta para tu proyecto',
        body: 'A continuación encontrarás nuestra propuesta. Avísanos si tienes alguna pregunta.'
      },
      estimate: {
        subject: 'Presupuesto para tu proyecto',
        body: 'Aquí está el presupuesto del trabajo que comentamos. Esta cotización es válida por 30 días.'
      },
      invoice: {
        subject: billing.invoiceForCompletedWork,
        body: billing.thankYouBusiness
      },
      message: { subject: '', body: '' },
      receipt: {
        subject: localizedReceiptSubject(locale),
        body: billing.thankYouPaymentReceived
      }
    };
  }
  if (locale === 'vi') {
    return {
      review: {
        subject: 'Chúng tôi rất muốn nhận phản hồi của bạn',
        body: 'Cảm ơn bạn đã chọn chúng tôi. Hy vọng bạn có trải nghiệm tốt. Hãy dành chút thời gian hoàn thành biểu mẫu phản hồi ngắn.\n\nGửi phản hồi: https://docs.google.com/forms/d/e/1FAIpQLScKoDhMAuGu8RyvFQE9dBbrazjpGhPxm-C7lAlrdnDurGhDgQ/viewform?usp=header'
      },
      proposal: {
        subject: 'Đề xuất cho dự án của bạn',
        body: 'Dưới đây là đề xuất của chúng tôi. Hãy cho chúng tôi biết nếu bạn có câu hỏi.'
      },
      estimate: {
        subject: 'Báo giá cho dự án của bạn',
        body: 'Đây là báo giá cho công việc đã thảo luận. Báo giá có hiệu lực trong 30 ngày.'
      },
      invoice: {
        subject: billing.invoiceForCompletedWork,
        body: billing.thankYouBusiness
      },
      message: { subject: '', body: '' },
      receipt: {
        subject: localizedReceiptSubject(locale),
        body: billing.thankYouPaymentReceived
      }
    };
  }
  return {
    review: {
      subject: 'We would love your feedback',
      body: 'Thank you for choosing us. We hope you had a great experience. We would love to hear your feedback. Please take a moment to complete our short feedback form.\n\nShare Feedback: https://docs.google.com/forms/d/e/1FAIpQLScKoDhMAuGu8RyvFQE9dBbrazjpGhPxm-C7lAlrdnDurGhDgQ/viewform?usp=header'
    },
    proposal: {
      subject: 'Proposal for your project',
      body: 'Please find our proposal below. Let us know if you have any questions.'
    },
    estimate: {
      subject: 'Estimate for your project',
      body: 'Here is the estimate for the work we discussed. This quote is valid for 30 days.'
    },
    invoice: {
      subject: billing.invoiceForCompletedWork,
      body: billing.thankYouBusiness
    },
    message: { subject: '', body: '' },
    receipt: {
      subject: localizedReceiptSubject(locale),
      body: billing.thankYouPaymentReceived
    }
  };
}

export function defaultComposerFields(
  docType: OutboundDocType,
  locale: Locale | string | null | undefined = 'en'
): OutboundComposerFields {
  const defaults = localizedDefaultTemplates(normalizeLocale(locale));

  return {
    recipient_email: '',
    recipient_name: '',
    subject: defaults[docType].subject || '',
    body: defaults[docType].body || '',
    amount: '',
    customer_id: '',
    job_id: '',
    scheduled_at: '',
    ...defaults[docType]
  };
}

export function tabToStatus(tab: OutboundTab): OutboundStatus | OutboundStatus[] {
  if (tab === 'drafts') return 'draft';
  return tab;
}

export function docTypeLabel(
  docType: OutboundDocType,
  locale: Locale | string | null | undefined = 'en'
): string {
  const key = normalizeLocale(locale);
  const billing = getBillingOpsCopy(key);
  const labels: Record<Locale, Record<OutboundDocType, string>> = {
    en: {
      review: 'Review request',
      proposal: 'Proposal',
      estimate: 'Estimate',
      invoice: 'Invoice',
      message: 'Message',
      receipt: billing.paymentReceipt
    },
    es: {
      review: 'Solicitud de reseña',
      proposal: 'Propuesta',
      estimate: 'Presupuesto',
      invoice: 'Factura',
      message: 'Mensaje',
      receipt: billing.paymentReceipt
    },
    vi: {
      review: 'Yêu cầu đánh giá',
      proposal: 'Đề xuất',
      estimate: 'Báo giá',
      invoice: 'Hóa đơn',
      message: 'Tin nhắn',
      receipt: billing.paymentReceipt
    }
  };
  return labels[key][docType];
}

export function invoiceSubjectForJob(jobTitle: string, locale: Locale | string | null | undefined = 'en'): string {
  return localizedInvoiceSubject(locale, jobTitle);
}

export function invoiceBodyForJob(jobTitle: string, locale: Locale | string | null | undefined = 'en'): string {
  return localizedInvoiceBody(locale, jobTitle);
}
