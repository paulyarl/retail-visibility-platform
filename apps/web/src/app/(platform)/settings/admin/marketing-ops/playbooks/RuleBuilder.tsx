'use client';

/**
 * RuleBuilder — structured editor for the §6.4 matching_rules DSL
 *
 * Replaces raw-JSON editing with a visual editor for the any/all/none/dual
 * set-membership clauses. Signal pickers are multi-select dropdowns sourced
 * live from the signal registry, so newly registered signals appear immediately.
 *
 * Includes a plain-language preview ("Matches when ANY of … is present AND
 * NONE of … is present") and a confidence slider.
 *
 * A raw-JSON toggle is kept as an advanced escape hatch with round-trip.
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, X, Code2, Eye } from 'lucide-react';
import type { MatchingRules, SignalRegistryEntry } from '@/services/MarketingOpsService';

interface RuleBuilderProps {
  rules: MatchingRules;
  signals: SignalRegistryEntry[];
  onChange: (rules: MatchingRules) => void;
}

const FAMILY_COLORS: Record<string, string> = {
  RA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  DS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  WC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  VP: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

function familyColor(code: string): string {
  return FAMILY_COLORS[code.split('_')[0]] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function SignalPicker({
  label,
  selected,
  signals,
  onChange,
  description,
}: {
  label: string;
  selected: string[];
  signals: SignalRegistryEntry[];
  onChange: (codes: string[]) => void;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const available = signals.filter((s) => !selected.includes(s.code) && (
    filter === '' ||
    s.code.toLowerCase().includes(filter.toLowerCase()) ||
    s.label.toLowerCase().includes(filter.toLowerCase())
  ));

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-semibold text-gray-900 dark:text-white">{label}</span>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <span className="text-[10px] text-gray-400">{selected.length} selected</span>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map((code) => (
            <span
              key={code}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${familyColor(code)}`}
            >
              {code}
              <button onClick={() => toggle(code)} className="hover:text-black dark:hover:text-white">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full text-left px-2 py-1.5 text-xs text-gray-500 border border-gray-200 dark:border-neutral-600 rounded hover:bg-gray-50 dark:hover:bg-neutral-700"
        >
          {available.length === 0 ? 'No more signals to add' : `Add signal (${available.length} available)`}
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-auto bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg shadow-lg">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter signals..."
              className="w-full px-2 py-1.5 text-xs border-b border-gray-100 dark:border-neutral-700 bg-transparent outline-none"
              autoFocus
            />
            {available.length === 0 ? (
              <p className="text-xs text-gray-400 p-2 text-center">No matching signals</p>
            ) : (
              available.map((signal) => (
                <button
                  key={signal.code}
                  onClick={() => { toggle(signal.code); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 flex items-start gap-2"
                >
                  <span className={`flex-shrink-0 inline-block rounded px-1.5 py-0.5 text-[9px] font-mono font-medium ${familyColor(signal.code)}`}>
                    {signal.code}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-300 flex-1">{signal.label}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RuleBuilder({ rules, signals, onChange }: RuleBuilderProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [rawText, setRawText] = useState('');

  const update = (patch: Partial<MatchingRules>) => {
    onChange({ ...rules, ...patch });
  };

  const plainLanguagePreview = useMemo(() => {
    const parts: string[] = [];
    if (rules.any.length > 0) parts.push(`ANY of ${rules.any.join(', ')}`);
    if (rules.all.length > 0) parts.push(`ALL of ${rules.all.join(', ')}`);
    if (rules.none.length > 0) parts.push(`NONE of ${rules.none.join(', ')}`);
    if (rules.dual) {
      const ga = rules.dual.groupA.join(', ');
      const gb = rules.dual.groupB.join(', ');
      parts.push(`DUAL (groupA: ${ga}) AND (groupB: ${gb})`);
    }
    if (parts.length === 0) return 'No rules defined — this playbook will match any signal set.';
    return `Matches when ${parts.join(' AND ')}`;
  }, [rules]);

  const toggleRaw = () => {
    if (!showRaw) {
      setRawText(JSON.stringify(rules, null, 2));
    } else {
      try {
        const parsed = JSON.parse(rawText);
        onChange({
          any: parsed.any ?? [],
          all: parsed.all ?? [],
          none: parsed.none ?? [],
          dual: parsed.dual ?? null,
          confidence: parsed.confidence ?? 0.85,
        });
      } catch {
        // Keep raw text if invalid — user can fix
      }
    }
    setShowRaw((v) => !v);
  };

  return (
    <div className="space-y-3">
      {/* Plain-language preview */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <span className="font-semibold">Preview:</span> {plainLanguagePreview}
        </p>
      </div>

      {/* Toggle raw JSON */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Rule Clauses</span>
        <button
          onClick={toggleRaw}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {showRaw ? <><Eye className="w-3 h-3" /> Visual editor</> : <><Code2 className="w-3 h-3" /> Raw JSON</>}
        </button>
      </div>

      {showRaw ? (
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          onBlur={() => {
            try {
              const parsed = JSON.parse(rawText);
              onChange({
                any: parsed.any ?? [],
                all: parsed.all ?? [],
                none: parsed.none ?? [],
                dual: parsed.dual ?? null,
                confidence: parsed.confidence ?? 0.85,
              });
            } catch {
              // invalid — keep editing
            }
          }}
          rows={12}
          className="w-full font-mono text-xs p-3 border border-gray-200 dark:border-neutral-600 rounded-lg bg-gray-50 dark:bg-neutral-900 text-gray-800 dark:text-gray-200"
        />
      ) : (
        <>
          <SignalPicker
            label="ANY (trigger)"
            description="Match if at least ONE of these signals is present"
            selected={rules.any}
            signals={signals}
            onChange={(codes) => update({ any: codes })}
          />
          <SignalPicker
            label="ALL (required)"
            description="Match only if ALL of these signals are present"
            selected={rules.all}
            signals={signals}
            onChange={(codes) => update({ all: codes })}
          />
          <SignalPicker
            label="NONE (guard)"
            description="Block match if ANY of these signals is present (crisis guard)"
            selected={rules.none}
            signals={signals}
            onChange={(codes) => update({ none: codes })}
          />

          {/* Dual clause */}
          <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-gray-900 dark:text-white">DUAL (cross-family)</span>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Match if ≥1 from groupA AND ≥1 from groupB (e.g. repair + review)
                </p>
              </div>
              <label className="flex items-center gap-1 text-[10px] text-gray-500">
                <input
                  type="checkbox"
                  checked={rules.dual !== null}
                  onChange={(e) => update({ dual: e.target.checked ? { groupA: [], groupB: [] } : null })}
                />
                Enable
              </label>
            </div>
            {rules.dual && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SignalPicker
                  label="Group A"
                  description="First family (e.g. repair signals)"
                  selected={rules.dual.groupA}
                  signals={signals}
                  onChange={(codes) => update({ dual: { ...rules.dual!, groupA: codes } })}
                />
                <SignalPicker
                  label="Group B"
                  description="Second family (e.g. review signals)"
                  selected={rules.dual.groupB}
                  signals={signals}
                  onChange={(codes) => update({ dual: { ...rules.dual!, groupB: codes } })}
                />
              </div>
            )}
          </div>

          {/* Confidence slider */}
          <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-900 dark:text-white">Confidence</span>
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                {Math.round(rules.confidence * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={rules.confidence}
              onChange={(e) => update({ confidence: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Rule confidence / signal match strength (not ML probability)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
