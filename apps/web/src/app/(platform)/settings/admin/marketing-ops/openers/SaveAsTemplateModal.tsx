'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, RefreshCw, AlertTriangle, BookmarkPlus } from 'lucide-react';
import {
  marketingOpsService,
  HOOK_ANGLES,
  MANUAL_ANCHOR_TYPES,
  type ManualPlayField,
  type ManualTemplateListItem,
} from '@/services/MarketingOpsService';

/**
 * Save-as-template capture modal (spec §3/§6 — operator-authored
 * templates for the Manual tab). Snapshots the current editor state —
 * field values become slot defaultValues, free construction vars
 * become 'note' slots — and POSTs to /manual-script-templates.
 *
 * When the source template is already operator-authored, the modal
 * opens in "Update" mode (PUT) with a "save as new instead" toggle.
 */

interface SaveAsTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (created: { key: string; label: string }) => void;
  campaignId: string;
  sourceTemplate: ManualTemplateListItem;
  /** Current editor field values (raw — {{placeholders}} intact). */
  fields: Record<string, string>;
  scriptBody: string;
  mergeCtx: Record<string, string>;
  dirty: boolean;
  /** All template keys already in the dropdown (catalog + operator). */
  existingKeys: string[];
}

const KEY_PATTERN = /^op_[a-z0-9][a-z0-9_]{1,76}$/;

function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 77);
  return `op_${slug || 'play'}`;
}

