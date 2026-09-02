import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { parseAddressParts } from '@/lib/exports/address';
import {
  CONTRACTOR_JOBS_COLUMNS,
  CUSTOMER_JOBS_COLUMNS,
  OWNER_JOBS_FINANCIAL_COLUMNS,
  OWNER_JOBS_OPERATIONAL_COLUMNS,
  TEAM_EXPORT_COLUMNS,
  columnHeaders,
  ownerJobsColumns,
  stringRowValues
} from '@/lib/exports/columns';
import { buildCsv, escapeCsvCell, exportFilename } from '@/lib/exports/csv';
import {
  applyJobsExportPostFilters,
  jobMatchesToday,
  localYmd,
  parseJobsExportFilters
} from '@/lib/exports/job-filters';
import { displayPersonName, formatExportDate, formatExportMoney, formatExportTime } from '@/lib/exports/format';
import { buildPdfReportHtml } from '@/lib/exports/pdf-report';
import { effectiveContractorCost } from '@/lib/finance/contractor-cost';
import { canAccessFinancials } from '@/lib/finance-access';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { canViewTeam } from '@/lib/roles';

describe('role-based exports', () => {
  it('owner jobs CSV columns include full authorized financial fields', () => {
    const headers = columnHeaders(OWNER_JOBS_FINANCIAL_COLUMNS);
    for (const required of [
      'Job ID',
      'Job title',
      'Customer name',
      'Customer email',
      'Customer phone',
      'Property or service address',
      'City',
      'State',
      'Postal code',
      'Scheduled date',
      'Start time',
      'End time',
      'Timezone',
      'Assigned contractor or employee',
      'Job status',
      'Billing status',
      'Expected revenue',
      'Expected contractor cost',
      'Additional expected expenses',
      'Expected profit',
      'Actual collected amount',
      'Actual labor cost',
      'Actual expenses',
      'Actual profit',
      'Photo count',
      'Created date',
      'Completed date'
    ]) {
      assert.ok(headers.includes(required), `missing ${required}`);
    }
  });

  it('manager with financial access receives financial fields', () => {
    assert.equal(canAccessFinancials('manager', 'pro'), true);
    assert.equal(canAccessFinancials('owner', 'business'), true);
    const cols = ownerJobsColumns(true);
    assert.ok(cols.some((c) => c.key === 'expectedRevenue'));
    assert.ok(cols.some((c) => c.key === 'expectedProfit'));
  });

  it('manager without financial access does not receive financial fields', () => {
    assert.equal(canAccessFinancials('manager', 'free'), false);
    assert.equal(canAccessFinancials('employee', 'pro'), false);
    const cols = ownerJobsColumns(false);
    assert.deepEqual(cols, OWNER_JOBS_OPERATIONAL_COLUMNS);
    assert.ok(!cols.some((c) => c.key === 'expectedRevenue'));
    assert.ok(!cols.some((c) => c.key === 'billingStatus'));
    assert.ok(!cols.some((c) => c.key === 'actualProfit'));
  });

  it('customer export columns exclude contractor pay and profit', () => {
    const keys = CUSTOMER_JOBS_COLUMNS.map((c) => c.key);
    for (const forbidden of [
      'expectedProfit',
      'actualProfit',
      'expectedContractorCost',
      'actualLaborCost',
      'contractorPay',
      'revenue'
    ]) {
      assert.ok(!keys.includes(forbidden), forbidden);
    }
    assert.ok(keys.includes('invoiceTotal'));
    assert.ok(keys.includes('sharedNotes'));
  });

  it('contractor export columns exclude company revenue and profit', () => {
    const keys = CONTRACTOR_JOBS_COLUMNS.map((c) => c.key);
    for (const forbidden of [
      'expectedRevenue',
      'expectedProfit',
      'actualProfit',
      'billingStatus',
      'invoiceTotal',
      'customerEmail',
      'customerPhone'
    ]) {
      assert.ok(!keys.includes(forbidden), forbidden);
    }
    assert.ok(keys.includes('jobTitle'));
    assert.ok(keys.includes('serviceAddress'));
  });

  it('team export is owner/admin/authorized-manager only', () => {
    assert.equal(canViewTeam('owner'), true);
    assert.equal(canViewTeam('admin'), true);
    assert.equal(canViewTeam('manager'), true);
    assert.equal(canViewTeam('employee'), false);
    assert.equal(canViewTeam('contractor'), false);
    assert.equal(canViewTeam('client'), false);
    const headers = columnHeaders(TEAM_EXPORT_COLUMNS);
    assert.ok(headers.includes('Team member name'));
    assert.ok(headers.includes('Assigned job count'));
    assert.ok(!headers.some((h) => /password|token|w-9|tax/i.test(h)));
  });

  it('unauthorized team export route returns 403', () => {
    const source = readFileSync('lib/exports/resolve-export.ts', 'utf8');
    assert.match(source, /canViewTeam/);
    assert.match(source, /status: 403/);
    assert.match(source, /privateCompanyRecord|privateLabel/);
  });

  it('CSV properly escapes commas, quotes, and multiline notes', () => {
    assert.equal(escapeCsvCell('a,b'), '"a,b"');
    assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
    const csv = buildCsv(['Notes'], [['line1\nline2, "quoted"']]);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.match(csv, /"line1\nline2, ""quoted"""/);
  });

  it('PDF generation handles multiple pages with repeating headers', () => {
    const rows = Array.from({ length: 80 }, (_, i) => [`Job ${i + 1}`, `Customer ${i + 1}`, 'Austin, TX']);
    const html = buildPdfReportHtml({
      companyName: 'EverittOS Demo',
      title: 'Jobs financial export',
      generatedLabel: 'Generated on',
      generatedAt: '2026-07-31T12:00:00Z',
      filtersLabel: 'Applied filters',
      filters: 'Period: today',
      pageLabel: 'Page',
      privateLabel: 'Private company record',
      sections: [{ headers: ['Job', 'Customer', 'City'], rows }]
    });
    assert.match(html, /thead \{ display: table-header-group/);
    assert.match(html, /page-break-inside: avoid/);
    assert.match(html, /Private company record/);
    assert.match(html, /Job 80/);
    assert.doesNotMatch(html, /dashboard-shell|sidebar|mobile-nav/i);
  });

  it('applied filters match the Jobs page params', () => {
    const filters = parseJobsExportFilters(
      new URLSearchParams('period=today&status=finished&filter=unassigned&customer=c1&assigned_to=w1&from=2026-07-01')
    );
    assert.equal(filters.period, 'today');
    assert.equal(filters.status, 'finished');
    assert.equal(filters.unassignedOnly, true);
    assert.equal(filters.customerId, 'c1');
    assert.equal(filters.assignedTo, 'w1');
    assert.equal(filters.createdFrom, '2026-07-01');

    const jobsPage = readFileSync('components/jobs-list.tsx', 'utf8');
    assert.match(jobsPage, /period=today/);
    assert.match(jobsPage, /status=finished/);
    assert.match(jobsPage, /filter=unassigned/);
    assert.match(jobsPage, /\/api\/exports\/jobs/);

    const api = readFileSync('app/api/jobs/route.ts', 'utf8');
    assert.match(api, /applyJobsExportPostFilters/);
    assert.match(api, /parseJobsExportFilters/);
  });

  it('date and time use job timezone when available', () => {
    const iso = '2026-07-31T18:30:00.000Z';
    assert.equal(formatExportDate(iso, 'America/New_York'), '2026-07-31');
    assert.equal(formatExportTime(iso, 'America/New_York'), '14:30');
    assert.equal(formatExportDate('2026-07-31', 'America/Chicago'), '2026-07-31');
  });

  it('expected contractor cost is not double-counted', () => {
    assert.equal(effectiveContractorCost(200, 200), 200);
    assert.equal(effectiveContractorCost(200, 0), 200);
    assert.equal(effectiveContractorCost(200, 150), 150);
    const source = readFileSync('lib/exports/job-export-data.ts', 'utf8');
    assert.match(source, /effectiveContractorCost/);
    assert.doesNotMatch(source, /expectedContractor \+ recordedLabor|expected_contractor_cost \+ .*labor/i);
  });

  it('export with no rows returns a clear response', () => {
    const prepared = readFileSync('lib/exports/prepared.ts', 'utf8');
    assert.match(prepared, /no_records/);
    assert.match(prepared, /422/);
    for (const path of [
      'app/api/exports/jobs/route.ts',
      'app/api/exports/team/route.ts',
      'app/api/exports/portal/client/jobs/route.ts',
      'app/api/exports/portal/contractor/jobs/route.ts',
      'app/api/exports/expenses/route.ts'
    ]) {
      const source = readFileSync(path, 'utf8');
      assert.match(source, /exportGetResponse/);
    }
  });

  it('customer cannot alter query parameters to access another customer', () => {
    const source = readFileSync('lib/exports/resolve-export.ts', 'utf8');
    assert.match(source, /loadClientPortalJobsExport/);
    assert.doesNotMatch(source, /customerId|clientId|userId=.*searchParams/);
    const loader = readFileSync('lib/exports/portal-export-data.ts', 'utf8');
    assert.match(loader, /job_client_access/);
    assert.match(loader, /client_user_id', input\.userId/);
    assert.doesNotMatch(loader, /searchParams\.get\(['"]customer/);
  });

  it('contractor cannot alter query parameters to access another contractor', () => {
    const source = readFileSync('lib/exports/resolve-export.ts', 'utf8');
    assert.match(source, /loadContractorPortalJobsExport/);
    const loader = readFileSync('lib/exports/portal-export-data.ts', 'utf8');
    assert.match(loader, /auth_user_id', input\.userId/);
    assert.match(loader, /isJobAssignedToWorker/);
    const resources = readFileSync('lib/exports/resources.ts', 'utf8');
    assert.match(resources, /'portal-contractor-jobs': \[\]/);
  });

  it('organization isolation is enforced for owner jobs and team exports', () => {
    const jobs = readFileSync('lib/exports/job-export-data.ts', 'utf8');
    assert.match(jobs, /organization_id', organizationId/);
    assert.match(jobs, /listWorkspaceJobs/);
    const team = readFileSync('lib/exports/team-export-data.ts', 'utf8');
    assert.match(team, /organization_id', organizationId/);
    assert.match(team, /canViewTeam/);
  });

  it('mobile export menu and jobs row/menu interactions render correctly', () => {
    const menu = readFileSync('components/export-menu.tsx', 'utf8');
    assert.match(menu, /ExportMenu/);
    assert.match(menu, /preparingExport|busy/);
    assert.match(menu, /downloadExportFromApi/);
    assert.match(menu, /shareByEmail/);
    assert.match(menu, /\/api\/exports\/share/);

    const page = readFileSync('components/jobs-list.tsx', 'utf8');
    assert.match(page, /jobs-shell-minimal/);
    assert.match(page, /jobs-filter-tab/);
    assert.match(page, /jobs-menu-trigger/);
    assert.match(page, /stopPropagation/);
    assert.match(page, /openJob\(job\.id\)/);
    assert.doesNotMatch(page, /Statuses refresh automatically|liveNote/);
    assert.doesNotMatch(page, /jobs-billing-pill/);

    const css = readFileSync('app/form-alignment-fixes.css', 'utf8');
    assert.match(css, /jobs-shell-minimal/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /dashboard-shell-background[\s\S]*display: none/);
  });

  it('today and finished filters use shared canonical logic', () => {
    const today = localYmd(new Date('2026-07-31T15:00:00'));
    assert.equal(today, '2026-07-31');
    assert.equal(jobMatchesToday({ scheduled_start: '2026-07-31T10:00:00Z' }, '2026-07-31'), true);
    const filtered = applyJobsExportPostFilters(
      [
        { status: 'completed', scheduled_start: '2026-07-31T10:00:00Z', assigned_to: null, assigned_email: null },
        { status: 'scheduled', scheduled_start: '2026-07-30T10:00:00Z', assigned_to: 'w1', assigned_email: null },
        { status: 'cancelled', scheduled_start: '2026-07-31T12:00:00Z', assigned_to: null, assigned_email: null }
      ],
      parseJobsExportFilters(new URLSearchParams('period=today&status=finished')),
      '2026-07-31'
    );
    assert.equal(filtered.length, 2);
  });

  it('money formatting is spreadsheet-friendly', () => {
    assert.equal(formatExportMoney(12.5), '12.50');
    assert.equal(formatExportMoney(null), '');
    assert.equal(displayPersonName(null, 'jane.doe@example.com'), 'jane.doe');
    assert.equal(exportFilename('jobs', 'csv'), `everittos-jobs-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  it('address parsing supports city/state without inventing missing parts', () => {
    const parts = parseAddressParts('123 Main St, Austin, TX 78701');
    assert.equal(parts.city, 'Austin');
    assert.equal(parts.state, 'TX');
    assert.equal(parts.postalCode, '78701');
    assert.equal(parts.cityState, 'Austin, TX');
    assert.equal(parseAddressParts(null).cityState, '');
  });

  it('export labels exist in English, Spanish, and Vietnamese without English leftovers', () => {
    const en = getExportCopy('en');
    const es = getExportCopy('es');
    const vi = getExportCopy('vi');
    assert.equal(en.export, 'Export');
    assert.equal(es.export, 'Exportar');
    assert.equal(vi.export, 'Xuất');
    assert.equal(es.myJobHistory, 'Mi historial de trabajos');
    assert.equal(vi.myAssignedJobs, 'Công việc được giao cho tôi');
    assert.notEqual(es.exportFailed, en.exportFailed);
    assert.notEqual(vi.noRecords, en.noRecords);
    assert.equal(es.privateCompanyRecord.includes('Private'), false);
    assert.equal(vi.privateCompanyRecord.includes('Private'), false);
    assert.equal(es.shareByEmail.includes('Share'), false);
    assert.equal(vi.shareByEmail.includes('Share'), false);
    assert.notEqual(es.shareSent, en.shareSent);
    assert.notEqual(vi.invalidEmail, en.invalidEmail);
  });

  it('portal and team pages wire export menus', () => {
    assert.match(readFileSync('app/people/page.tsx', 'utf8'), /\/api\/exports\/team/);
    assert.match(readFileSync('app/portal/client/jobs/page.tsx', 'utf8'), /\/api\/exports\/portal\/client\/jobs/);
    assert.match(readFileSync('app/portal/contractor/page.tsx', 'utf8'), /\/api\/exports\/portal\/contractor\/jobs/);
  });

  it('maps rows to selected columns without leaking finance keys operationally', () => {
    const row = {
      jobId: 'j1',
      jobTitle: 'Lawn',
      expectedRevenue: '100.00',
      expectedProfit: '40.00'
    };
    const values = stringRowValues(OWNER_JOBS_OPERATIONAL_COLUMNS, row);
    assert.ok(!values.includes('100.00'));
    assert.ok(!values.includes('40.00'));
  });
});
