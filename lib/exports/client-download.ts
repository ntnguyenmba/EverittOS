'use client';

export type DownloadExportResult =
  | { ok: true }
  | { ok: false; error: string; code?: string; status: number };

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/i) || header.match(/filename=([^;]+)/i);
  return match?.[1]?.trim() || fallback;
}

/**
 * Fetch an export API endpoint and trigger a browser download.
 * - JSON error bodies are surfaced as { error, code? }
 * - text/csv → blob download
 * - text/html (printable PDF path) → open in a new window for print
 */
export async function downloadExportFromApi(
  url: string,
  options?: { fallbackFilename?: string; signal?: AbortSignal }
): Promise<DownloadExportResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: options?.signal
    });
  } catch {
    return { ok: false, error: 'Network error while preparing export.', status: 0 };
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      try {
        const json = (await response.json()) as { error?: string; code?: string };
        return {
          ok: false,
          error: json.error || 'Export failed.',
          code: json.code,
          status: response.status
        };
      } catch {
        // fall through
      }
    }
    return { ok: false, error: 'Export failed.', status: response.status };
  }

  if (contentType.includes('text/html')) {
    const html = await response.text();
    const win = window.open('', '_blank');
    if (!win) {
      return {
        ok: false,
        error: 'Pop-up blocked. Allow pop-ups to open the PDF print view.',
        status: 0
      };
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return { ok: true };
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(
    response.headers.get('content-disposition'),
    options?.fallbackFilename || 'everittos-export.csv'
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  return { ok: true };
}