export default function SaveAsTemplateModal({
  open,
  onClose,
  onSaved,
  campaignId,
  sourceTemplate,
  fields,
  scriptBody,
  mergeCtx,
  dirty,
  existingKeys,
}: SaveAsTemplateModalProps) {
  const isOperatorSource = sourceTemplate.source === 'operator';
  const [mode, setMode] = useState<'create' | 'update'>(isOperatorSource ? 'update' : 'create');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [anchorType, setAnchorType] = useState('custom');
  const [hookAngle, setHookAngle] = useState<string>('');
  const [signal, setSignal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [keyConflict, setKeyConflict] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset form state whenever the modal opens (or the source changes).
  useEffect(() => {
    if (!open) return;
    setMode(isOperatorSource ? 'update' : 'create');
    setLabel(isOperatorSource ? sourceTemplate.label : `${sourceTemplate.label} — custom`);
    setKey(isOperatorSource ? sourceTemplate.key : slugify(`${sourceTemplate.label} custom`));
    setKeyTouched(false);
    setDescription(sourceTemplate.description);
    setAnchorType(sourceTemplate.anchorType ?? 'custom');
    setHookAngle(sourceTemplate.hookAngle ?? '');
    setSignal(sourceTemplate.suggestedWhenSignal ?? '');
    setFormError(null);
    setKeyConflict(false);
  }, [open, isOperatorSource, sourceTemplate]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Debounced key availability — checks catalog keys (existingKeys covers
  // them) + operator rows.
  useEffect(() => {
    if (!open || mode !== 'create' || !KEY_PATTERN.test(key)) {
      setKeyConflict(false);
      return;
    }
    const handle = setTimeout(async () => {
      if (existingKeys.includes(key)) {
        setKeyConflict(true);
        return;
      }
      const rows = await marketingOpsService.listOperatorManualTemplates();
      setKeyConflict(rows.some((r) => r.key === key));
    }, 250);
    return () => clearTimeout(handle);
  }, [open, mode, key, existingKeys]);

  // Captured slots: source schema with defaultValue ← current editor
  // values; free construction vars (fields keys not in the schema)
  // appended as 'note' slots so they survive as first-class slots.
  const capturedFields = useMemo((): ManualPlayField[] => {
    const schema = sourceTemplate.fields.map((f) => ({
      ...f,
      defaultValue: fields[f.key] ?? f.defaultValue,
    }));
    const schemaKeys = new Set(schema.map((f) => f.key));
    const extras = Object.keys(fields)
      .filter((k) => !schemaKeys.has(k))
      .map((k) => ({
        key: k,
        label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        role: 'note' as const,
        placeholder: '',
        defaultValue: fields[k],
      }));
    return [...schema, ...extras];
  }, [sourceTemplate, fields]);

  // Hygiene lint (spec §6.4): campaign-specific literals baked into a
  // reusable template — advisory, never blocks.
  const hygieneWarnings = useMemo(() => {
    const captured = [...capturedFields.map((f) => f.defaultValue), scriptBody];
    const warnings: string[] = [];
    const business = mergeCtx.business;
    const city = mergeCtx.city;
    if (business && captured.some((t) => t.includes(business))) {
      warnings.push(`"${business}" looks campaign-specific — replace with {{business}}?`);
    }
    if (city && captured.some((t) => t.includes(city))) {
      warnings.push(`"${city}" looks campaign-specific — replace with {{city}}?`);
    }
    if (captured.some((t) => /\/directory\/claim\//.test(t))) {
      warnings.push('A literal claim URL is captured — replace with {{claim_url}}?');
    }
    return warnings;
  }, [capturedFields, scriptBody, mergeCtx]);

  if (!open) return null;

  const keyValid = mode === 'update' || (KEY_PATTERN.test(key) && !keyConflict);
  const canSubmit = label.trim().length > 0 && keyValid && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (mode === 'update') {
        const row = await marketingOpsService.updateManualTemplate(sourceTemplate.key, {
          label: label.trim(),
          description: description.trim(),
          anchor_type: anchorType,
          hook_angle: hookAngle || null,
          suggested_when_signal: signal.trim() || null,
          fields: capturedFields,
          script_body: scriptBody,
        });
        onSaved({ key: row.key, label: row.label });
      } else {
        const row = await marketingOpsService.createManualTemplate({
          key,
          label: label.trim(),
          description: description.trim(),
          anchor_type: anchorType,
          hook_angle: hookAngle || null,
          suggested_when_signal: signal.trim() || null,
          fields: capturedFields,
          script_body: scriptBody,
          created_from_campaign_id: campaignId,
          created_from_template_key: sourceTemplate.key,
        });
        onSaved({ key: row.key, label: row.label });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Save as template"
        className="w-full max-w-md rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <BookmarkPlus className="w-4 h-4 text-violet-500" />
            {mode === 'update' ? `Update "${sourceTemplate.label}"` : 'Save as template'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isOperatorSource && (
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode('update')}
              className={`px-2.5 py-1 rounded-md font-medium ${mode === 'update' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Update this template
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setLabel(`${sourceTemplate.label} — copy`);
                if (!keyTouched) setKey(slugify(`${sourceTemplate.label} copy`));
              }}
              className={`px-2.5 py-1 rounded-md font-medium ${mode === 'create' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Save as new instead
            </button>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Template name
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (!keyTouched && mode === 'create') setKey(slugify(e.target.value));
            }}
            className={inputCls}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Key {mode === 'update' && <span className="font-normal text-gray-400">— immutable</span>}
          </label>
          <input
            type="text"
            value={key}
            disabled={mode === 'update'}
            onChange={(e) => {
              setKeyTouched(true);
              // op_ prefix locked — keep it intact, sanitize the rest
              const raw = e.target.value.toLowerCase();
              setKey(raw.startsWith('op_') ? raw : `op_${raw.replace(/^o?p?_?/, '')}`);
            }}
            className={`${inputCls} font-mono disabled:opacity-60`}
          />
          {mode === 'create' && key.length > 0 && !KEY_PATTERN.test(key) && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              Must match op_&lt;slug&gt; — lowercase letters, digits, underscores.
            </p>
          )}
          {keyConflict && (
            <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">That key is taken.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </div>

        <details className="rounded-lg border border-gray-200 dark:border-neutral-700">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 select-none">
            Advanced
          </summary>
          <div className="px-3 pb-3 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                Anchor type
              </label>
              <select value={anchorType} onChange={(e) => setAnchorType(e.target.value)} className={inputCls}>
                {MANUAL_ANCHOR_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                Hook angle
              </label>
              <select value={hookAngle} onChange={(e) => setHookAngle(e.target.value)} className={inputCls}>
                <option value="">None</option>
                {HOOK_ANGLES.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                Suggested when signal
              </label>
              <input
                type="text"
                value={signal}
                onChange={(e) => setSignal(e.target.value)}
                placeholder="e.g. WC_MISSING_AVAILABILITY_INQUIRY"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
        </details>

        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Capturing {capturedFields.length} field slot{capturedFields.length === 1 ? '' : 's'} · script body{' '}
          {scriptBody.length.toLocaleString()} chars · from <code className="font-mono">{sourceTemplate.key}</code> on
          campaign <code className="font-mono">{campaignId}</code>
          {dirty && ' · includes unsaved edits'}
        </p>

        {hygieneWarnings.length > 0 && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
            {hygieneWarnings.map((w) => (
              <p key={w} className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {w}
              </p>
            ))}
          </div>
        )}

        {formError && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {formError}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {mode === 'update' ? 'Update template' : 'Save template'}
          </button>
        </div>
      </div>
    </div>
  );
}
