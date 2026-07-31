'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { downloadExportFromApi } from '@/lib/exports/client-download';
import { getExportCopy } from '@/lib/i18n/export-copy';
import type { Locale } from '@/lib/i18n/config';

export type ExportMenuProps = {
  /** Base API path without format, e.g. /api/exports/jobs */
  endpoint: string;
  /** Extra query string params (filters, locale, etc.) without leading ? */
  query?: string | URLSearchParams | Record<string, string | null | undefined>;
  locale?: Locale;
  disabled?: boolean;
  className?: string;
  /** Override button labels for portal ("Download my jobs") */
  labels?: {
    export?: string;
    csv?: string;
    pdf?: string;
  };
  onError?: (message: string) => void;
  onSuccess?: (format: 'csv' | 'pdf') => void;
};

function buildUrl(endpoint: string, query: ExportMenuProps['query'], format: 'csv' | 'pdf', locale?: Locale) {
  const params = new URLSearchParams();
  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => {
      if (value != null && value !== '') params.set(key, value);
    });
  } else if (typeof query === 'string' && query.trim()) {
    const parsed = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    parsed.forEach((value, key) => {
      if (value != null && value !== '') params.set(key, value);
    });
  } else if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') params.set(key, String(value));
    }
  }
  params.set('format', format);
  if (locale) params.set('locale', locale);
  const qs = params.toString();
  return qs ? `${endpoint}?${qs}` : `${endpoint}?format=${format}`;
}

export function ExportMenu({
  endpoint,
  query,
  locale = 'en',
  disabled = false,
  className,
  labels,
  onError,
  onSuccess
}: ExportMenuProps) {
  const copy = getExportCopy(locale);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function runExport(format: 'csv' | 'pdf') {
    if (disabled || busy) return;
    setBusy(format);
    setOpen(false);
    const result = await downloadExportFromApi(buildUrl(endpoint, query, format, locale), {
      fallbackFilename: `everittos-export.${format === 'pdf' ? 'html' : 'csv'}`
    });
    setBusy(null);
    if (!result.ok) {
      onError?.(result.error || copy.exportFailed);
      return;
    }
    onSuccess?.(format);
  }

  const isDisabled = disabled || Boolean(busy);
  const triggerLabel = busy ? copy.preparingExport : labels?.export || copy.export;

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        className="btn"
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {triggerLabel}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            minWidth: 160,
            zIndex: 40,
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e4e1d8)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(36, 37, 34, 0.12)',
            padding: 6
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', border: 0, background: 'transparent' }}
            disabled={isDisabled}
            onClick={() => void runExport('csv')}
          >
            {labels?.csv || copy.exportCsv}
          </button>
          <button
            type="button"
            role="menuitem"
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', border: 0, background: 'transparent' }}
            disabled={isDisabled}
            onClick={() => void runExport('pdf')}
          >
            {labels?.pdf || copy.exportPdf}
          </button>
        </div>
      ) : null}
    </div>
  );
}
