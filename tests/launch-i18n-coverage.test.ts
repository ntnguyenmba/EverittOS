import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';
import {
  customerStageLabel,
  getCustomerLifecycleCopy
} from '@/lib/i18n/customer-lifecycle-copy';
import { getReceiptCopy } from '@/lib/i18n/receipt-copy';
import { normalizeLocale } from '@/lib/i18n/config';

test('dashboard finance copy covers required metric titles in every locale', () => {
  for (const locale of ['en', 'es', 'vi'] as const) {
    const copy = getDashboardFinanceCopy(locale);
    assert.equal(copy.metricTitles.collected.length > 0, true);
    assert.equal(copy.ranges.month.length > 0, true);
    assert.equal(copy.details.empty.length > 0, true);
    assert.equal(copy.contractorPayPage.title.length > 0, true);
    assert.equal(copy.money.expectedRevenue.length > 0, true);
    assert.equal(copy.money.cashAfterCosts.length > 0, true);
    assert.equal(copy.overview.moreDetails.length > 0, true);
    assert.doesNotMatch(copy.details.empty, /dashboard\./);
    assert.doesNotMatch(copy.money.cashAfterCosts, /net cash/i);
  }
});

test('customer lifecycle stage labels translate and fall back cleanly', () => {
  assert.equal(customerStageLabel('active', 'en'), 'Active');
  assert.equal(customerStageLabel('past', 'es'), 'Anterior');
  assert.equal(customerStageLabel('archived', 'vi'), 'Đã lưu trữ');
  assert.equal(getCustomerLifecycleCopy('es').filters.leads, 'Prospectos');
  assert.equal(getCustomerLifecycleCopy('en').filters.leads, 'Leads');
  assert.equal(normalizeLocale('pt'), 'en');
});

test('receipt copy never returns raw translation keys', () => {
  for (const locale of ['en', 'es', 'vi'] as const) {
    const copy = getReceiptCopy(locale);
    assert.equal(copy.title.includes('.'), false);
    assert.equal(copy.thankYou.includes('receipt.'), false);
  }
});
