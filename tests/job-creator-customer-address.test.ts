import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  findMatchingCustomer,
  normalizeCustomerNameKey
} from '../lib/customer-find-or-create';
import { structuredAddressFromManual } from '../lib/address/parse-photon';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

test('manual address entry keeps typed value without selecting a suggestion', () => {
  const typed = '4827 Frances Ave, Oakland, CA';
  const manual = structuredAddressFromManual(typed);
  assert.equal(manual.formattedAddress, typed);
  assert.equal(manual.addressLine1, typed);
  assert.equal(manual.latitude, null);

  const source = read('components/address-autocomplete.tsx');
  assert.match(source, /structuredAddressFromManual\(next\)/);
  assert.match(source, /Manual text is always preserved/);
  assert.doesNotMatch(source, /onChange\('',\s*null\)/);
});

test('Enter key selects a suggestion only when one is highlighted', () => {
  const source = read('components/address-autocomplete.tsx');
  assert.match(source, /Only consume Enter when a suggestion is actively highlighted/);
  assert.match(source, /if \(activeIndex >= 0 && suggestions\[activeIndex\]\)/);
  assert.match(source, /event\.preventDefault\(\)/);
  // When nothing is highlighted, menu closes and Enter is not blocked for form submit.
  assert.match(source, /setOpen\(false\)/);
  assert.match(source, /setActiveIndex\(-1\)/);
});

test('address autocomplete leaves manual value intact on Escape and outside click', () => {
  const source = read('components/address-autocomplete.tsx');
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /mousedown/);
  assert.match(source, /setOpen\(false\)/);
  assert.match(source, /setActiveIndex\(-1\)/);
  // Empty/no-match results close the menu and never clear or replace typed text.
  assert.match(source, /setState\('empty'\)/);
  assert.match(source, /Manual text is always preserved/);
});
test('customer search includes contact name, property fields, and all company customers', () => {
  const source = read('app/api/customers/search/route.ts');
  assert.match(source, /contact_name\.ilike/);
  assert.match(source, /company_name\.ilike/);
  assert.match(source, /email\.ilike/);
  assert.match(source, /phone\.ilike/);
  assert.match(source, /service_address\.ilike/);
  assert.match(source, /property_address\.ilike/);
  assert.match(source, /name\.ilike/);
  assert.match(source, /formatted_address\.ilike/);
  assert.match(source, /address_line_1\.ilike/);
  assert.match(source, /Do not filter by pipeline stage or record type/);
  assert.doesNotMatch(source, /pipeline_stage\.eq/);
  assert.doesNotMatch(source, /record_type\.eq/);
  assert.match(source, /organization_id\.is\.null,user_id\.eq/);
});

test('searching by contact name matches Van Nguyen style records', () => {
  assert.equal(normalizeCustomerNameKey('Van Nguyen'), 'van nguyen');
  assert.equal(normalizeCustomerNameKey('  VAN   NGUYEN '), 'van nguyen');

  const source = read('app/api/customers/search/route.ts');
  assert.match(source, /contact_name\.ilike\.\$\{pattern\}/);
});

test('inactive or former customers are not excluded from search results', () => {
  const source = read('app/api/customers/search/route.ts');
  assert.doesNotMatch(source, /pipeline_stage\.(neq|eq|not)/);
  assert.doesNotMatch(source, /\.eq\(['"]pipeline_stage['"]/);
  assert.doesNotMatch(source, /\.neq\(['"]pipeline_stage['"]/);
  assert.match(source, /pipeline_stage: customer\.pipeline_stage/);
});

test('findMatchingCustomer reuses existing customer instead of duplicating', () => {
  const existing = [
    {
      id: 'c1',
      company_name: 'Van Nguyen',
      contact_name: 'Van Nguyen',
      email: 'van@example.com',
      phone: '(555) 010-1234',
      service_address: '10 Frances St'
    }
  ];

  assert.equal(
    findMatchingCustomer({ displayName: 'Someone Else', email: 'van@example.com' }, existing)?.id,
    'c1'
  );
  assert.equal(
    findMatchingCustomer({ displayName: 'Other', phone: '555-010-1234' }, existing)?.id,
    'c1'
  );
  assert.equal(
    findMatchingCustomer(
      { displayName: 'Van Nguyen', address: '10 Frances St' },
      existing
    )?.id,
    'c1'
  );
  assert.equal(
    findMatchingCustomer({ displayName: 'Van Nguyen' }, existing)?.id,
    'c1'
  );
  assert.equal(
    findMatchingCustomer(
      { displayName: 'Van Nguyen', address: '99 Other Rd' },
      existing
    ),
    null
  );
});

test('customer POST finds or creates with active customer defaults', () => {
  const source = read('app/api/customers/route.ts');
  assert.match(source, /findMatchingCustomer|findReusableCustomer/);
  assert.match(source, /reused: true/);
  assert.match(source, /record_type: recordType/);
  assert.match(source, /pipeline_stage: pipelineStage/);
  assert.match(source, /workspaceScopedFields/);
});

test('job creator auto-creates and links customer and primary property without partial jobs', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /\/api\/customers/);
  assert.match(source, /record_type: 'customer'/);
  assert.match(source, /pipeline_stage: 'active'/);
  assert.match(source, /address: address\.trim\(\) \|\| null/);
  assert.match(source, /forceNew: needsNewProperty/);
  assert.match(source, /newPropertyName\.trim\(\) \|\| 'Primary'/);
  assert.match(source, /\/api\/customers\/\$\{customerId\}\/properties/);
  assert.match(source, /Fail before creating the job/);
  assert.match(source, /Unable to prepare customer\/property/);
  assert.match(source, /customer_id: customerId/);
  assert.match(source, /property_id: propertyId/);
  // Property/customer failures must return before /api/jobs or recurring create.
  const prepareCatch = source.indexOf('Unable to prepare customer/property');
  const jobsPost = source.indexOf("fetch('/api/jobs'");
  const recurringPost = source.indexOf("fetch('/api/recurring-jobs'");
  assert.ok(prepareCatch > 0);
  assert.ok(jobsPost > prepareCatch);
  assert.ok(recurringPost > prepareCatch);
});

test('job creator keeps property name free text and service address editable', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /htmlFor="property-name"/);
  assert.match(source, /label="Service address"/);
  assert.match(source, /AddressAutocomplete/);
  assert.match(source, /placeholder="Primary"/);
});
