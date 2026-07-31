/** CSV helpers with Excel-friendly UTF-8 BOM and RFC-style escaping. */

export function escapeCsvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(','))
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export function csvResponse(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const body = buildCsv(headers, rows);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}

export function exportFilename(prefix: string, extension: 'csv' | 'pdf' | 'html' = 'csv'): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `everittos-${prefix}-${stamp}.${extension}`;
}
