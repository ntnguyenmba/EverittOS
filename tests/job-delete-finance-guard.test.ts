import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('permanent job deletion preserves posted invoices and payments only', () => {
  const migration = read('supabase/migrations/202609050001_allow_job_expense_cascade_delete.sql');

  assert.match(migration, /from public\\.invoices/i);
  assert.match(migration, /from public\\.job_payments/i);
  assert.match(migration, /delete from public\\.expenses/i);
  assert.match(migration, /delete from public\\.job_labor/i);
  assert.match(migration, /invoices or payments cannot be permanently deleted/i);

  const guardPosition = migration.indexOf('if v_has_posted_finance then');
  const seriesEndPosition = migration.indexOf("status = 'ended'");
  assert.ok(guardPosition >= 0);
  assert.ok(seriesEndPosition > guardPosition, 'series must not be ended before finance guard passes');
});

test('delete preflight exposes finance-safe decision without mutating records', () => {
  const route = read('app/api/jobs/[id]/delete-check/route.ts');

  assert.match(route, /requireManager:\\s*true/);
  assert.match(route, /canPermanentlyDelete/);
  assert.match(route, /hasFinancialHistory/);
  assert.match(route, /invoices/);
  assert.match(route, /payments/);
  assert.match(route, /labor/);
  assert.match(route, /expenses/);
  assert.doesNotMatch(route, /\\.delete\\(/);
  assert.doesNotMatch(route, /\\.update\\(/);
});
