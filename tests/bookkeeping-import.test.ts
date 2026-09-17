import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildBookkeepingImportTemplateCsv, detectBookkeepingImportDuplicates, parseBookkeepingImportCsv } from '@/lib/bookkeeping-import';

describe('bookkeeping CSV parsing', () => {
  it('parses aliases, BOM, quoted commas, escaped quotes, dates, and accounting amounts', () => {
    const parsed = parseBookkeepingImportCsv('\uFEFFtransaction_type,transaction_date,total,description,vendor,note\nexpenses,9/16/26,"($1,234.50)","Fuel, tolls","ACME ""North""",Trip');
    assert.equal(parsed.fatalError, null);
    assert.deepEqual(parsed.rows[0], {
      rowNumber: 2, entryType: 'expense', entryDate: '2026-09-16', amount: 1234.5,
      title: 'Fuel, tolls', counterparty: 'ACME "North"', category: '', paymentMethod: '', notes: 'Trip',
      errors: [], duplicateKind: null, duplicateReason: null
    });
  });

  it('rejects an unclosed quoted field as malformed CSV', () => {
    const parsed = parseBookkeepingImportCsv('type,date,amount,name\nexpense,2026-09-16,10,"Supplies');
    assert.equal(parsed.fatalError, 'malformed_csv');
    assert.deepEqual(parsed.rows, []);
  });

  it('requires a data row and the type, date, and amount columns', () => {
    assert.equal(parseBookkeepingImportCsv('type,date,amount').fatalError, 'missing_rows');
    assert.equal(parseBookkeepingImportCsv('type,date,name\nexpense,2026-09-16,Supplies').fatalError, 'missing_required_columns');
  });

  it('returns localized validation keys for invalid fields and rejects impossible dates', () => {
    const parsed = parseBookkeepingImportCsv('type,date,amount\nother,2026-02-30,0');
    assert.deepEqual(parsed.rows[0].errors, ['invalid_type', 'invalid_date', 'invalid_amount']);
  });

  it('produces a template that parses without errors', () => {
    const parsed = parseBookkeepingImportCsv(buildBookkeepingImportTemplateCsv());
    assert.equal(parsed.fatalError, null);
    assert.deepEqual(parsed.rows[0].errors, []);
  });
});

describe('bookkeeping duplicate detection', () => {
  const csv = [
    'type,date,amount,name,counterparty',
    'expense,2026-09-16,45.25,Supplies,Home Depot',
    'cost,9/16/2026,$45.25,Other,  HOME   DEPOT  ',
    'expense,2026-09-16,45.25,Supplies,Lowes'
  ].join('\n');

  it('marks later matching rows in the same CSV while preserving the first row', () => {
    const rows = detectBookkeepingImportDuplicates(parseBookkeepingImportCsv(csv).rows, []);
    assert.equal(rows[0].duplicateKind, null);
    assert.equal(rows[1].duplicateKind, 'csv');
    assert.equal(rows[1].duplicateReason, 'matches_csv');
    assert.equal(rows[2].duplicateKind, null);
  });

  it('matches an existing EverittOS entry after normalizing type, date, amount, and counterparty', () => {
    const rows = detectBookkeepingImportDuplicates(parseBookkeepingImportCsv(csv).rows, [{
      entry_type: 'expense', entry_date: '2026-09-16', amount: '45.250', title: null, counterparty: 'home depot'
    }]);
    assert.equal(rows[0].duplicateKind, 'everittos');
    assert.equal(rows[0].duplicateReason, 'matches_existing');
    assert.equal(rows[2].duplicateKind, null);
  });

  it('does not classify invalid rows as duplicates', () => {
    const invalid = parseBookkeepingImportCsv('type,date,amount,name\nother,2026-09-16,10,Supplies').rows;
    const rows = detectBookkeepingImportDuplicates(invalid, [{ entry_type: null, entry_date: '2026-09-16', amount: 10, title: 'Supplies', counterparty: null }]);
    assert.equal(rows[0].duplicateKind, null);
  });
});

describe('bookkeeping import API and localization safeguards', () => {
  const route = readFileSync(join(process.cwd(), 'app/api/bookkeeping/import/route.ts'), 'utf8');

  it('requires manager access for the template and import endpoints', () => {
    assert.equal(route.match(/requireWorkspaceSession\(\{ requireManager: true \}\)/g)?.length, 2);
  });

  it('loads and creates entries only inside the active organization', () => {
    assert.match(route, /\.eq\('organization_id', ctx\.workspace\.organizationId\)/);
    assert.match(route, /insert\(\{ organization_id: ctx\.workspace\.organizationId/);
    assert.match(route, /created_by: ctx\.userId/);
  });

  it('limits server-side CSV size and imports a duplicate only after an explicit create decision', () => {
    assert.match(route, /Buffer\.byteLength\(csv, 'utf8'\) > MAX_CSV_BYTES/);
    assert.match(route, /decisions\[String\(row\.rowNumber\)\] === 'create' \? 'create' : 'skip'/);
    assert.doesNotMatch(route, /decisions\[String\(row\.rowNumber\)\] \|\| 'skip'/);
  });

  it('provides English, Spanish, and Vietnamese copy for every parser and API validation error', () => {
    const page = readFileSync(join(process.cwd(), 'app/bookkeeping/import/page.tsx'), 'utf8');
    for (const locale of ['en:', 'es:', 'vi:']) assert.match(page, new RegExp(`\\b${locale}`));
    for (const key of ['csv_required', 'csv_too_large', 'missing_rows', 'missing_required_columns', 'malformed_csv', 'invalid_type', 'invalid_date', 'invalid_amount']) {
      assert.equal((page.match(new RegExp(`${key}:`, 'g')) || []).length, 3, `${key} must be translated in all three locales`);
    }
  });
});
