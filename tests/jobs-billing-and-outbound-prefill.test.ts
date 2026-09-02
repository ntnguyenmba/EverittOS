import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { deriveJobBillingStatus } from '@/lib/jobs/billing-status';
import {
  defaultComposerFields,
  invoiceBodyForJob,
  invoiceSubjectForJob,
  OUTBOUND_DOC_TYPES
} from '@/lib/outbound/types';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';

describe('Jobs billing status mapping', () => {
  it('marks jobs without invoices as not invoiced', () => {
    assert.equal(deriveJobBillingStatus([]), 'not_invoiced');
  });

  it('maps draft, sent, partial, paid, and receipt-sent states', () => {
    assert.equal(
      deriveJobBillingStatus([{ id: '1', job_id: 'j1', doc_type: 'invoice', status: 'draft' }]),
      'draft_invoice'
    );
    assert.equal(
      deriveJobBillingStatus([{ id: '1', job_id: 'j1', doc_type: 'invoice', status: 'sent', amount: 100, amount_paid: 0 }]),
      'invoice_sent'
    );
    assert.equal(
      deriveJobBillingStatus([
        {
          id: '1',
          job_id: 'j1',
          doc_type: 'invoice',
          status: 'sent',
          amount: 100,
          amount_paid: 40,
          payment_status: 'partially_paid'
        }
      ]),
      'partially_paid'
    );
    assert.equal(
      deriveJobBillingStatus([
        {
          id: '1',
          job_id: 'j1',
          doc_type: 'invoice',
          status: 'sent',
          amount: 100,
          amount_paid: 100,
          payment_status: 'paid'
        }
      ]),
      'paid'
    );
    assert.equal(
      deriveJobBillingStatus([
        {
          id: '1',
          job_id: 'j1',
          doc_type: 'invoice',
          status: 'sent',
          amount: 100,
          amount_paid: 100,
          payment_status: 'paid'
        },
        { id: '2', job_id: 'j1', doc_type: 'receipt', status: 'sent' }
      ]),
      'receipt_sent'
    );
  });
});

describe('Invoice and receipt prefill helpers', () => {
  it('builds invoice subject and body from job title', () => {
    assert.equal(invoiceSubjectForJob('Airbnb 2657 Frances Ln'), 'Invoice for Airbnb 2657 Frances Ln');
    assert.equal(
      invoiceBodyForJob('Airbnb 2657 Frances Ln'),
      'Thank you for your business. Please find the invoice for Airbnb 2657 Frances Ln below.'
    );
  });

  it('includes receipt as a supported outbound document type with defaults', () => {
    assert.ok(OUTBOUND_DOC_TYPES.includes('receipt'));
    const fields = defaultComposerFields('receipt');
    assert.equal(fields.subject, 'Payment receipt');
    assert.equal(fields.body, 'Thank you. We received your payment.');
  });

  it('prefers customer profile values over job fields in prefill route', () => {
    const source = readFileSync('app/api/outbound/prefill/route.ts', 'utf8');
    assert.match(source, /recipient_name: customer\?\.name \|\| job\?\.customer_name/);
    assert.match(source, /recipient_email: customer\?\.email \|\| job\?\.customer_email/);
    assert.match(source, /const amount = job\?\.revenue_amount/);
    assert.match(source, /existing_invoice/);
    assert.match(source, /existing_receipt/);
  });

  it('autosave avoids duplicate drafts and reuses existing invoices/receipts', () => {
    const source = readFileSync('components/outbound/use-outbound-autosave.ts', 'utf8');
    assert.match(source, /existing_invoice/);
    assert.match(source, /existing_receipt/);
    assert.match(source, /prefillReady/);
    assert.match(source, /skipNextSaveRef/);
    assert.match(source, /isDefaultTemplate/);
    assert.match(source, /userEditedRef/);
  });

  it('receipt prefill uses recorded payment amount and payment id', () => {
    const source = readFileSync('app/api/outbound/prefill/route.ts', 'utf8');
    assert.match(source, /invoice_payments/);
    assert.match(source, /payment_id/);
    assert.match(source, /localizedReceiptBody/);
    assert.match(source, /normalizeLocale/);
    assert.match(source, /formatMoneyUsd/);
    const receiptRoute = readFileSync('app/api/invoices/[id]/receipt/route.ts', 'utf8');
    assert.match(receiptRoute, /doc_type: 'receipt'/);
    assert.match(receiptRoute, /payment_id/);
    assert.match(receiptRoute, /existing: true/);
  });
});

describe('Jobs operations UI and permissions', () => {
  it('jobs page includes create invoice action, filters, and compact mobile table', () => {
    const source = readFileSync('components/jobs-list.tsx', 'utf8');
    assert.doesNotMatch(source, /billingCopy\.billingStatus/);
    assert.doesNotMatch(source, /jobs-billing-pill/);
    assert.match(source, /createInvoice/);
    assert.match(source, /jobs-operations-table/);
    assert.match(source, /jobs-mobile-table/);
    assert.match(source, /jobs-shell-minimal/);
    assert.match(source, /jobs-filter-tab/);
    assert.match(source, /jobs-menu-trigger/);
    assert.match(source, /canAccessFinancials/);
    assert.match(source, /period=today/);
    assert.match(source, /status=finished/);
    assert.match(source, /filter=unassigned/);
    assert.match(source, /missing_completion_date/);
    assert.match(source, /isAdminRole/);
    assert.match(source, /visibilitychange/);
    assert.match(source, /\/api\/exports\/jobs/);
  });

  it('job completion prompt only appears for managers with financial access', () => {
    const source = readFileSync('app/jobs/[id]/page.tsx', 'utf8');
    assert.match(source, /completionPrompt/);
    assert.match(source, /canAccessFinancials\(userRole, plan\) && isManagerRole\(userRole\)/);
    assert.match(source, /billingCopy\.createInvoice/);
    assert.match(source, /billingCopy\.createDraft/);
    assert.match(source, /billingCopy\.later/);
  });

  it('payment recorded prompt offers send receipt without auto-sending', () => {
    const source = readFileSync('components/outbound/outbound-document-list.tsx', 'utf8');
    assert.match(source, /paymentRecorded/);
    assert.match(source, /sendReceipt/);
    assert.match(source, /\/receipts\?/);
    assert.doesNotMatch(source, /\/send',\s*\{\s*method:\s*'POST'/);
  });

  it('localizes billing ops copy in English, Spanish, and Vietnamese', () => {
    for (const locale of ['en', 'es', 'vi'] as const) {
      const copy = getBillingOpsCopy(locale);
      assert.ok(copy.createInvoice);
      assert.ok(copy.sendReceipt);
      assert.ok(copy.notInvoiced);
      assert.ok(copy.receiptSent);
      assert.ok(copy.missingAmount);
      assert.ok(copy.existingInvoiceFound);
      assert.ok(copy.existingReceiptFound);
      if (locale !== 'en') {
        assert.notEqual(copy.createInvoice, getBillingOpsCopy('en').createInvoice);
        assert.notEqual(copy.notInvoiced, getBillingOpsCopy('en').notInvoiced);
      }
    }
  });

  it('receipts page exists and uses receipt outbound mode', () => {
    const source = readFileSync('app/receipts/page.tsx', 'utf8');
    assert.match(source, /docType="receipt"/);
    assert.match(source, /initialInvoiceId/);
    assert.match(source, /initialPaymentId/);
    assert.match(source, /canAccessFinancials/);
  });
});
