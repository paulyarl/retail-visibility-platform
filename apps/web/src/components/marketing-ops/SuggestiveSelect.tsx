'use client';

import { useState } from 'react';

const NEW_VALUE = '__new__';

interface SuggestiveSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  emptyLabel?: string;
  newLabel?: string;
  newInputPlaceholder?: string;
  required?: boolean;
  className?: string;
}

/**
 * Dropdown populated with existing values plus a "+ New ..." option that
 * reveals an inline text input (mirrors the Capability Types category pattern).
 */
export default function SuggestiveSelect({
  value,
  onChange,
  options,
  emptyLabel = '-- Select --',
  newLabel = '+ New...',
  newInputPlaceholder = 'Enter new value',
  required,
  className,
}: SuggestiveSelectProps) {
  const [isNew, setIsNew] = useState(false);

  // Keep a current value visible even if it is not in the option list (e.g. edit mode)
  const allOptions = value && !isNew && !options.includes(value)
    ? [...options, value].sort()
    : options;

  return (
    <>
      <select
        value={isNew ? NEW_VALUE : value}
        required={required && !isNew}
        onChange={(e) => {
          const v = e.target.value;
          if (v === NEW_VALUE) {
            setIsNew(true);
            onChange('');
          } else {
            setIsNew(false);
            onChange(v);
          }
        }}
        className={className}
      >
        <option value="">{emptyLabel}</option>
        {allOptions.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value={NEW_VALUE}>{newLabel}</option>
      </select>
      {isNew && (
        <input
          type="text"
          required={required}
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={newInputPlaceholder}
          className={`${className ?? ''} mt-2`}
        />
      )}
    </>
  );
}

/** Extract sorted distinct non-empty values for a field from a list of records. */
export function distinctValues<T>(items: T[], pick: (item: T) => string | null | undefined): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const v = pick(item);
    if (v) {
      for (const part of v.split(',')) {
        const trimmed = part.trim();
        if (trimmed) set.add(trimmed);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
