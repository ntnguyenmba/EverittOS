import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCustomerUpdatePayload,
  buildCustomerWritePayload,
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
  assert.equal(payload.record_type, 'lead');
});

test('buildCustomerUpdatePayload maps displayName to company_name', () => {
  const payload = buildCustomerUpdatePayload({ displayName: 'Updated label' });
  assert.deepEqual(payload, { company_name: 'Updated label', name: 'Updated label' });
});
