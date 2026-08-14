import { columnHeaders, stringRowValues, type ExportColumnDef } from '@/lib/exports/columns';
import { buildCsv, csvResponse, exportFilename } from '@/lib/exports/csv';
import { buildPdfReportHtml, pdfHtmlResponse, type PdfReportSection } from '@/lib/exports/pdf-report';
import { formatExportCopy, type ExportCopy } from '@/lib/i18n/export-copy';

export type PreparedExport = {
  filenamePrefix: string;
  title: string;
  companyName: string;
  appliedFilters: string[];
  privateLabel?: string;
  summary?: Array<{ label: string; value: string }>;
  headers: string[];
  rows: string[][];
  sections?: PdfReportSection[];
};

export function preparedFromColumns(
  columns: ExportColumnDef[],
  rows: Array<Record<string, unknown>>,
  rest: Omit<PreparedExport, 'headers' | 'rows'>
): PreparedExport {
  return {
    ...rest,
    headers: columnHeaders(columns),
    rows: rows.map((row) => stringRowValues(columns, row))
  };
}

export function filtersLabel(filters: string[]): string {
  return filters.filter(Boolean).join('; ') || '—';
}

export function renderExportHttp(prepared: PreparedExport, format: 'csv' | 'pdf', copy: ExportCopy) {
  if (!prepared.rows.length && !prepared.sections?.some((section) => section.rows?.length)) {
    return Response.json({ error: copy.noRecords, code: 'no_records' }, { status: 422 });
  }

  if (format === 'csv') {
    const { headers, rows } = csvTables(prepared);
    return csvResponse(exportFilename(prepared.filenamePrefix, 'csv'), headers, rows);
  }

  const html = buildPdfHtml(prepared, copy, true);
  return pdfHtmlResponse(exportFilename(prepared.filenamePrefix, 'pdf'), html);
}

export function buildExportAttachment(
  prepared: PreparedExport,
  format: 'csv' | 'pdf',
  copy: ExportCopy
): { filename: string; content: string; contentType: string } {
  if (format === 'csv') {
    const { headers, rows } = csvTables(prepared);
    return {
      filename: exportFilename(prepared.filenamePrefix, 'csv'),
      content: Buffer.from(buildCsv(headers, rows), 'utf8').toString('base64'),
      contentType: 'text/csv; charset=utf-8'
    };
  }

  const html = buildPdfHtml(prepared, copy, false);
  return {
    filename: exportFilename(prepared.filenamePrefix, 'pdf').replace(/\.pdf$/i, '.html'),
    content: Buffer.from(html, 'utf8').toString('base64'),
    contentType: 'text/html; charset=utf-8'
  };
}

export function shareEmailCopy(prepared: PreparedExport, copy: ExportCopy): { subject: string; html: string; text: string } {
  const subject = formatExportCopy(copy.emailSubject, { title: prepared.title });
  const text = copy.emailBody;
  const html = `<p>${escapeHtml(copy.emailBody)}</p>`;
  return { subject, html, text };
}

function csvTables(prepared: PreparedExport): { headers: string[]; rows: string[][] } {
  if (prepared.sections?.length) {
    const sectionRows: string[][] = [];
    let headers = prepared.headers;
    for (const section of prepared.sections) {
      const sectionHeaders = section.headers?.length ? section.headers : prepared.headers;
      if (!headers.length) headers = ['Section', ...sectionHeaders];
      for (const row of section.rows || []) {
        sectionRows.push([section.title || '', ...row]);
      }
    }
    if (!headers.length) headers = ['Section', 'Title', 'Amount'];
    if (headers[0] !== 'Section') headers = ['Section', ...headers];
    return { headers, rows: sectionRows.length ? sectionRows : prepared.rows };
  }
  return { headers: prepared.headers, rows: prepared.rows };
}

function buildPdfHtml(prepared: PreparedExport, copy: ExportCopy, autoPrint: boolean): string {
  const sections: PdfReportSection[] =
    prepared.sections?.length ?
      prepared.sections
    : [
        {
          summary: prepared.summary,
          headers: prepared.headers,
          rows: prepared.rows
        }
      ];

  return buildPdfReportHtml({
    companyName: prepared.companyName,
    title: prepared.title,
    generatedLabel: copy.generatedOn,
    generatedAt: new Date().toISOString(),
    filtersLabel: copy.appliedFilters,
    filters: filtersLabel(prepared.appliedFilters),
    pageLabel: copy.page,
    privateLabel: prepared.privateLabel,
    sections,
    autoPrint
  });
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
