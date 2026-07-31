import { NextResponse } from 'next/server';
import {
  columnHeaders,
  ownerJobsColumns,
  stringRowValues
} from '@/lib/exports/columns';
import { csvResponse, exportFilename } from '@/lib/exports/csv';
import { loadOwnerJobsExportData } from '@/lib/exports/job-export-data';
import { buildPdfReportHtml, pdfHtmlResponse } from '@/lib/exports/pdf-report';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { normalizeLocale } from '@/lib/i18n/config';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  if (!isManagerRole(normalizeRole(ctx.workspace.role))) {
    return NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  const locale = normalizeLocale(url.searchParams.get('locale'));
  const copy = getExportCopy(locale);

  if (format !== 'csv' && format !== 'pdf') {
    return NextResponse.json({ error: 'format must be csv or pdf.' }, { status: 400 });
  }

  const loaded = await loadOwnerJobsExportData({
    supabase: ctx.supabase,
    userId: ctx.userId,
    workspace: ctx.workspace,
    searchParams: url.searchParams
  });

  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { data } = loaded;
  if (!data.rows.length) {
    return NextResponse.json({ error: copy.noRecords, code: 'no_records' }, { status: 422 });
  }

  const columns = ownerJobsColumns(data.includeFinance);
  const headers = columnHeaders(columns);
  const tableRows = data.rows.map((row) => stringRowValues(columns, row));
  const filters = data.appliedFilters.length ? data.appliedFilters.join('; ') : '—';
  const generatedAt = new Date().toISOString();

  if (format === 'csv') {
    return csvResponse(exportFilename('jobs', 'csv'), headers, tableRows);
  }

  const summary = data.includeFinance
    ? [
        { label: 'Jobs', value: String(data.summary.jobCount) },
        { label: 'Expected revenue', value: data.summary.expectedRevenueTotal || '0.00' },
        { label: 'Collected', value: data.summary.actualCollectedTotal || '0.00' },
        { label: 'Expected profit', value: data.summary.expectedProfitTotal || '0.00' },
        { label: 'Actual profit', value: data.summary.actualProfitTotal || '0.00' }
      ]
    : [{ label: 'Jobs', value: String(data.summary.jobCount) }];

  const html = buildPdfReportHtml({
    companyName: data.companyName,
    title: data.includeFinance ? 'Jobs financial export' : 'Jobs operational export',
    generatedLabel: copy.generatedOn,
    generatedAt,
    filtersLabel: copy.appliedFilters,
    filters,
    pageLabel: copy.page,
    privateLabel: copy.privateCompanyRecord,
    sections: [
      {
        summary,
        headers,
        rows: tableRows
      }
    ]
  });

  return pdfHtmlResponse(exportFilename('jobs', 'pdf'), html);
}
