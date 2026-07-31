import type { Locale } from '@/lib/i18n/config';
import type { JobBillingStatus } from '@/lib/jobs/billing-status';

export type BillingOpsCopy = {
  createInvoice: string;
  createDraft: string;
  sendReceipt: string;
  paymentReceipt: string;
  paymentRecorded: string;
  notInvoiced: string;
  draftInvoice: string;
  invoiceSent: string;
  partiallyPaid: string;
  paid: string;
  receiptSent: string;
  later: string;
  billingStatus: string;
  missingAmount: string;
  existingInvoiceFound: string;
  existingReceiptFound: string;
  jobCompleted: string;
  createAnotherInvoice: string;
  billing: Record<JobBillingStatus, string>;
};

const copy: Record<Locale, BillingOpsCopy> = {
  en: {
    createInvoice: 'Create invoice',
    createDraft: 'Create draft',
    sendReceipt: 'Send receipt',
    paymentReceipt: 'Payment receipt',
    paymentRecorded: 'Payment recorded',
    notInvoiced: 'Not invoiced',
    draftInvoice: 'Draft invoice',
    invoiceSent: 'Invoice sent',
    partiallyPaid: 'Partially paid',
    paid: 'Paid',
    receiptSent: 'Receipt sent',
    later: 'Later',
    billingStatus: 'Billing status',
    missingAmount: 'Missing amount',
    existingInvoiceFound: 'Existing invoice found',
    existingReceiptFound: 'Existing receipt found',
    jobCompleted: 'Job completed',
    createAnotherInvoice: 'Create another invoice',
    billing: {
      not_invoiced: 'Not invoiced',
      draft_invoice: 'Draft invoice',
      invoice_sent: 'Invoice sent',
      partially_paid: 'Partially paid',
      paid: 'Paid',
      receipt_sent: 'Receipt sent'
    }
  },
  es: {
    createInvoice: 'Crear factura',
    createDraft: 'Crear borrador',
    sendReceipt: 'Enviar recibo',
    paymentReceipt: 'Recibo de pago',
    paymentRecorded: 'Pago registrado',
    notInvoiced: 'Sin facturar',
    draftInvoice: 'Borrador de factura',
    invoiceSent: 'Factura enviada',
    partiallyPaid: 'Pago parcial',
    paid: 'Pagado',
    receiptSent: 'Recibo enviado',
    later: 'Más tarde',
    billingStatus: 'Estado de facturación',
    missingAmount: 'Monto faltante',
    existingInvoiceFound: 'Factura existente encontrada',
    existingReceiptFound: 'Recibo existente encontrado',
    jobCompleted: 'Trabajo completado',
    createAnotherInvoice: 'Crear otra factura',
    billing: {
      not_invoiced: 'Sin facturar',
      draft_invoice: 'Borrador de factura',
      invoice_sent: 'Factura enviada',
      partially_paid: 'Pago parcial',
      paid: 'Pagado',
      receipt_sent: 'Recibo enviado'
    }
  },
  vi: {
    createInvoice: 'Tạo hóa đơn',
    createDraft: 'Tạo bản nháp',
    sendReceipt: 'Gửi biên nhận',
    paymentReceipt: 'Biên nhận thanh toán',
    paymentRecorded: 'Đã ghi nhận thanh toán',
    notInvoiced: 'Chưa xuất hóa đơn',
    draftInvoice: 'Hóa đơn nháp',
    invoiceSent: 'Đã gửi hóa đơn',
    partiallyPaid: 'Thanh toán một phần',
    paid: 'Đã thanh toán',
    receiptSent: 'Đã gửi biên nhận',
    later: 'Để sau',
    billingStatus: 'Trạng thái thanh toán',
    missingAmount: 'Thiếu số tiền',
    existingInvoiceFound: 'Đã tìm thấy hóa đơn hiện có',
    existingReceiptFound: 'Đã tìm thấy biên nhận hiện có',
    jobCompleted: 'Công việc đã hoàn thành',
    createAnotherInvoice: 'Tạo hóa đơn khác',
    billing: {
      not_invoiced: 'Chưa xuất hóa đơn',
      draft_invoice: 'Hóa đơn nháp',
      invoice_sent: 'Đã gửi hóa đơn',
      partially_paid: 'Thanh toán một phần',
      paid: 'Đã thanh toán',
      receipt_sent: 'Đã gửi biên nhận'
    }
  }
};

export function getBillingOpsCopy(locale: Locale): BillingOpsCopy {
  return copy[locale] || copy.en;
}
