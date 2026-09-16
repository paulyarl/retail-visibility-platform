'use client';

/**
 * ConstructionVariablesPanel — shared operator fill-in panel for the openers
 * workspace. Used by both the Manual tab (producer lane) and the Pitch
 * Construction tab so the two tabs present and edit the same variables with
 * one interaction pattern.
 *
 * Presentational only: the parent owns detection (`variables`) and the value
 * map (`values`), so each tab keeps its own persistence model (Manual → doc
 * `fields` jsonb; Pitch → the shared localStorage store) while the UI stays
 * identical.
 *
 * `kind: 'auto'` renders the "overrides campaign value — clear" affordance
 * when an operator value shadows a resolved campaign value.
 */

import { useState } from 'react';

export interface ConstructionVariable {
  key: string;
  /** Placeholder — usually the resolved campaign value (or a hint). */
  hint?: string;
  /** 'auto' → value shadows a campaign merge value (shows override hint). */
  kind?: 'auto' | 'slot' | 'free';
  /** Optional annotation after the key, e.g. a slot label. */
  label?: string;
}

interface ConstructionVariablesPanelProps {
  variables: ConstructionVariable[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  hintText?: string;
  defaultOpen?: boolean;
}

export default function ConstructionVariablesPanel({
  variables,
  values,
  onChange,
  hintText = 'Values save with the doc and merge at read',
  defaultOpen = true,
}: ConstructionVariablesPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="group rounded-lg border border-violet-200 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-900/10"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 select-none flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          Construction Variables
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            {variables.length}
          </span>
        </span>
        <span className="text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-400 group-open:hidden">
          {hintText}
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1">
        {variables.length === 0 ? (
          <p className="text-[11px] text-gray-400">No {'{{placeholders}}'} detected yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {variables.map((v) => {
              const value = values[v.key] ?? '';
              const overridden = v.kind === 'auto' && !!value.trim();
              return (
                <label key={v.key} className="block">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                    {`{{${v.key}}}`}
                    {v.kind === 'slot' && v.label && (
                      <span className="ml-1 font-sans text-blue-600 dark:text-blue-400">← {v.label}</span>
                    )}
                  </span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(v.key, e.target.value)}
                    placeholder={v.hint ?? v.key}
                    className="mt-0.5 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  {overridden && (
                    <span className="mt-0.5 block text-[10px] text-amber-600 dark:text-amber-400">
                      overrides campaign value{v.hint ? ` "${v.hint}"` : ''} —{' '}
                      <button type="button" className="underline" onClick={() => onChange(v.key, '')}>
                        clear
                      </button>
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
