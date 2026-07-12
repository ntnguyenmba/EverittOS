'use client';

import { useEffect, useId, useRef, useState } from 'react';

type EasyDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  required?: boolean;
  showQuickDates?: boolean;
};

function isoToDisplay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function displayToIso(value: string): string | null {
  const cleaned = value.trim().replace(/[.\-]/g, '/');
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function offsetDate(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function EasyDateInput({
  value,
  onChange,
  label,
  disabled = false,
  min,
  max,
  required = false,
  showQuickDates = true
}: EasyDateInputProps) {
  const id = useId();
  const nativeRef = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const [error, setError] = useState('');

  useEffect(() => {
    setDisplay(isoToDisplay(value));
    setError('');
  }, [value]);

  function commitDisplay() {
    if (!display.trim()) {
      if (!required) onChange('');
      setError(required ? 'Enter a date.' : '');
      return;
    }

    const iso = displayToIso(display);
    if (!iso) {
      setError('Use MM/DD/YYYY, for example 07/11/2026.');
      return;
    }
    if (min && iso < min) {
      setError(`Date must be on or after ${isoToDisplay(min)}.`);
      return;
    }
    if (max && iso > max) {
      setError(`Date must be on or before ${isoToDisplay(max)}.`);
      return;
    }

    setError('');
    setDisplay(isoToDisplay(iso));
    onChange(iso);
  }

  function chooseDate(iso: string) {
    setError('');
    setDisplay(isoToDisplay(iso));
    onChange(iso);
  }

  function openCalendar() {
    if (disabled) return;
    const input = nativeRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  }

  return (
    <div className="easy-date-field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      <div className="easy-date-row">
        <input
          id={id}
          className="input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM/DD/YYYY"
          value={display}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setDisplay(event.target.value);
            setError('');
          }}
          onBlur={commitDisplay}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDisplay();
            }
          }}
        />
        <button type="button" className="btn" disabled={disabled} onClick={openCalendar} aria-label="Open calendar">
          Calendar
        </button>
        <input
          ref={nativeRef}
          type="date"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          onChange={(event) => chooseDate(event.target.value)}
        />
      </div>
      {showQuickDates && !disabled ? (
        <div className="inline-actions" style={{ marginTop: 8 }}>
          <button type="button" className="btn" onClick={() => chooseDate(offsetDate(0))}>Today</button>
          <button type="button" className="btn" onClick={() => chooseDate(offsetDate(1))}>Tomorrow</button>
          {value ? <button type="button" className="btn" onClick={() => chooseDate('')}>Clear</button> : null}
        </div>
      ) : null}
      {error ? <p className="auth-message auth-message-error" style={{ marginTop: 6 }}>{error}</p> : null}
    </div>
  );
}
