import { NextResponse } from 'next/server';
import { renderExportHttp } from '@/lib/exports/prepared';
import { resolvePreparedExport } from '@/lib/exports/resolve-export';
import {
  parseExportFormat,
  parseExportLocale,
  parseExportResource,
  sanitizeExportQuery
} from '@/lib/exports/resources';
import { sendPreparedExportEmail } from '@/lib/exports/share-export';
import { getExportCopy } from '@/lib/i18n/export-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request.', code: 'export_failed' }, { status: 400 });
  }

  const resource = parseExportResource(typeof body.endpoint === 'string' ? body.endpoint : typeof body.resource === 'string' ? body.resource : '');
  if (!resource) {
    return NextResponse.json({ error: 'Unknown export.', code: 'not_found' }, { status: 400 });
  }

  const format = parseExportFormat(typeof body.format === 'string' ? body.format : '');
  const locale = parseExportLocale(typeof body.locale === 'string' ? body.locale : '');
  const copy = getExportCopy(locale);
  if (!format) {
    return NextResponse.json({ error: 'format must be csv or pdf.', code: 'export_failed' }, { status: 400 });
  }

  const searchParams = sanitizeExportQuery(resource, (body.query as Record<string, unknown>) || null);
  const resolved = await resolvePreparedExport({ resource, searchParams, copy, locale });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error, code: resolved.code || 'export_failed' }, { status: resolved.status });
  }

  if (!resolved.prepared.rows.length && !resolved.prepared.sections?.some((section) => section.rows?.length)) {
    return renderExportHttp(resolved.prepared, format, copy);
  }

  const sent = await sendPreparedExportEmail({
    to: String(body.to || ''),
    format,
    prepared: resolved.prepared,
    copy
  });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error, code: sent.code }, { status: sent.status });
  }

  return NextResponse.json({ ok: true, code: 'sent' });
}
