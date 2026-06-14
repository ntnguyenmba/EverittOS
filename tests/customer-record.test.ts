import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCustomerUpdatePayload,
  buildCustomerWritePayload,
  customerDisplayAddress,
  customerDisplayName
} from '../lib/customer-record';

test('customerDisplayName prefers company_name', () => {
  assert.equal(customerDisplayName({ company_name: 'Acme Co', email: 'a@b.com' }), 'Acme Co');
});

test('customerDisplayName falls back to email then phone', () => {
  assert.equal(customerDisplayName({ email: 'a@b.com' }), 'a@b.com');
  assert.equal(customerDisplayName({ phone: '555-0100' }), '555-0100');
  assert.equal(customerDisplayName({}), 'Unnamed contact');
});

test('customerDisplayAddress prefers service_address', () => {
  assert.equal(
    customerDisplayAddress({ service_address: '100 Main St', city: 'Austin' }),
    '100 Main St'
  );
});

test('customerDisplayAddress joins structured fields', () => {
  assert.equal(
    customerDisplayAddress({ address_line1: '100 Main St', city: 'Austin', state: 'TX' }),
    '100 Main St, Austin, TX'
  );
});

test('buildCustomerWritePayload uses company_name', () => {
  const payload = buildCustomerWritePayload({
    displayName: 'Riverfront',
    email: 'ops@example.com',
    record_type: 'lead',
    pipeline_stage: 'lead',
    lead_source: 'manual'
  });
  assert.equal(payload.company_name, 'Riverfront');
  assert.equal(payload.name, 'Riverfront');
  assert.equal(payload.address_line1, undefined);
  assert.equal(payload.record_type, 'lead');
});

test('buildCustomerWritePayload maps address to address_line1', () => {
  const payload = buildCustomerWritePayload({ displayName: 'Acme', address: '100 Main St' });
  assert.equal(payload.address_line1, '100 Main St');
  assert.equal(payload.service_address, '100 Main St');
});

test('buildCustomerUpdatePayload maps displayName to company_name', () => {
  const payload = buildCustomerUpdatePayload({ displayName: 'Updated label' });
  assert.deepEqual(payload, { company_name: 'Updated label', name: 'Updated label', full_name: 'Updated label' });
});
