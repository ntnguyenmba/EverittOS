import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getJobFinanceCopy } from '@/lib/i18n/job-finance-copy';

describe('job finance copy', () => {
  it('uses a clear collected profit label', () => {
    assert.equal(getJobFinanceCopy('en').collectedProfit, 'Profit collected');
  });
});
