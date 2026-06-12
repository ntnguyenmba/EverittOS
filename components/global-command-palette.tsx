'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import type { SearchResultItem } from '@/lib/os-types';

const TYPE_LABELS: Record<SearchResultItem['type'], string> = {
  customer: 'CRM',
  job: 'Job',
  task: 'Task',
  document: 'Document',
  template: 'Template',
  form: 'Form'
};

export function GlobalCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Search failed');
        setResults([]);
        return;
      }
      setResults(json.results || []);
    } catch {
      setError('Search unavailable');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const kbd = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K';

  return (
    <>
      <button
        type="button"
        className="global-search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Search workspace"
      >
        Search… <span className="muted">{kbd}</span>
      </button>

      {open ? (
        <div className="ai-modal-overlay" role="presentation" onClick={() => setOpen(false)}>
          <div className="global-search-palette" role="dialog" aria-label="Search" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="input global-search-input"
              placeholder="Search CRM, jobs, tasks, templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) navigate(results[0].href);
              }}
            />
            {loading ? <p className="muted global-search-hint">Searching…</p> : null}
            {error ? <p className="auth-message auth-message-error">{error}</p> : null}
            {!loading && query.length >= 2 && results.length === 0 && !error ? (
              <p className="muted global-search-hint">No results for &ldquo;{query}&rdquo;</p>
            ) : null}
            <ul className="global-search-results">
              {results.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <button type="button" className="global-search-result" onClick={() => navigate(item.href)}>
                    <span className="global-search-type">{TYPE_LABELS[item.type]}</span>
                    <span className="global-search-title">{item.title}</span>
                    {item.subtitle ? <span className="muted global-search-sub">{item.subtitle}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted global-search-footer">
              Ask Everitt AI is on the floating button. This search finds records across your workspace.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
