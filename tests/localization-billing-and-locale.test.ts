import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolveApiError, getApiErrorMessage } from '@/lib/i18n/api-error-copy';
import {
  getBillingOpsCopy,
  localizedInvoiceBody,
  localizedInvoiceSubject,
  localizedReceiptSubject,
  invoiceDeliveryPaymentLabelLocalized
} from '@/lib/i18n/billing-ops-copy';
import { normalizeLocale } from '@/lib/i18n/config';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { formatMoneyUsd, localeTag } from '@/lib/i18n/locale-format';
import { getFeedbackLabels } from '@/lib/feedback-labels';
import { LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { defaultComposerFields } from '@/lib/outbound/types';

describe('locale persistence and billing localization', () => {
  it('persists locale through provider storage keys', () => {
    assert.equal(LOCALE_STORAGE_KEY, 'everittos_locale');
    assert.equal(LOCALE_COOKIE_NAME, 'everittos_locale');
    const provider = readFileSync('components/locale-provider.tsx', 'utf8');
    assert.match(provider, /LOCALE_STORAGE_KEY/);
    assert.match(provider, /localStorage\.setItem\(LOCALE_STORAGE_KEY/);
    assert.match(provider, /writeLocaleCookie/);
    const cookie = readFileSync('lib/i18n/cookie.ts', 'utf8');
    assert.match(cookie, /LOCALE_COOKIE_NAME/);
    assert.match(cookie, /document\.cookie/);
  });

  it('invalid locale falls back safely to English', () => {
    assert.equal(normalizeLocale('pt'), 'en');
    assert.equal(normalizeLocale(undefined), 'en');
    assert.equal(getBillingOpsCopy('xx').createInvoice, getBillingOpsCopy('en').createInvoice);
  });

  it('English, Spanish, and Vietnamese billing pages use localized copy', () => {
    for (const locale of ['en', 'es', 'vi'] as const) {
      const copy = getBillingOpsCopy(locale);
      assert.ok(copy.recordPayment);
      assert.ok(copy.savePayment);
      assert.ok(copy.paymentAmount);
      assert.ok(copy.paymentRecorded);
      assert.ok(copy.sendReceipt);
      assert.ok(copy.existingInvoiceFound);
      assert.ok(copy.existingReceiptFound);
      assert.ok(copy.outstandingBalances);
      assert.ok(copy.createInvoice);
      if (locale !== 'en') {
        assert.notEqual(copy.recordPayment, getBillingOpsCopy('en').recordPayment);
        assert.notEqual(copy.outstandingBalances, getBillingOpsCopy('en').outstandingBalances);
        assert.notEqual(copy.paymentRecorded, getBillingOpsCopy('en').paymentRecorded);
      }
    }
  });

  it('invoice default subject/body follow locale', () => {
    assert.match(localizedInvoiceSubject('en', 'Lawn care'), /Invoice for Lawn care/);
    assert.match(localizedInvoiceSubject('es', 'Lawn care'), /Factura por Lawn care/);
    assert.match(localizedInvoiceSubject('vi', 'Lawn care'), /Hóa đơn cho Lawn care/);
    assert.match(localizedInvoiceBody('es'), /Gracias/);
    assert.match(localizedInvoiceBody('vi'), /Cảm ơn/);
    assert.equal(defaultComposerFields('invoice', 'es').subject, getBillingOpsCopy('es').invoiceForCompletedWork);
    assert.equal(defaultComposerFields('invoice', 'vi').body, getBillingOpsCopy('vi').thankYouBusiness);
  });

  it('receipt default subject/body follow locale', () => {
    assert.equal(localizedReceiptSubject('es'), getBillingOpsCopy('es').paymentReceipt);
    assert.equal(defaultComposerFields('receipt', 'vi').subject, getBillingOpsCopy('vi').paymentReceipt);
    assert.equal(defaultComposerFields('receipt', 'es').body, getBillingOpsCopy('es').thankYouPaymentReceived);
  });

  it('payment form labels and recorded prompt follow locale', () => {
    const es = getBillingOpsCopy('es');
    assert.equal(es.paymentAmount, 'Monto del pago');
    assert.equal(es.paymentDate, 'Fecha de pago');
    assert.equal(es.paymentMethod, 'Método de pago');
    assert.equal(es.savePayment, 'Guardar pago');
    assert.equal(es.paymentRecorded, 'Pago registrado');
    assert.equal(es.sendReceipt, 'Enviar recibo');
    assert.equal(es.later, 'Más tarde');
  });

  it('duplicate invoice/receipt notices follow locale', () => {
    assert.notEqual(getBillingOpsCopy('es').existingInvoiceFound, getBillingOpsCopy('en').existingInvoiceFound);
    assert.notEqual(getBillingOpsCopy('vi').existingReceiptFound, getBillingOpsCopy('en').existingReceiptFound);
  });

  it('jobs table and export labels follow locale', () => {
    const jobs = readFileSync('components/jobs-list.tsx', 'utf8');
    assert.match(jobs, /copy\[locale\]/);
    assert.match(jobs, /getExportCopy/);
    assert.doesNotMatch(jobs, /Statuses refresh automatically/);
    const exportCopy = getExportCopy('es');
    assert.equal(exportCopy.export, 'Exportar');
    assert.notEqual(exportCopy.exportFailed, getExportCopy('en').exportFailed);
    assert.equal(getExportCopy('vi').privateCompanyRecord.includes('Private'), false);
  });

  it('portal pages keep locale-aware status and export wiring', () => {
    assert.match(readFileSync('app/portal/client/jobs/page.tsx', 'utf8'), /getExportCopy|useTranslation/);
    assert.match(readFileSync('app/portal/contractor/page.tsx', 'utf8'), /getExportCopy|useTranslation/);
    assert.match(readFileSync('lib/portal-status-i18n.ts', 'utf8'), /translatePortalJobStatus/);
  });

  it('no mixed English in Spanish/Vietnamese billing copy for required phrases', () => {
    const en = getBillingOpsCopy('en');
    for (const locale of ['es', 'vi'] as const) {
      const copy = getBillingOpsCopy(locale);
      assert.notEqual(copy.recordPayment, en.recordPayment);
      assert.notEqual(copy.createInvoice, en.createInvoice);
      assert.notEqual(copy.sendReceipt, en.sendReceipt);
      assert.notEqual(copy.outstandingBalances, en.outstandingBalances);
      assert.notEqual(copy.loadingPrefill, en.loadingPrefill);
      assert.notEqual(copy.nothingSentYet, en.nothingSentYet);
      assert.doesNotMatch(copy.createInvoice, /^Create invoice$/);
      assert.doesNotMatch(copy.recordPayment, /^Record payment$/);
    }
  });

  it('API error codes map to localized messages', () => {
    assert.equal(getApiErrorMessage('permission_denied', 'es'), getBillingOpsCopy('es').permissionDenied);
    assert.equal(getApiErrorMessage('enter_positive_payment', 'vi'), getBillingOpsCopy('vi').enterPositivePayment);
    assert.equal(resolveApiError({ error: 'Permission denied' }, 'es'), getBillingOpsCopy('es').permissionDenied);
    assert.equal(resolveApiError({ code: 'no_records' }, 'en'), getExportCopy('en').noRecords);
  });

  it('money formatting uses selected locale with USD', () => {
    assert.equal(localeTag('es'), 'es-US');
    assert.equal(localeTag('vi'), 'vi-VN');
    const en = formatMoneyUsd(12.5, 'en');
    const es = formatMoneyUsd(12.5, 'es');
    assert.match(en, /12\.50|\$12/);
    assert.ok(es.includes('12') || es.includes('12,50') || es.includes('12.50'));
  });

  it('feedback labels localize loading busy text', () => {
    assert.equal(getFeedbackLabels('en').loading, 'Working…');
    assert.notEqual(getFeedbackLabels('es').loading, getFeedbackLabels('en').loading);
    assert.notEqual(getFeedbackLabels('vi').saved, getFeedbackLabels('en').saved);
  });

  it('status labels localize delivery and payment states', () => {
    assert.equal(invoiceDeliveryPaymentLabelLocalized('es', { deliveryStatus: 'failed' }), getBillingOpsCopy('es').deliveryFailed);
    assert.equal(invoiceDeliveryPaymentLabelLocalized('vi', { paymentStatus: 'paid' }), getBillingOpsCopy('vi').paid);
  });

  it('outbound UI and prefill API pass locale', () => {
    assert.match(readFileSync('components/outbound/use-outbound-autosave.ts', 'utf8'), /locale/);
    assert.match(readFileSync('components/outbound/outbound-document-list.tsx', 'utf8'), /getBillingOpsCopy/);
    assert.match(readFileSync('components/outbound/outbound-hub.tsx', 'utf8'), /getBillingOpsCopy/);
    assert.match(readFileSync('app/api/outbound/prefill/route.ts', 'utf8'), /normalizeLocale/);
    assert.match(readFileSync('app/invoices/page.tsx', 'utf8'), /outstandingBalances/);
  });

  it('localization audit scripts exist', () => {
    assert.match(readFileSync('package.json', 'utf8'), /i18n:ui-audit/);
    assert.match(readFileSync('scripts/i18n-hardcoded-ui-audit.ts', 'utf8'), /STRICT_PHRASES/);
  });
});
