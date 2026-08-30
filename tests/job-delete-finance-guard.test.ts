import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('permanent job deletion preserves financial history', () => {
  const migration = read('supabase/migrations/202610010002_guard_financial_job_deletion.sql');

  assert.match(migration, /from public\.invoices/i);
  assert.match(migration, /from public\.job_payments/i);
  assert.match(migration, /from public\.job_labor/i);
  assert.match(migration, /from public\.expenses/i);
  assert.match(migration, /cannot be permanently deleted/i);

  const guardPosition = migration.indexOf('if v_has_financial_history then');
  const seriesEndPosition = migration.indexOf("status = 'ended'");
  assert.ok(guardPosition >= 0);
  assert.ok(seriesEndPosition > guardPosition, 'series must not be ended before finance guard passes');
});

test('delete preflight exposes finance-safe decision without mutating records', () => {
  const route = read('app/api/jobs/[id]/delete-check/route.ts');

  assert.match(route, /requireManager:\s*true/);
  assert.match(route, /canPermanentlyDelete/);
  assert.match(route, /hasFinancialHistory/);
  assert.match(route, /invoices/);
  assert.match(route, /payments/);
  assert.match(route, /labor/);
  assert.match(route, /expenses/);
  assert.doesNotMatch(route, /\.delete\(/);
  assert.doesNotMatch(route, /\.update\(/);
});
