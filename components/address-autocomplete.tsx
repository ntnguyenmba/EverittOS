'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from '@/components/locale-provider';
import type { AddressSuggestion, StructuredAddress } from '@/lib/address/types';
import { structuredAddressFromManual } from '@/lib/address/parse-photon';

type AddressAutocompleteProps = {
  id?: string;
  label?: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  onChange: (formatted: string, structured: StructuredAddress | null) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
};

type FetchState = 'idle' | 'loading' | 'empty' | 'error' | 'ready';

const CLIENT_CACHE = new Map<string, { expiresAt: number; suggestions: AddressSuggestion[] }>();
const CLIENT_CACHE_TTL = 1000 * 60 * 2;
const CLIENT_CACHE_VERSION = 'v7';

const copy = {
  en: { placeholder: 'Start typing an address or enter it manually', searching: 'Searching addresses…', use: 'Use this address' },
  es: { placeholder: 'Empiece a escribir una dirección o ingrésela manualmente', searching: 'Buscando direcciones…', use: 'Usar esta dirección' },
  vi: { placeholder: 'Bắt đầu nhập địa chỉ hoặc nhập thủ công', searching: 'Đang tìm địa chỉ…', use: 'Dùng địa chỉ này' }
} as const;

function normalizeAddress(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/[,.]/g, '').trim();
}

function dedupeSuggestions(items: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const next: AddressSuggestion[] = [];
  for (const item of items) {
    const key = normalizeAddress(item.formattedAddress);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(item);
    if (next.length >= 5) break;
  }
  return next;
}

function cacheKey(query: string): string {
  return `${CLIENT_CACHE_VERSION}:${query.trim().toLowerCase()}`;
}

function readClientCache(query: string): AddressSuggestion[] | null {
  const key = cacheKey(query);
  const entry = CLIENT_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CLIENT_CACHE.delete(key);
    return null;
  }
  return entry.suggestions;
}

function writeClientCache(query: string, suggestions: AddressSuggestion[]) {
  if (!suggestions.length) return;
  CLIENT_CACHE.set(cacheKey(query), { expiresAt: Date.now() + CLIENT_CACHE_TTL, suggestions });
}

export function AddressAutocomplete({ id, label, value, disabled, required, placeholder, className = 'input', onChange, onSelect }: AddressAutocompleteProps) {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const autoId = useId();
  const inputId = id || `address-${autoId}`;
  const listboxId = `${inputId}-listbox`;
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [state, setState] = useState<FetchState>('idle');
  const [attribution, setAttribution] = useState('© OpenStreetMap · © Komoot Photon');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const skipNextSearch = useRef(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    function onDocPointer(event: MouseEvent | TouchEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('touchstart', onDocPointer);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('touchstart', onDocPointer);
    };
  }, []);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const query = value.trim();
    if (query.length < 3 || disabled) {
      setSuggestions([]);
      setState('idle');
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        const cached = readClientCache(query);
        if (cached) {
          setSuggestions(cached);
          setState('ready');
          setOpen(focusedRef.current);
          setActiveIndex(-1);
          return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setState('loading');
        if (focusedRef.current) setOpen(true);
        try {
          const response = await fetch(`/api/address/autocomplete?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: 'no-store' });
          const json = (await response.json().catch(() => ({}))) as { suggestions?: AddressSuggestion[]; attribution?: string; unavailable?: boolean };
          if (json.attribution) setAttribution(json.attribution.length > 48 ? '© OpenStreetMap · © Komoot Photon' : json.attribution);
          const next = dedupeSuggestions(json.suggestions || []);
          writeClientCache(query, next);
          setSuggestions(next);
          setState(json.unavailable ? 'error' : next.length ? 'ready' : 'empty');
          setOpen(focusedRef.current);
          setActiveIndex(-1);
        } catch (error) {
          if ((error as Error).name === 'AbortError') return;
          setSuggestions([]);
          setState('error');
          setOpen(focusedRef.current);
          setActiveIndex(-1);
        }
      })();
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, disabled]);

  function applySuggestion(suggestion: AddressSuggestion) {
    skipNextSearch.current = true;
    onChange(suggestion.formattedAddress, suggestion);
    onSelect?.(suggestion);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setState('idle');
  }

  function useTypedAddress() {
    const typed = value.trim();
    if (!typed) return;
    skipNextSearch.current = true;
    onChange(typed, structuredAddressFromManual(typed));
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setState('idle');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (suggestions.length) setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (suggestions.length) setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      applySuggestion(suggestions[activeIndex]);
    }
  }

  const typedAddress = value.trim();
  const typedKey = normalizeAddress(typedAddress);
  const exactSuggestionExists = suggestions.some((item) => normalizeAddress(item.formattedAddress) === typedKey);
  const showMenu = open && typedAddress.length >= 3;
  const showManualOption = !exactSuggestionExists && typedAddress.length >= 3;

  return (
    <div className="address-autocomplete" ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <input
        id={inputId}
        className={className}
        value={value}
        disabled={disabled}
        required={required}
        autoComplete="street-address"
        placeholder={placeholder || c.placeholder}
        role="combobox"
        aria-expanded={showMenu}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next, next.trim() ? structuredAddressFromManual(next) : null);
        }}
        onFocus={() => {
          focusedRef.current = true;
          if (value.trim().length >= 3) setOpen(true);
        }}
        onBlur={() => {
          focusedRef.current = false;
        }}
        onKeyDown={onKeyDown}
      />
      {showMenu ? (
        <div id={listboxId} role="listbox" className="address-autocomplete-menu" style={{ position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius-md, 12px)', background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow-subtle)' }}>
          {state === 'loading' ? <p className="muted" style={{ padding: '10px 12px', margin: 0 }}>{c.searching}</p> : null}
          {suggestions.map((suggestion, index) => (
            <button key={`${suggestion.id}-${normalizeAddress(suggestion.formattedAddress)}`} id={`${listboxId}-option-${index}`} type="button" role="option" aria-selected={index === activeIndex} className="address-autocomplete-option" style={{ display: 'block', width: '100%', padding: '10px 12px', border: 0, borderBottom: '1px solid var(--line)', background: index === activeIndex ? 'var(--surface-subtle)' : 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => applySuggestion(suggestion)}>
              <strong style={{ display: 'block' }}>{suggestion.formattedAddress}</strong>
              {suggestion.detail && normalizeAddress(suggestion.detail) !== normalizeAddress(suggestion.formattedAddress) ? <span className="muted" style={{ fontSize: '0.9em' }}>{suggestion.detail}</span> : null}
            </button>
          ))}
          {showManualOption ? (
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={useTypedAddress} style={{ display: 'block', width: '100%', padding: '12px', border: 0, background: 'var(--surface-subtle)', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <strong style={{ display: 'block' }}>{c.use}</strong>
              <span className="muted" style={{ display: 'block', marginTop: 2, fontSize: '0.9em' }}>{typedAddress}</span>
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="muted" style={{ marginTop: 4, marginBottom: 0, fontSize: '0.68em', opacity: 0.75, lineHeight: 1.3 }}>{attribution}</p>
    </div>
  );
}
