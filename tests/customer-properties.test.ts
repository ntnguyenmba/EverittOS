import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  buildPropertyWritePayload,
  normalizePropertyType,
  propertyDisplayAddress,
  stripSensitivePropertyFields
} from '../lib/customer-property';
import {
  buildCustomerImportTemplateCsv,
  detectImportDuplicates,
  parseCustomerImportCsv
} from '../lib/customer-import';

test('normalizePropertyType maps known and unknown values', () => {
  assert.equal(normalizePropertyType('Airbnb'), 'airbnb');
  assert.equal(normalizePropertyType('warehouse'), 'other');
});

test('buildPropertyWritePayload stores structured address and defaults', () => {
  const payload = buildPropertyWritePayload({
    name: 'Lakehouse',
    property_type: 'rental',
    address: {
      formattedAddress: '100 Lake Rd, Austin, TX 78701',
      addressLine1: '100 Lake Rd',
      addressLine2: 'Unit 2',
      city: 'Austin',
      county: 'Travis',
      state: 'Texas',
      stateCode: 'TX',
      postalCode: '78701',
      country: 'United States',
      countryCode: 'US',
      latitude: 30.27,
      longitude: -97.74
    },
    timezone: 'America/Chicago',
    is_primary: true
  });

  assert.equal(payload.name, 'Lakehouse');
  assert.equal(payload.property_type, 'rental');
  assert.equal(payload.city, 'Austin');
  assert.equal(payload.state_code, 'TX');
  assert.equal(payload.timezone, 'America/Chicago');
  assert.equal(payload.is_primary, true);
});

test('propertyDisplayAddress prefers formatted address', () => {
  assert.equal(
    propertyDisplayAddress({ formatted_address: '1 Main', address_line_1: 'ignored', city: 'Austin' }),
    '1 Main'
  );
});

test('stripSensitivePropertyFields hides codes from unauthorized viewers', () => {
  const stripped = stripSensitivePropertyFields(
    {
      id: 'p1',
      gate_code: '1234',
      lockbox_code: '9999',
      access_instructions: 'Side door',
      internal_notes: 'vip'
    },
    false
  );
  assert.equal(stripped.gate_code, null);
  assert.equal(stripped.lockbox_code, null);
  assert.equal(stripped.internal_notes, null);
  assert.match(String(stripped.access_instructions), /managers/i);
});

test('CSV import parses rows and flags validation errors', () => {
  const csv = `customer_name,email,phone,property_name,property_type,address,city,state,zip,country,notes
Jane,jane@example.com,555-0100,Home,home,1 Main St,Austin,TX,78701,US,hello
,bad-email,,,office,,,,,,`;
  const parsed = parseCustomerImportCsv(csv);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].errors.length, 0);
  assert.ok(parsed.rows[1].errors.some((error) => /required/i.test(error)));
});

test('CSV duplicate detection matches email phone and address', () => {
  const parsed = parseCustomerImportCsv(`customer_name,email,phone,address,city,state,zip
Jane,jane@example.com,5550100,1 Main St,Austin,TX,78701
Bob,other@example.com,5559999,9 Other,Austin,TX,78702`);
  const rows = detectImportDuplicates(parsed.rows, [
    { id: 'c1', email: 'jane@example.com', phone: null, address_line1: null },
    { id: 'c2', email: null, phone: '555-9999', address_line1: null }
  ]);
  assert.equal(rows[0].duplicateOfCustomerId, 'c1');
  assert.equal(rows[1].duplicateOfCustomerId, 'c2');
});

test('CSV template includes expected headers', () => {
  const template = buildCustomerImportTemplateCsv();
  assert.match(template, /customer_name/);
  assert.match(template, /property_type/);
  assert.match(template, /zip/);
});

test('properties migration is present and idempotent-safe', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/202609260001_customer_properties_service_locations.sql'),
    'utf8'
  );
  assert.match(sql, /create table if not exists|alter table public\.customer_properties/i);
  assert.match(sql, /add column if not exists timezone/);
  assert.match(sql, /customer_properties_select/);
  assert.match(sql, /is_assigned_to_job/);
  assert.match(sql, /notify pgrst, 'reload schema'/);
});
