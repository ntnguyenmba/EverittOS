import type { Locale } from '@/lib/i18n/config';
import { normalizeLocale } from '@/lib/i18n/config';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { getExportCopy } from '@/lib/i18n/export-copy';

/**
 * Stable API error codes shown in the UI.
 * Server logs may stay English; clients translate via this mapper.
 */
export type ApiErrorCode =
  | 'permission_denied'
  | 'unauthorized'
  | 'not_found'
  | 'job_not_found'
  | 'invoice_not_found'
  | 'payment_not_found'
  | 'invalid_document_type'
  | 'invalid_job_id'
  | 'invalid_customer_id'
  | 'invalid_invoice_id'
  | 'invalid_payment_id'
  | 'unable_to_load_documents'
  | 'unable_to_load_invoice'
  | 'unable_to_load_receipt'
  | 'unable_to_record_payment'
  | 'unable_to_save'
  | 'send_failed'
  | 'email_failed'
  | 'delivery_failed'
  | 'delete_failed'
  | 'enter_positive_payment'
  | 'add_recipient_and_message'
  | 'enter_recipient_email'
  | 'no_records'
  | 'export_failed'
  | 'invalid_email'
  | 'forbidden'
  | 'unknown';

const EXTRA: Record<Locale, Partial<Record<ApiErrorCode, string>>> = {
  en: {
    unauthorized: 'Sign in required.',
    not_found: 'Not found.',
    forbidden: 'Forbidden',
    unknown: 'Something went wrong. Try again.',
    export_failed: 'Export failed.'
  },
  es: {
    unauthorized: 'Debes iniciar sesión.',
    not_found: 'No encontrado.',
    forbidden: 'Prohibido',
    unknown: 'Algo salió mal. Inténtalo de nuevo.',
    export_failed: 'Error al exportar.'
  },
  vi: {
    unauthorized: 'Cần đăng nhập.',
    not_found: 'Không tìm thấy.',
    forbidden: 'Bị từ chối',
    unknown: 'Đã xảy ra lỗi. Hãy thử lại.',
    export_failed: 'Xuất thất bại.'
  }
};

export function getApiErrorMessage(
  code: string | null | undefined,
  locale: Locale | string | null | undefined,
  fallback?: string | null
): string {
  const normalized = normalizeLocale(locale);
  const billing = getBillingOpsCopy(normalized);
  const exportCopy = getExportCopy(normalized);
  const key = String(code || '').toLowerCase() as ApiErrorCode;

  const fromBilling: Partial<Record<ApiErrorCode, string>> = {
    permission_denied: billing.permissionDenied,
    job_not_found: billing.jobNotFound,
    invoice_not_found: billing.invoiceNotFound,
    payment_not_found: billing.paymentNotFound,
    invalid_document_type: billing.invalidDocumentType,
    invalid_job_id: billing.invalidJobId,
    invalid_customer_id: billing.invalidCustomerId,
    invalid_invoice_id: billing.invalidInvoiceId,
    invalid_payment_id: billing.invalidPaymentId,
    unable_to_load_documents: billing.unableLoadDocuments,
    unable_to_load_invoice: billing.unableLoadInvoice,
    unable_to_load_receipt: billing.unableLoadReceipt,
    unable_to_record_payment: billing.unableRecordPayment,
    unable_to_save: billing.unableSave,
    send_failed: billing.sendFailed,
    email_failed: billing.emailFailed,
    delivery_failed: billing.deliveryFailed,
    delete_failed: billing.deleteFailed,
    enter_positive_payment: billing.enterPositivePayment,
    add_recipient_and_message: billing.addRecipientAndMessage,
    enter_recipient_email: billing.enterRecipientEmail,
    no_records: exportCopy.noRecords,
    export_failed: exportCopy.exportFailed,
    invalid_email: exportCopy.invalidEmail,
    forbidden: billing.permissionDenied
  };

  return (
    fromBilling[key] ||
    EXTRA[normalized][key] ||
    EXTRA.en[key] ||
    (fallback && String(fallback).trim()) ||
    EXTRA[normalized].unknown ||
    EXTRA.en.unknown ||
    'Something went wrong. Try again.'
  );
}

/** Client helper: prefer `code`, then translate known English, else show raw. */
export function resolveApiError(
  payload: { error?: string; code?: string } | null | undefined,
  locale: Locale | string | null | undefined
): string {
  if (payload?.code) return getApiErrorMessage(payload.code, locale, payload.error);
  const message = String(payload?.error || '').trim();
  if (!message) return getApiErrorMessage('unknown', locale);

  const englishToCode: Record<string, ApiErrorCode> = {
    'Permission denied': 'permission_denied',
    'Permission denied.': 'permission_denied',
    'Job not found.': 'job_not_found',
    'Job not found': 'job_not_found',
    'Invoice not found.': 'invoice_not_found',
    'Invoice not found': 'invoice_not_found',
    'Payment not found.': 'payment_not_found',
    'Payment not found': 'payment_not_found',
    'Unable to load documents': 'unable_to_load_documents',
    'Unable to record payment': 'unable_to_record_payment',
    'Unable to save': 'unable_to_save',
    'Send failed': 'send_failed',
    'Delete failed': 'delete_failed',
    'Enter a positive payment amount': 'enter_positive_payment',
    'Enter a positive payment amount.': 'enter_positive_payment',
    'Add a recipient and message before sending.': 'add_recipient_and_message',
    'Add a recipient and message before sending': 'add_recipient_and_message',
    'Invalid job id.': 'invalid_job_id',
    'Invalid customer id.': 'invalid_customer_id',
    'Invalid invoice id.': 'invalid_invoice_id',
    'Invalid payment id.': 'invalid_payment_id'
  };

  const mapped = englishToCode[message];
  if (mapped) return getApiErrorMessage(mapped, locale, message);
  return message;
}

export function apiErrorResponse(
  code: ApiErrorCode,
  status: number,
  locale?: Locale | string | null
) {
  const message = getApiErrorMessage(code, locale);
  return Response.json({ error: message, code }, { status });
}
