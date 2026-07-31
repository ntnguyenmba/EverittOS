import { NextResponse } from 'next/server';
import {
  columnHeaders,
  CUSTOMER_JOBS_COLUMNS,
  stringRowValues
} from '@/lib/exports/columns';
import { csvResponse, exportFilename } from '@/lib/exports/csv';
import { buildPdfReportHtml, pdfHtmlResponse } from '@/lib/exports/pdf-report';
import { loadClientPortalJobsExport } from '@/lib/exports/portal-export-data';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { normalizeLocale } from '@/lib/i18n/config';
import { repairClientPortalAccessForUser } from '@/lib/client-portal-repair';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  await repairClientPortalAccessForUser(admin, user.id, user.email);

  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  const locale = normalizeLocale(url.searchParams.get('locale'));
  const copy = getExportCopy(locale);

  if (format !== 'csv' && format !== 'pdf') {
    return NextResponse.json({ error: 'format must be csv or pdf.' }, { status: 400 });
  }

  const loaded = await loadClientPortalJobsExport({
    supabase,
    admin,
    userId: user.id
  });

  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { data } = loaded;
  if (!data.rows.length) {
    return NextResponse.json({ error: copy.noRecords, code: 'no_records' }, { status: 422 });
  }

  const headers = columnHeaders(CUSTOMER_JOBS_COLUMNS);
  const tableRows = data.rows.map((row) => stringRowValues(CUSTOMER_JOBS_COLUMNS, row));
  const generatedAt = new Date().toISOString();

  if (format === 'csv') {
    return csvResponse(exportFilename('my-jobs', 'csv'), headers, tableRows);
  }

  const html = buildPdfReportHtml({
    companyName: data.companyName,
    title: copy.myJobHistory,
    generatedLabel: copy.generatedOn,
    generatedAt,
    filtersLabel: copy.appliedFilters,
    filters: data.appliedFilters.join('; ') || '—',
    pageLabel: copy.page,
    sections: [
      {
        summary: [{ label: copy.job, value: String(data.summary.jobCount) }],
        headers,
        rows: tableRows
      }
    ]
  });

  return pdfHtmlResponse(exportFilename('my-jobs', 'pdf'), html);
}
