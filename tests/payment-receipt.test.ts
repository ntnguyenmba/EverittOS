import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPaymentReceiptView,
  buildReceiptNumber,
  formatReceiptPaidOn,
  resolveReceiptCustomer
} from '@/lib/payment-receipt';

describe('payment receipt formatting', () => {
  it('builds receipt numbers from payment ids', () => {
    assert.equal(buildReceiptNumber('8cdd9ac1-1234-5678-90ab-cdef01234567'), 'RCPT-8CDD9AC1');
  });

  it('formats paid-on dates in plain language', () => {
    assert.equal(formatReceiptPaidOn('2026-07-21T12:00:00.000Z'), 'Paid on July 21, 2026.');
  });
});

describe('payment receipt customer resolution', () => {
  it('prefers linked customer company_name and structured address', () => {
    const customer = resolveReceiptCustomer({
      linkedCustomer: {
        company_name: 'Haslet Home',
        email: 'owner@example.com',
        phone: '8175550100',
        address_line1: '1649 Dreamcatcher Dr',
        city: 'Haslet',
        state: 'TX',
        postal_code: '76052'
      },
      job: {
        customer_name: 'Job fallback name',
        phone: '0000000000',
        address: 'Job fallback address'
      }
    });

    assert.equal(customer.displayName, 'Haslet Home');
    assert.equal(customer.email, 'owner@example.com');
    assert.equal(customer.phone, '8175550100');
    assert.deepEqual(customer.addressLines, ['1649 Dreamcatcher Dr', 'Haslet, TX 76052']);
  });

  it('falls back to job customer fields when linked customer is missing', () => {
    const customer = resolveReceiptCustomer({
      linkedCustomer: null,
      job: {
        customer_name: 'Alex Rivera',
        phone: '2145550199',
        address: '100 Main St'
      }
    });

    assert.equal(customer.displayName, 'Alex Rivera');
    assert.equal(customer.phone, '2145550199');
    assert.deepEqual(customer.addressLines, ['100 Main St']);
    assert.equal(customer.email, null);
  });

  it('omits empty optional customer fields', () => {
    const view = buildPaymentReceiptView({
      payment: {
        id: 'abc12345-0000-0000-0000-000000000000',
        amount: 180,
        paidAt: '2026-07-21T12:00:00.000Z',
        paymentMethod: 'Zelle',
        paymentReference: null,
        source: 'job'
      },
      job: {
        title: 'Residential Cleaning',
        customer_name: null,
        phone: null,
        address: '1649 Dreamcatcher Dr'
      },
      linkedCustomer: null,
      outstanding: 0
    });

    assert.deepEqual(view.customerLines, ['1649 Dreamcatcher Dr']);
    assert.equal(view.customerLines.some((line) => /not provided/i.test(line)), false);
    assert.equal(
      view.receiptDetails.some((row) => /not provided/i.test(row.value)),
      false
    );
  });
});

describe('payment receipt details', () => {
  it('omits reference when missing and shows paid in full for zero balance', () => {
    const view = buildPaymentReceiptView({
      payment: {
        id: 'abc12345-0000-0000-0000-000000000000',
        amount: 180,
        paidAt: '2026-07-21T12:00:00.000Z',
        paymentMethod: 'Zelle',
        paymentReference: null,
        source: 'job'
      },
      job: { title: 'Residential Cleaning', customer_name: 'Alex' },
      outstanding: 0
    });

    assert.equal(view.amountPaidLabel, 'Amount received');
    assert.equal(view.amountPaidValue, '$180.00');
    assert.equal(view.paidOnLabel, 'Paid on July 21, 2026.');
    assert.equal(view.paidInFull, true);
    assert.equal(view.receiptDetails.some((row) => row.label === 'Reference'), false);
    assert.equal(view.receiptDetails.some((row) => row.label === 'Payment source'), false);
    assert.equal(view.receiptDetails.some((row) => row.label === 'Remaining balance'), false);
    assert.equal(view.receiptDetails.find((row) => row.label === 'Service')?.value, 'Residential Cleaning');
    assert.equal(view.receiptDetails.find((row) => row.label === 'Payment method')?.value, 'Zelle');
  });

  it('shows remaining balance when money is still owed', () => {
    const view = buildPaymentReceiptView({
      payment: {
        id: 'def45678-0000-0000-0000-000000000000',
        amount: 100,
        paidAt: '2026-07-10T12:00:00.000Z',
        paymentMethod: 'Cash',
        paymentReference: 'CHK-22',
        source: 'invoice'
      },
      job: { title: 'Move-out clean', customer_name: 'Jordan' },
      outstanding: 250,
      business: {
        companyName: 'Everitt Clean Co',
        phone: '8175550111',
        email: 'hello@example.com'
      }
    });

    assert.equal(view.paidInFull, false);
    assert.equal(view.businessName, 'Everitt Clean Co');
    assert.ok(view.businessLines.includes('8175550111'));
    assert.equal(view.receiptDetails.find((row) => row.label === 'Reference')?.value, 'CHK-22');
    assert.equal(view.receiptDetails.find((row) => row.label === 'Remaining balance')?.value, '$250.00');
    assert.equal(view.receiptDetails.some((row) => /direct job payment|invoice payment/i.test(row.value)), false);
  });

  it('supports both direct job and invoice payment sources without exposing them', () => {
    for (const source of ['job', 'invoice'] as const) {
      const view = buildPaymentReceiptView({
        payment: {
          id: 'aaa11111-0000-0000-0000-000000000000',
          amount: 50,
          paidAt: '2026-07-01T12:00:00.000Z',
          paymentMethod: 'Venmo',
          source
        },
        job: { title: 'Touch up', customer_name: 'Sam' },
        outstanding: 0
      });

      assert.equal(view.receiptNumber, 'RCPT-AAA11111');
      assert.equal(JSON.stringify(view).toLowerCase().includes('direct job payment'), false);
      assert.equal(JSON.stringify(view).toLowerCase().includes('invoice payment'), false);
    }
  });

  it('uses Customer when no customer identity exists', () => {
    const view = buildPaymentReceiptView({
      payment: {
        id: 'bbb22222-0000-0000-0000-000000000000',
        amount: 75,
        paidAt: '2026-07-02T12:00:00.000Z',
        paymentMethod: 'Check',
        source: 'job'
      },
      job: { title: 'Window clean' },
      outstanding: 25
    });

    assert.deepEqual(view.customerLines, ['Customer']);
  });
});
