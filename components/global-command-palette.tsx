'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { isFeatureEnabled } from '@/lib/feature-flags';
import type { SearchResultItem } from '@/lib/os-types';

const copy = {
  en: {
    search: 'Search', searchWorkspace: 'Search workspace', trigger: 'Search…',
    placeholder: 'Search CRM, jobs, tasks, templates…', searching: 'Searching…',
    searchFailed: 'Search failed', unavailable: 'Search unavailable', noResults: 'No results for “{query}”',
    footer: 'Ask Everitt AI is on the floating button. Search finds records across your workspace without paid AI.',
    types: { customer: 'Customer', property: 'Property', job: 'Job', invoice: 'Invoice', contractor: 'Contractor', task: 'Task', document: 'Document', template: 'Template', form: 'Form' }
  },
  es: {
    search: 'Buscar', searchWorkspace: 'Buscar en el espacio de trabajo', trigger: 'Buscar…',
    placeholder: 'Buscar clientes, trabajos, tareas y plantillas…', searching: 'Buscando…',
    searchFailed: 'La búsqueda falló', unavailable: 'La búsqueda no está disponible', noResults: 'No hay resultados para “{query}”',
    footer: 'Ask Everitt AI está en el botón flotante. La búsqueda encuentra registros en su espacio de trabajo sin IA pagada.',
    types: { customer: 'Cliente', property: 'Propiedad', job: 'Trabajo', invoice: 'Factura', contractor: 'Contratista', task: 'Tarea', document: 'Documento', template: 'Plantilla', form: 'Formulario' }
  },
  vi: {
    search: 'Tìm kiếm', searchWorkspace: 'Tìm kiếm trong không gian làm việc', trigger: 'Tìm kiếm…',
    placeholder: 'Tìm khách hàng, công việc, nhiệm vụ và mẫu…', searching: 'Đang tìm…',
    searchFailed: 'Tìm kiếm thất bại', unavailable: 'Tìm kiếm không khả dụng', noResults: 'Không có kết quả cho “{query}”',
    footer: 'Ask Everitt AI nằm ở nút nổi. Tìm kiếm giúp tìm bản ghi trong không gian làm việc mà không cần AI trả phí.',
    types: { customer: 'Khách hàng', property: 'Bất động sản', job: 'Công việc', invoice: 'Hóa đơn', contractor: 'Nhà thầu', task: 'Nhiệm vụ', document: 'Tài liệu', template: 'Mẫu', form: 'Biểu mẫu' }
  }
} as const;

export function GlobalCommandPalette() {
  const router = useRouter();
  const { locale } = useTranslation();
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kbd, setKbd] = useState('Ctrl+K');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setKbd(navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K');
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&locale=${encodeURIComponent(locale)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || c.searchFailed);
        setResults([]);
        return;
      }
      setResults(json.results || []);
    } catch {
      setError(c.unavailable);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [c.searchFailed, c.unavailable, locale]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void search(query), 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, open, search]);

  useEffect(() => {
    if (!isFeatureEnabled('globalSearch')) return;

    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setError('');
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    setQuery('');
    setResults([]);
    router.push(href);
  }

  if (!isFeatureEnabled('globalSearch')) return null;

  return (
    <>
      <button
        type="button"
        className="global-search-trigger"
        onClick={() => setOpen(true)}
        aria-label={c.searchWorkspace}
      >
        {c.trigger} <span className="muted">{kbd}</span>
      </button>

      {open ? (
        <div className="ai-modal-overlay" role="presentation" onClick={() => setOpen(false)}>
          <div className="global-search-palette" role="dialog" aria-label={c.search} onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="input global-search-input"
              placeholder={c.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) navigate(results[0].href);
              }}
            />
            {loading ? <p className="muted global-search-hint">{c.searching}</p> : null}
            {error ? <p className="auth-message auth-message-error">{error}</p> : null}
            {!loading && query.length >= 2 && results.length === 0 && !error ? (
              <p className="muted global-search-hint">{c.noResults.replace('{query}', query)}</p>
            ) : null}
            <ul className="global-search-results">
              {results.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <button type="button" className="global-search-result" onClick={() => navigate(item.href)}>
                    <span className="global-search-type">{c.types[item.type]}</span>
                    <span className="global-search-title">{item.title}</span>
                    {item.subtitle ? <span className="muted global-search-sub">{item.subtitle}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted global-search-footer">
              {c.footer}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
