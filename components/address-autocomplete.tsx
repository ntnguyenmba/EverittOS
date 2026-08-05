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
const CLIENT_CACHE_VERSION = 'v2';

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
  // Never cache a failed or empty lookup. The provider may return a useful result
  // on the next request, especially for newly corrected full street addresses.
  if (!suggestions.length) return;
  CLIENT_CACHE.set(cacheKey(query), { expiresAt: Date.now() + CLIENT_CACHE_TTL, suggestions });
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
          const response = await fetch(`/api/address/autocomplete?q=${encodeURIComponent(query)}`, {
            signal: controller.signal
          });
          const json = (await response.json().catch(() => ({}))) as {
            suggestions?: AddressSuggestion[];
            attribution?: string;
            unavailable?: boolean;
            error?: string;
          };
          if (json.attribution) {
            setAttribution(
              json.attribution.length > 48 ? '© OpenStreetMap · © Komoot Photon' : json.attribution
            );
          }
          const next = json.suggestions || [];
          writeClientCache(query, next);
          setSuggestions(next);
          if (json.unavailable) {
            setState('error');
            setOpen(false);
          } else if (next.length) {
            setState('ready');
            setOpen(focusedRef.current);
          } else {
            setState('empty');
            setOpen(false);
          }
          setActiveIndex(-1);
        } catch (error) {
          if ((error as Error).name === 'AbortError') return;
          setSuggestions([]);
          setState('error');
          setOpen(false);
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
      if (!suggestions.length) return;
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!suggestions.length) return;
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter') {
      // Only consume Enter when a suggestion is actively highlighted.
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault();
        applySuggestion(suggestions[activeIndex]);
      } else {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
  }

  const showMenu = open && (state === 'loading' || suggestions.length > 0);

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
        aria-expanded={showMenu}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        onChange={(event) => {
          const next = event.target.value;
          // Manual text is always preserved — typing does not require picking a suggestion.
          onChange(next, next.trim() ? structuredAddressFromManual(next) : null);
        }}
        onFocus={() => {
          focusedRef.current = true;
          if (suggestions.length || state === 'loading') setOpen(true);
        }}
        onBlur={() => {
          focusedRef.current = false;
        }}
        onKeyDown={onKeyDown}
      />
      {showMenu ? (
        <div
          id={listboxId}
          role="listbox"
          className="address-autocomplete-menu"
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: 260,
            overflowY: 'auto',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md, 12px)',
            background: 'var(--surface)',
            color: 'var(--text)',
            boxShadow: 'var(--shadow-subtle)'
          }}
        >
          {state === 'loading' ? (
            <p className="muted" style={{ padding: '10px 12px', margin: 0 }}>
              Searching addresses…
            </p>
          ) : null}
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
                padding: '10px 12px',
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
              <span className="muted" style={{ fontSize: '0.9em' }}>
                {suggestion.detail}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <p className="muted" style={{ marginTop: 4, marginBottom: 0, fontSize: '0.68em', opacity: 0.75, lineHeight: 1.3 }}>
        {attribution}
      </p>
    </div>
  );
}
