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
  onSuccess?: (format: 'csv' | 'pdf' | 'share') => void;
};

type MenuPosition = {
  left: number;
  top: number;
  width: number;
};

function queryRecord(query: ExportMenuProps['query']): Record<string, string> {
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
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function buildUrl(endpoint: string, query: ExportMenuProps['query'], format: 'csv' | 'pdf', locale?: Locale) {
  const params = new URLSearchParams(queryRecord(query));
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
  const [shareOpen, setShareOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [busy, setBusy] = useState<'csv' | 'pdf' | 'share-csv' | 'share-pdf' | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setShareOpen(false);
        setShareMessage('');
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setShareOpen(false);
        setShareMessage('');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    function updateMenuPosition() {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const viewportPadding = 12;
      const desiredWidth = shareOpen ? 260 : 190;
      const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
      const width = Math.min(desiredWidth, availableWidth);
      const preferredLeft = rect.right - width;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
      const left = Math.min(Math.max(viewportPadding, preferredLeft), maxLeft);
      setMenuPosition({ left, top: rect.bottom + 4, width });
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, shareOpen]);

  async function runExport(format: 'csv' | 'pdf') {
    if (disabled || busy) return;
    setBusy(format);
    setOpen(false);
    setShareOpen(false);
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

  async function runShare(format: 'csv' | 'pdf') {
    if (disabled || busy) return;
    setShareMessage('');
    setBusy(format === 'csv' ? 'share-csv' : 'share-pdf');
    let response: Response;
    try {
      response = await fetch('/api/exports/share', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          format,
          to: email,
          query: queryRecord(query),
          locale
        })
      });
    } catch {
      setBusy(null);
      setShareMessage(copy.shareFailed);
      onError?.(copy.shareFailed);
      return;
    }

    const json = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
    setBusy(null);
    if (!response.ok) {
      const message = json.error || copy.shareFailed;
      setShareMessage(message);
      onError?.(message);
      return;
    }
    setShareMessage(copy.shareSent);
    setOpen(false);
    setShareOpen(false);
    onSuccess?.('share');
  }

  const isDisabled = disabled || Boolean(busy);
  const triggerLabel = busy ? (String(busy).startsWith('share') ? copy.sending : copy.preparingExport) : labels?.export || copy.export;

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
        onClick={() => {
          setOpen((value) => !value);
          setShareOpen(false);
          setShareMessage('');
        }}
      >
        {triggerLabel}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          style={{
            position: 'fixed',
            left: menuPosition?.left ?? 12,
            top: menuPosition?.top ?? 0,
            width: menuPosition?.width ?? 190,
            maxWidth: 'calc(100vw - 24px)',
            boxSizing: 'border-box',
            zIndex: 1000,
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e4e1d8)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(36, 37, 34, 0.12)',
            padding: 6,
            overflow: 'hidden'
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="btn"
            style={{ width: '100%', maxWidth: '100%', justifyContent: 'flex-start', border: 0, background: 'transparent', boxSizing: 'border-box' }}
            disabled={isDisabled}
            onClick={() => void runExport('csv')}
          >
            {labels?.csv || copy.exportCsv}
          </button>
          <button
            type="button"
            role="menuitem"
            className="btn"
            style={{ width: '100%', maxWidth: '100%', justifyContent: 'flex-start', border: 0, background: 'transparent', boxSizing: 'border-box' }}
            disabled={isDisabled}
            onClick={() => void runExport('pdf')}
          >
            {labels?.pdf || copy.exportPdf}
          </button>
          <button
            type="button"
            role="menuitem"
            className="btn"
            style={{ width: '100%', maxWidth: '100%', justifyContent: 'flex-start', border: 0, background: 'transparent', boxSizing: 'border-box' }}
            disabled={isDisabled}
            onClick={() => {
              setShareOpen(true);
              setShareMessage('');
            }}
          >
            {copy.shareByEmail}
          </button>
          {shareOpen ? (
            <form
              style={{ display: 'grid', gap: 6, padding: 6, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
              onSubmit={(event) => {
                event.preventDefault();
                void runShare('pdf');
              }}
            >
              <label className="muted" htmlFor={`${menuId}-email`} style={{ fontSize: 12 }}>
                {copy.emailAddress}
              </label>
              <input
                id={`${menuId}-email`}
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                aria-label={copy.emailAddress}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isDisabled}
                style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn" disabled={isDisabled} onClick={() => void runShare('csv')}>
                  {busy === 'share-csv' ? copy.sending : copy.sendCsv}
                </button>
                <button type="submit" className="btn" disabled={isDisabled}>
                  {busy === 'share-pdf' ? copy.sending : copy.sendPdf}
                </button>
              </div>
              {shareMessage ? <p className="muted" style={{ margin: 0, fontSize: 12 }}>{shareMessage}</p> : null}
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
