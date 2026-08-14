import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { matchesInvoicePaymentFilter, parseInvoicePaymentFilter } from '@/lib/exports/business-export-data';
import { parseDashboardRange } from '@/lib/exports/dashboard-export-data';
import { buildCsv, exportFilename } from '@/lib/exports/csv';
import { buildPdfReportHtml } from '@/lib/exports/pdf-report';
import { buildExportAttachment, renderExportHttp } from '@/lib/exports/prepared';
import {
  parseExportResource,
  sanitizeExportQuery
} from '@/lib/exports/resources';
import { getExportCopy } from '@/lib/i18n/export-copy';

describe('business data export and email sharing', () => {
  it('maps allowlisted endpoints and strips identity query keys', () => {
    assert.equal(parseExportResource('/api/exports/expenses'), 'expenses');
    assert.equal(parseExportResource('/api/exports/portal/client/jobs?format=csv'), 'portal-client-jobs');
    assert.equal(parseExportResource('/api/exports/secret'), null);

    const filtered = sanitizeExportQuery(
      'expenses',
      new URLSearchParams(
        'from=2026-08-01&to=2026-08-31&category=Fuel&jobId=j1&customerId=c1&workerId=w1&q=oil&userId=attacker&organizationId=other'
      )
    );
    assert.equal(filtered.get('from'), '2026-08-01');
    assert.equal(filtered.get('workerId'), 'w1');
    assert.equal(filtered.get('userId'), null);
    assert.equal(filtered.get('organizationId'), null);

    const portal = sanitizeExportQuery(
      'portal-contractor-jobs',
      new URLSearchParams('workerId=other&contractorId=x&userId=y&format=csv')
    );
    assert.equal(portal.toString(), '');

    const client = sanitizeExportQuery(
      'portal-client-jobs',
      new URLSearchParams('range=month&customerId=other&userId=x')
    );
    assert.equal(client.get('range'), 'month');
    assert.equal(client.get('customerId'), null);
  });

  it('invoice payment filters match the invoices page', () => {
    assert.equal(parseInvoicePaymentFilter('unpaid'), 'unpaid');
    assert.equal(parseInvoicePaymentFilter('nope'), 'all');
    assert.equal(
      matchesInvoicePaymentFilter({ amount: 100, amount_paid: 20, payment_status: 'sent' }, 'unpaid'),
      true
    );
    assert.equal(
      matchesInvoicePaymentFilter({ amount: 100, amount_paid: 100, payment_status: 'paid' }, 'unpaid'),
      false
    );
    assert.equal(
      matchesInvoicePaymentFilter(
        { amount: 80, amount_paid: 0, payment_status: 'sent', due_date: '2020-01-01' },
        'overdue'
      ),
      true
    );
  });

  it('dashboard export uses the active period', () => {
    assert.equal(parseDashboardRange('week'), 'week');
    assert.equal(parseDashboardRange('nope', 'month'), 'month');
  });

  it('CSV and PDF attachments do not include print scripts or signed URLs', () => {
    const copy = getExportCopy('en');
    const prepared = {
      filenamePrefix: 'expenses',
      title: copy.expensesTitle,
      companyName: 'Everitt Ventures',
      appliedFilters: ['from=2026-08-01'],
      privateLabel: copy.privateCompanyRecord,
      summary: [{ label: copy.totalLabel, value: '12.50' }],
      headers: ['Date', 'Amount'],
      rows: [['2026-08-01', '12.50']]
    };
    const csv = buildExportAttachment(prepared, 'csv', copy);
    assert.match(csv.filename, /^everittos-expenses-\d{4}-\d{2}-\d{2}\.csv$/);
    assert.equal(csv.contentType.includes('csv'), true);
    const csvText = Buffer.from(csv.content, 'base64').toString('utf8');
    assert.match(csvText, /Date/);
    assert.match(csvText, /12\.50/);

    const pdf = buildExportAttachment(prepared, 'pdf', copy);
    assert.match(pdf.filename, /\.html$/);
    const html = Buffer.from(pdf.content, 'base64').toString('utf8');
    assert.match(html, /Everitt Ventures/);
    assert.match(html, /2026-08-01/);
    assert.doesNotMatch(html, /window\.print/);
    assert.doesNotMatch(html, /signedUrl|receipt_signed_url/);

    const printable = buildPdfReportHtml({
      companyName: 'Everitt Ventures',
      title: copy.expensesTitle,
      generatedLabel: copy.generatedOn,
      generatedAt: '2026-08-14T12:00:00Z',
      filtersLabel: copy.appliedFilters,
      filters: 'from=2026-08-01',
      pageLabel: copy.page,
      privateLabel: copy.privateCompanyRecord,
      sections: [{ headers: ['Date', 'Amount'], rows: [['2026-08-01', '12.50']] }],
      autoPrint: true
    });
    assert.match(printable, /window\.print/);
  });

  it('empty prepared export returns 422', async () => {
    const copy = getExportCopy('es');
    const response = renderExportHttp(
      {
        filenamePrefix: 'jobs',
        title: copy.jobsFinancialTitle,
        companyName: 'EverittOS',
        appliedFilters: [],
        headers: ['Job'],
        rows: []
      },
      'csv',
      copy
    );
    assert.equal(response.status, 422);
    const json = (await response.json()) as { code?: string };
    assert.equal(json.code, 'no_records');
  });

  it('share API generates attachments server-side and never trusts client rows', () => {
    const share = readFileSync('app/api/exports/share/route.ts', 'utf8');
    assert.match(share, /sendPreparedExportEmail/);
    assert.match(share, /sanitizeExportQuery/);
    assert.match(share, /resolvePreparedExport/);
    assert.doesNotMatch(share, /body\.rows|input\.rows|clientRows/);

    const sender = readFileSync('lib/exports/share-export.ts', 'utf8');
    assert.match(sender, /sendTransactionalEmail/);
    assert.match(sender, /attachments/);
    assert.match(sender, /isValidEmail/);
    assert.doesNotMatch(sender, /createSignedUrl|receipt_signed_url/);
  });

  it('business pages reuse ExportMenu without a second custom export UI', () => {
    const pages: Array<[string, string]> = [
      ['app/expenses/page.tsx', '/api/exports/expenses'],
      ['app/customers/page.tsx', '/api/exports/customers'],
      ['app/invoices/page.tsx', '/api/exports/invoices'],
      ['app/receipts/page.tsx', '/api/exports/payments'],
      ['app/contractor-pay/page.tsx', '/api/exports/contractor-pay'],
      ['components/dashboard-revenue-snapshot.tsx', '/api/exports/dashboard'],
      ['app/dashboard/details/page.tsx', '/api/exports/dashboard-details'],
      ['app/bookkeeping/page.tsx', '/api/exports/bookkeeping'],
      ['app/jobs/page.tsx', '/api/exports/jobs'],
      ['app/people/page.tsx', '/api/exports/team'],
      ['app/portal/client/jobs/page.tsx', '/api/exports/portal/client/jobs'],
      ['app/portal/contractor/page.tsx', '/api/exports/portal/contractor/jobs']
    ];
    for (const [path, endpoint] of pages) {
      const source = readFileSync(path, 'utf8');
      assert.match(source, /ExportMenu/);
      assert.match(source, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.doesNotMatch(readFileSync('app/customers/page.tsx', 'utf8'), /exportExcel|everittos-customers\.xls/);
    assert.match(readFileSync('app/expenses/page.tsx', 'utf8'), /filterFrom|filterTo|filterCategory/);
    assert.match(readFileSync('app/jobs/page.tsx', 'utf8'), /exportQuery/);
    assert.match(readFileSync('components/dashboard-revenue-snapshot.tsx', 'utf8'), /query=\{\{\s*range\s*\}\}/);
  });

  it('finance exports stay behind requireFinanceApiAccess', () => {
    const source = readFileSync('lib/exports/resolve-export.ts', 'utf8');
    assert.match(source, /requireFinanceApiAccess/);
    assert.match(source, /loadExpensesExport/);
    assert.match(source, /loadInvoicesExport/);
    assert.match(source, /loadPaymentsExport/);
    assert.match(source, /loadContractorPayExport/);
    assert.match(source, /loadDashboardExport/);
    assert.match(source, /isManagerRole/);
    assert.doesNotMatch(readFileSync('lib/exports/business-export-data.ts', 'utf8'), /receipt_signed_url|receipt_url/);
  });

  it('CSV quoting still works for exported notes', () => {
    const csv = buildCsv(['Notes'], [['line1\nline2, "quoted"']]);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.match(csv, /"line1\nline2, ""quoted"""/);
    assert.equal(exportFilename('invoices', 'pdf').endsWith('.pdf'), true);
  });
});
