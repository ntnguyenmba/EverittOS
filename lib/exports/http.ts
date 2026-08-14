import { NextResponse } from 'next/server';
import { renderExportHttp } from '@/lib/exports/prepared';
import { resolvePreparedExport } from '@/lib/exports/resolve-export';
import {
  parseExportFormat,
  parseExportLocale,
  sanitizeExportQuery,
  type ExportResourceId
} from '@/lib/exports/resources';
import { getExportCopy } from '@/lib/i18n/export-copy';

export async function exportGetResponse(request: Request, resource: ExportResourceId) {
  const url = new URL(request.url);
  const format = parseExportFormat(url.searchParams.get('format'));
  const locale = parseExportLocale(url.searchParams.get('locale'));
  const copy = getExportCopy(locale);

  if (!format) {
    return NextResponse.json({ error: 'format must be csv or pdf.', code: 'export_failed' }, { status: 400 });
  }

  const searchParams = sanitizeExportQuery(resource, url.searchParams);
  const resolved = await resolvePreparedExport({ resource, searchParams, copy, locale });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error, code: resolved.code || 'export_failed' }, { status: resolved.status });
  }

  return renderExportHttp(resolved.prepared, format, copy);
}
