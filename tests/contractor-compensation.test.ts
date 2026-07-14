import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatContractorCompensationLabel,
  laborCostFromHourlyRate,
  normalizeContractorClassification,
  parseHourlyRateInput
} from '@/lib/contractor-compensation';

test('parseHourlyRateInput treats blank as null', () => {
  assert.deepEqual(parseHourlyRateInput(''), { ok: true, value: null });
  assert.deepEqual(parseHourlyRateInput('   '), { ok: true, value: null });
  assert.deepEqual(parseHourlyRateInput(null), { ok: true, value: null });
});

test('parseHourlyRateInput preserves zero values', () => {
  assert.deepEqual(parseHourlyRateInput('0'), { ok: true, value: 0 });
  assert.deepEqual(parseHourlyRateInput('0.00'), { ok: true, value: 0 });
  assert.deepEqual(parseHourlyRateInput(0), { ok: true, value: 0 });
});

test('parseHourlyRateInput accepts positive decimals', () => {
  assert.deepEqual(parseHourlyRateInput('25'), { ok: true, value: 25 });
  assert.deepEqual(parseHourlyRateInput('25.5'), { ok: true, value: 25.5 });
});

test('parseHourlyRateInput rejects negative and invalid values', () => {
  assert.equal(parseHourlyRateInput('-1').ok, false);
  assert.equal(parseHourlyRateInput('abc').ok, false);
  assert.equal(parseHourlyRateInput(Number.NaN).ok, false);
});

test('normalizeContractorClassification defaults legacy values to contractor', () => {
  assert.equal(normalizeContractorClassification(null), 'contractor');
  assert.equal(normalizeContractorClassification(undefined), 'contractor');
  assert.equal(normalizeContractorClassification(''), 'contractor');
  assert.equal(normalizeContractorClassification('owner_operator'), 'owner_operator');
});

test('formatContractorCompensationLabel shows zero owner compensation', () => {
  assert.equal(
    formatContractorCompensationLabel({ classification: 'owner_operator', hourlyRate: 0 }),
    '$0.00/hr · Owner'
  );
});

test('formatContractorCompensationLabel shows owner without entered compensation', () => {
  assert.equal(
    formatContractorCompensationLabel({ classification: 'owner_operator', hourlyRate: null }),
    'Owner · Compensation not entered'
  );
});

test('formatContractorCompensationLabel shows contractor hourly rate', () => {
  assert.equal(
    formatContractorCompensationLabel({ classification: 'contractor', hourlyRate: 25 }),
    '$25.00/hr'
  );
});

test('formatContractorCompensationLabel shows contractor missing rate', () => {
  assert.equal(
    formatContractorCompensationLabel({ classification: 'contractor', hourlyRate: null }),
    'Rate not entered'
  );
});

test('laborCostFromHourlyRate keeps zero compensation at zero', () => {
  assert.equal(laborCostFromHourlyRate(0, 4), 0);
  assert.equal(laborCostFromHourlyRate(null, 4), 0);
  assert.equal(laborCostFromHourlyRate(25, 2), 50);
});
