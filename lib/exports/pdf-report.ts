/** Printable HTML report used as the project PDF export path (no PDF library). */

export type PdfReportSection = {
  title?: string;
  paragraphs?: string[];
  summary?: Array<{ label: string; value: string }>;
  headers?: string[];
  rows?: string[][];
};

export type PdfReportInput = {
  companyName: string;
  title: string;
  subtitle?: string;
  generatedLabel: string;
  generatedAt: string;
  filtersLabel: string;
  filters: string;
  pageLabel: string;
  privateLabel?: string;
  sections: PdfReportSection[];
};

export function buildPdfReportHtml(input: PdfReportInput): string {
  const summaryHtml = (summary?: Array<{ label: string; value: string }>) => {
    if (!summary?.length) return '';
    return `<div class="summary">${summary
      .map((item) => `<div class="summary-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`)
      .join('')}</div>`;
  };

  const tableHtml = (headers?: string[], rows?: string[][]) => {
    if (!headers?.length || !rows) return '';
    return `<table>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
          .join('')}
      </tbody>
    </table>`;
  };

  const sections = input.sections
    .map((section) => {
      const paragraphs = (section.paragraphs || [])
        .map((p) => `<p class="muted">${escapeHtml(p)}</p>`)
        .join('');
      return `<section>
        ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ''}
        ${paragraphs}
        ${summaryHtml(section.summary)}
        ${tableHtml(section.headers, section.rows)}
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    @page { size: letter; margin: 0.7in; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #242522; background: #fff; margin: 0; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    h2 { font-size: 16px; margin: 22px 0 10px; }
    .meta, .muted { color: #666258; font-size: 12px; margin: 0 0 6px; }
    .private { display: inline-block; margin: 8px 0 14px; padding: 4px 8px; border: 1px solid #d8d5cc; border-radius: 999px; font-size: 11px; color: #4d4b45; }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 14px 0 18px; }
    .summary-item { border: 1px solid #e4e1d8; border-radius: 10px; padding: 10px 12px; }
    .summary-item span { display: block; color: #747067; font-size: 11px; margin-bottom: 4px; }
    .summary-item strong { font-size: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border-bottom: 1px solid #e4e1d8; padding: 8px 6px; text-align: left; vertical-align: top; }
    thead { display: table-header-group; }
    th { background: #f3f1eb; color: #4d4b45; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    tr { page-break-inside: avoid; }
    .footer { margin-top: 24px; color: #747067; font-size: 11px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header>
    <div class="meta">${escapeHtml(input.companyName)}</div>
    <h1>${escapeHtml(input.title)}</h1>
    ${input.subtitle ? `<p class="muted">${escapeHtml(input.subtitle)}</p>` : ''}
    ${input.privateLabel ? `<div class="private">${escapeHtml(input.privateLabel)}</div>` : ''}
    <p class="meta">${escapeHtml(input.generatedLabel)}: ${escapeHtml(input.generatedAt)}</p>
    <p class="meta">${escapeHtml(input.filtersLabel)}: ${escapeHtml(input.filters || '—')}</p>
  </header>
  ${sections}
  <div class="footer">${escapeHtml(input.pageLabel)}</div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function pdfHtmlResponse(filename: string, html: string) {
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename.replace(/\.pdf$/i, '.html')}"`,
      'Cache-Control': 'no-store'
    }
  });
}
