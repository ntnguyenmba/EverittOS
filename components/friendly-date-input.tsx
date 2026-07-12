'use client';

import { useEffect, useMemo, useState } from 'react';

type FriendlyDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
  ariaLabel?: string;
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

export function FriendlyDateInput({
  value,
  onChange,
  disabled = false,
  minYear = new Date().getFullYear() - 10,
  maxYear = new Date().getFullYear() + 10,
  ariaLabel = 'Date'
}: FriendlyDateInputProps) {
  const [selected, setSelected] = useState<DateParts>(() => parseParts(value));

  useEffect(() => {
    setSelected(parseParts(value));
  }, [value]);

  const years = useMemo(() => {
    const rows: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) rows.push(year);
    return rows;
  }, [maxYear, minYear]);

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

    onChange(`${merged.year}-${merged.month}-${merged.day}`);
  }

  return (
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

      <select
        className="input"
        value={selected.year}
        disabled={disabled}
        aria-label={`${ariaLabel} year`}
        onChange={(event) => update({ year: event.target.value })}
      >
        <option value="">Year</option>
        {years.map((year) => <option key={year} value={String(year)}>{year}</option>)}
      </select>
    </div>
  );
}
