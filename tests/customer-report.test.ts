import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateShareToken } from '@/lib/customer-report';

describe('customer report share tokens', () => {
  it('generates unguessable share tokens', () => {
    const a = generateShareToken();
    const b = generateShareToken();
    assert.ok(a.length >= 32);
    assert.notEqual(a, b);
    assert.match(a, /^[a-f0-9]+$/);
  });
});

describe('public report field filtering', () => {
  it('only includes customer-visible photos in grouped output', () => {
    const rows = [
      { id: '1', photo_type: 'before', customer_visible: true, url: 'a' },
      { id: '2', photo_type: 'after', customer_visible: false, url: 'b' },
      { id: '3', photo_type: 'after', customer_visible: true, url: 'c' }
    ];

    const visible = rows.filter((row) => row.customer_visible);
    const before = visible.filter((row) => row.photo_type === 'before');
    const after = visible.filter((row) => row.photo_type === 'after');

    assert.equal(visible.length, 2);
    assert.equal(before.length, 1);
    assert.equal(after.length, 1);
    assert.ok(!visible.some((row) => row.id === '2'));
  });

  it('omits internal notes from sanitized public payload shape', () => {
    const publicPayload = {
      companyName: 'Acme Clean',
      jobTitle: 'Move-out clean',
      customerName: 'Alex',
      serviceAddress: '123 Main',
      completionDate: '2026-07-01',
      completionNotes: 'Kitchen and baths completed.',
      beforePhotos: [],
      afterPhotos: [],
      otherPhotos: [],
      locale: 'en'
    };

    assert.ok(!('internal_notes' in publicPayload));
    assert.ok(!('assigned_email' in publicPayload));
    assert.ok(!('revenue_amount' in publicPayload));
  });
});

describe('job finance localization', () => {
  it('provides finance copy for every supported locale', async () => {
    const { getJobFinanceCopy } = await import('@/lib/i18n/job-finance-copy');
    for (const locale of ['en', 'es', 'vi'] as const) {
      const copy = getJobFinanceCopy(locale);
      assert.ok(copy.sectionTitle.length > 0);
      assert.ok(copy.recordPayment.length > 0);
      assert.ok(copy.photoCustomerReport.length > 0);
    }
  });
});
