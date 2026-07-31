'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
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
const CLIENT_CACHE_TTL = 1000 * 60 * 20;

function readClientCache(query: string): AddressSuggestion[] | null {
  const entry = CLIENT_CACHE.get(query.toLowerCase());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CLIENT_CACHE.delete(query.toLowerCase());
    return null;
  }
  return entry.suggestions;
}

function writeClientCache(query: string, suggestions: AddressSuggestion[]) {
  CLIENT_CACHE.set(query.toLowerCase(), { expiresAt: Date.now() + CLIENT_CACHE_TTL, suggestions });
}

export function AddressAutocomplete({
  id,
  label,
  value,
  disabled,
  required,
  placeholder = 'Start typing an address or enter it manually',
  className = 'input',
  onChange,
  onSelect
}: AddressAutocompleteProps) {
  const autoId = useId();
  const inputId = id || `address-${autoId}`;
  const listboxId = `${inputId}-listbox`;
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [state, setState] = useState<FetchState>('idle');
  const [attribution, setAttribution] = useState('Address search © OpenStreetMap contributors, © Komoot Photon');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const skipNextSearch = useRef(false);

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
      return;
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        const cached = readClientCache(query);
        if (cached) {
          setSuggestions(cached);
          setState(cached.length ? 'ready' : 'empty');
          setOpen(true);
          setActiveIndex(-1);
          return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        setState('loading');
        setOpen(true);

        try {
          const response = await fetch(`/api/address/autocomplete?q=${encodeURIComponent(query)}`, {
            signal: controller.signal
          });
          const json = (await response.json().catch(() => ({}))) as {
            suggestions?: AddressSuggestion[];
            attribution?: string;
            unavailable?: boolean;
            error?: string;
          };
          if (json.attribution) setAttribution(json.attribution);
          const next = json.suggestions || [];
          writeClientCache(query, next);
          setSuggestions(next);
          if (json.unavailable) setState('error');
          else setState(next.length ? 'ready' : 'empty');
          setActiveIndex(-1);
        } catch (error) {
          if ((error as Error).name === 'AbortError') return;
          setSuggestions([]);
          setState('error');
        }
      })();
    }, 350);

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

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!suggestions.length) return;
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!suggestions.length) return;
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault();
        applySuggestion(suggestions[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

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
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next, next.trim() ? structuredAddressFromManual(next) : null);
        }}
        onFocus={() => {
          if (suggestions.length || state === 'loading' || state === 'empty' || state === 'error') setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="address-autocomplete-menu"
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            maxHeight: 280,
            overflowY: 'auto',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md, 12px)',
            background: 'var(--surface)',
            color: 'var(--text)',
            boxShadow: 'var(--shadow-subtle)'
          }}
        >
          {state === 'loading' ? <p className="muted" style={{ padding: '12px 14px', margin: 0 }}>Searching addresses…</p> : null}
          {state === 'empty' ? <p className="muted" style={{ padding: '12px 14px', margin: 0 }}>No matches. Keep typing or enter the address manually.</p> : null}
          {state === 'error' ? <p className="muted" style={{ padding: '12px 14px', margin: 0 }}>Address lookup is temporarily unavailable. You can enter the address manually.</p> : null}
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className="address-autocomplete-option"
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 14px',
                border: 0,
                borderBottom: '1px solid var(--line)',
                background: index === activeIndex ? 'var(--surface-subtle)' : 'transparent',
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer'
              }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => applySuggestion(suggestion)}
            >
              <strong style={{ display: 'block' }}>{suggestion.label}</strong>
              <span className="muted" style={{ fontSize: '0.9em' }}>{suggestion.detail}</span>
            </button>
          ))}
          <p className="muted" style={{ padding: '8px 14px', margin: 0, fontSize: '0.8em' }}>{attribution}</p>
        </div>
      ) : null}
      {!open ? <p className="muted" style={{ marginTop: 6, fontSize: '0.8em' }}>{attribution}</p> : null}
    </div>
  );
}
