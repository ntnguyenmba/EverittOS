import { NextResponse } from 'next/server';
import {
  columnHeaders,
  stringRowValues,
  TEAM_EXPORT_COLUMNS
} from '@/lib/exports/columns';
import { csvResponse, exportFilename } from '@/lib/exports/csv';
import { buildPdfReportHtml, pdfHtmlResponse } from '@/lib/exports/pdf-report';
import { loadTeamExportData } from '@/lib/exports/team-export-data';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { normalizeLocale } from '@/lib/i18n/config';
import { canViewTeam, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  if (!canViewTeam(normalizeRole(ctx.workspace.role))) {
    return NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  const locale = normalizeLocale(url.searchParams.get('locale'));
  const copy = getExportCopy(locale);

  if (format !== 'csv' && format !== 'pdf') {
    return NextResponse.json({ error: 'format must be csv or pdf.' }, { status: 400 });
  }

  const loaded = await loadTeamExportData({
    supabase: ctx.supabase,
    workspace: ctx.workspace,
    admin: createAdminSupabase()
  });

  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { data } = loaded;
  if (!data.rows.length) {
    return NextResponse.json({ error: copy.noRecords, code: 'no_records' }, { status: 422 });
  }

  const headers = columnHeaders(TEAM_EXPORT_COLUMNS);
  const tableRows = data.rows.map((row) => stringRowValues(TEAM_EXPORT_COLUMNS, row));
  const filters = data.appliedFilters.join('; ') || '—';
  const generatedAt = new Date().toISOString();

  if (format === 'csv') {
    return csvResponse(exportFilename('team', 'csv'), headers, tableRows);
  }

  const html = buildPdfReportHtml({
    companyName: data.companyName,
    title: 'Team export',
    generatedLabel: copy.generatedOn,
    generatedAt,
    filtersLabel: copy.appliedFilters,
    filters,
    pageLabel: copy.page,
    privateLabel: copy.privateCompanyRecord,
    sections: [
      {
        summary: [
          { label: 'Members', value: String(data.summary.memberCount) },
          { label: 'Pending invitations', value: String(data.summary.pendingInvitationCount) }
        ],
        headers,
        rows: tableRows
      }
    ]
  });

  return pdfHtmlResponse(exportFilename('team', 'pdf'), html);
}
