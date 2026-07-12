'use client';

import { useEffect, useState } from 'react';

type FriendlyDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
  ariaLabel?: string;
  showQuickDates?: boolean;
};

type DateParts = {
  year: string;
  month: string;
  day: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseParts(value: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { year: '', month: '', day: '' };
  return { year: match[1], month: match[2], day: match[3] };
}

function daysInMonth(year: string, month: string) {
  const numericYear = Number(year) || new Date().getFullYear();
  const numericMonth = Number(month) || 1;
  return new Date(numericYear, numericMonth, 0).getDate();
}

function localIsoDate(offsetDays = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function FriendlyDateInput({
  value,
  onChange,
  disabled = false,
  minYear = new Date().getFullYear() - 100,
  maxYear = new Date().getFullYear() + 20,
  ariaLabel = 'Date',
  showQuickDates = true
}: FriendlyDateInputProps) {
  const [selected, setSelected] = useState<DateParts>(() => parseParts(value));
  const [yearError, setYearError] = useState('');

  useEffect(() => {
    setSelected(parseParts(value));
    setYearError('');
  }, [value]);

  const maxDay = daysInMonth(selected.year, selected.month);

  function update(next: Partial<DateParts>) {
    const merged = { ...selected, ...next };
    if (merged.day && Number(merged.day) > daysInMonth(merged.year, merged.month)) {
      merged.day = String(daysInMonth(merged.year, merged.month)).padStart(2, '0');
    }
    setSelected(merged);

    if (!merged.year || !merged.month || !merged.day) {
      onChange('');
      return;
    }

    const numericYear = Number(merged.year);
    if (!Number.isInteger(numericYear) || numericYear < minYear || numericYear > maxYear) {
      return;
    }

    onChange(`${merged.year.padStart(4, '0')}-${merged.month}-${merged.day}`);
  }

  function validateYear() {
    if (!selected.year) {
      setYearError('');
      return;
    }
    const numericYear = Number(selected.year);
    if (!/^\d{4}$/.test(selected.year) || numericYear < minYear || numericYear > maxYear) {
      setYearError(`Enter a year from ${minYear} to ${maxYear}.`);
      return;
    }
    setYearError('');
    update({ year: selected.year });
  }

  function chooseQuickDate(offsetDays: number) {
    const iso = localIsoDate(offsetDays);
    setSelected(parseParts(iso));
    setYearError('');
    onChange(iso);
  }

  return (
    <div className="friendly-date-field">
      <div
        className="friendly-date-input"
        role="group"
        aria-label={ariaLabel}
        style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1.35fr', gap: 8 }}
      >
        <select
          className="input"
          value={selected.month}
          disabled={disabled}
          aria-label={`${ariaLabel} month`}
          onChange={(event) => update({ month: event.target.value })}
        >
          <option value="">Month</option>
          {MONTHS.map((label, index) => {
            const month = String(index + 1).padStart(2, '0');
            return <option key={month} value={month}>{label}</option>;
          })}
        </select>

        <select
          className="input"
          value={selected.day}
          disabled={disabled}
          aria-label={`${ariaLabel} day`}
          onChange={(event) => update({ day: event.target.value })}
        >
          <option value="">Day</option>
          {Array.from({ length: maxDay }, (_, index) => String(index + 1).padStart(2, '0')).map((day) => (
            <option key={day} value={day}>{Number(day)}</option>
          ))}
        </select>

        <input
          className="input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="Year"
          value={selected.year}
          disabled={disabled}
          aria-label={`${ariaLabel} year`}
          aria-invalid={Boolean(yearError)}
          onChange={(event) => {
            const year = event.target.value.replace(/\D/g, '').slice(0, 4);
            setYearError('');
            update({ year });
          }}
          onBlur={validateYear}
        />
      </div>

      {showQuickDates && !disabled ? (
        <div className="inline-actions" style={{ marginTop: 8 }}>
          <button type="button" className="btn" onClick={() => chooseQuickDate(0)}>Today</button>
          <button type="button" className="btn" onClick={() => chooseQuickDate(1)}>Tomorrow</button>
          {value ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSelected({ year: '', month: '', day: '' });
                setYearError('');
                onChange('');
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {yearError ? <p className="auth-message auth-message-error" style={{ marginTop: 6 }}>{yearError}</p> : null}
    </div>
  );
}
