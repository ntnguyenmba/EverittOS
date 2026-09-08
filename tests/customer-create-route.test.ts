import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const newCustomerPage = readFileSync('app/customers/new/page.tsx', 'utf8');
const customerForm = readFileSync('components/customer-create-form.tsx', 'utf8');
const customerList = readFileSync('app/customers/page.tsx', 'utf8');

test('new customer route renders without client-side auth or workspace setup', () => {
  assert.doesNotMatch(newCustomerPage, /supabase|useEffect|ensureWorkspaceForSave|useTeamOptions/);
  assert.match(newCustomerPage, /<CustomerCreateForm \/>/);
});

test('customer form saves through the server API and always unlocks', () => {
  assert.doesNotMatch(customerForm, /supabase\.auth|ensureWorkspaceForSave|useTeamOptions/);
  assert.match(customerForm, /fetchWithTimeout\('\/api\/customers'/);
  assert.match(customerForm, /finally\s*{\s*setSaving\(false\)/);
});

test('add customer uses normal Next navigation', () => {
  assert.match(customerList, /href="\/customers\/new"/);
  assert.doesNotMatch(customerList, /window\.location\.assign\('\/customers\/new'\)/);
});
