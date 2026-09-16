'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Save, Copy, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Phone,
  BookmarkPlus, Upload,
} from 'lucide-react';
import {
  marketingOpsService,
  type ManualScript,
  type ManualTemplateListItem,
  type ManualFieldRole,
} from '@/services/MarketingOpsService';
import SaveAsTemplateModal from './SaveAsTemplateModal';
import ConstructionVariablesPanel, {
  type ConstructionVariable,
} from './ConstructionVariablesPanel';
import { useConstructionVariables, resolveVar } from './constructionVariables';

/**
 * Manual tab — the operator playground / producer lane.
 *
 * Operators pick a code-defined template, edit field slots + the script
 * body, and save a working doc per campaign (mkt_campaign_manual_scripts).
 * The doc reloads whenever the campaign is selected.
 *
 * Promotion pushes slots into the shared pipeline rows the other tabs
 * consume — openers/headers/closers land in Pitch Construction via the
 * existing import endpoints; the thesis slots become a campaign anchor
 * that surfaces in the Call Script tab's anchor picker. The detected
 * archetype is never touched.
 */

interface ManualScriptPanelProps {
  campaignId: string;
  /** Called after a slot is promoted into a shared pipeline row.
      'opener'|'header'|'closer' → parent switches to Pitch Construction. */
  onPromoted?: (kind: 'opener' | 'header' | 'closer' | 'anchor') => void;
}

const ROLE_BADGES: Record<ManualFieldRole, { label: string; classes: string }> = {
  opener: { label: 'Opener', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  header: { label: 'Header', classes: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  closer: { label: 'Closer', classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  thesis: { label: 'Anchor thesis', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  note: { label: 'Merge value', classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

export default function ManualScriptPanel({ campaignId, onPromoted }: ManualScriptPanelProps) {
  const [templates, setTemplates] = useState<ManualTemplateListItem[]>([]);
  const [scripts, setScripts] = useState<ManualScript[]>([]);
  const [mergeCtx, setMergeCtx] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState<{ key: string; label: string } | null>(null);

  const [selectedKey, setSelectedKey] = useState('');
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [scriptBody, setScriptBody] = useState('');
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Cross-tab Construction Variables store (localStorage, per campaign).
  // Shared with the Pitch Construction tab so a value entered on either tab
  // shows up on the other without retyping.
  const { vars: sharedVars, setVar: setSharedVar, setVars: setSharedVars } =
    useConstructionVariables(campaignId);

  const template = useMemo(
    () => templates.find((t) => t.key === selectedKey) ?? null,
    [templates, selectedKey],
  );
  const savedDoc = useMemo(
    () => scripts.find((s) => s.template_key === selectedKey) ?? null,
    [scripts, selectedKey],
  );

  const loadDoc = useCallback((tpl: ManualTemplateListItem, doc: ManualScript | null) => {
    if (doc) {
      setTitle(doc.title);
      setFields({ ...doc.fields });
      setScriptBody(doc.script_body);
    } else {
      setTitle(tpl.label);
      const defaults: Record<string, string> = {};
      for (const f of tpl.fields) defaults[f.key] = f.defaultValue;
      setFields(defaults);
      setScriptBody(tpl.scriptBody);
    }
    setDirty(false);
    setPromoteError(null);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tpls, docs, ctxMap] = await Promise.all([
        marketingOpsService.listManualScriptTemplates(campaignId),
        marketingOpsService.listManualScripts(campaignId),
        marketingOpsService.getManualScriptMergeContext(campaignId),
      ]);
      setTemplates(tpls);
      setScripts(docs);
      setMergeCtx(ctxMap);
      // Default selection: a suggested template, else the first with a
      // saved doc, else the first in the catalog.
      const suggested = tpls.find((t) => t.suggested);
      const withDoc = tpls.find((t) => t.saved);
      const pick = suggested ?? withDoc ?? tpls[0];
      if (pick) {
        setSelectedKey(pick.key);
        loadDoc(pick, docs.find((d) => d.template_key === pick.key) ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manual scripts');
    } finally {
      setLoading(false);
    }
  }, [campaignId, loadDoc]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSelect = (key: string) => {
    if (key === selectedKey) return;
    setSelectedKey(key);
    const tpl = templates.find((t) => t.key === key);
    if (tpl) loadDoc(tpl, scripts.find((d) => d.template_key === key) ?? null);
  };

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    setPromoteError(null);
    try {
      const saved = await marketingOpsService.saveManualScript(campaignId, {
        template_key: template.key,
        title,
        fields,
        script_body: scriptBody,
      });
      setScripts((prev) => {
        const rest = prev.filter((s) => s.template_key !== saved.template_key);
        return [saved, ...rest];
      });
      setTemplates((prev) => prev.map((t) => t.key === saved.template_key ? { ...t, saved: true } : t));
      setDirty(false);
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const stampPromotion = async (patch: Partial<Pick<ManualScript,
    'promoted_opener_id' | 'promoted_anchor_id' | 'promoted_header_id' | 'promoted_closer_id'>>) => {
    if (!template) return;
    const saved = await marketingOpsService.saveManualScript(campaignId, {
      template_key: template.key,
      ...patch,
    });
    setScripts((prev) => prev.map((s) => s.id === saved.id ? saved : s));
    return saved;
  };

  const fieldValue = (role: ManualFieldRole, preferKey?: string): string | null => {
    const slot = template?.fields.find((f) => f.key === preferKey)
      ?? template?.fields.find((f) => f.role === role);
    if (!slot) return null;
    return savedDoc?.resolved_fields[slot.key] ?? fields[slot.key] ?? null;
  };

  const promoteOpener = async () => {
    const text = fieldValue('opener');
    if (!text?.trim()) return;
    setPromoting('opener');
    setPromoteError(null);
    try {
      const result = await marketingOpsService.importOpener(
        campaignId, text.trim(), undefined, undefined, template?.hookAngle ?? null,
      );
      await stampPromotion({ promoted_opener_id: result.opener.id });
      onPromoted?.('opener');
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Failed to promote opener');
    } finally {
      setPromoting(null);
    }
  };

  const promoteHeader = async () => {
    const text = fieldValue('header');
    if (!text?.trim()) return;
    setPromoting('header');
    setPromoteError(null);
    try {
      const result = await marketingOpsService.importHeader(campaignId, text.trim());
      await stampPromotion({ promoted_header_id: result.header?.id ?? null });
      onPromoted?.('header');
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Failed to promote header');
    } finally {
      setPromoting(null);
    }
  };

  const promoteCloser = async () => {
    const text = fieldValue('closer');
    if (!text?.trim()) return;
    setPromoting('closer');
    setPromoteError(null);
    try {
      const result = await marketingOpsService.importCloser(campaignId, text.trim());
      const closerId = (result as any).closer?.id ?? (result as any).header?.id ?? null;
      await stampPromotion({ promoted_closer_id: closerId });
      onPromoted?.('closer');
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Failed to promote closer');
    } finally {
      setPromoting(null);
    }
  };

  const promoteAnchor = async () => {
    if (!template) return;
    const thesis = fieldValue('thesis', 'operator_thesis');
    const verifyQ = fieldValue('thesis', 'verification_question');
    if (!thesis?.trim() || !verifyQ?.trim()) {
      setPromoteError('Anchor promotion needs the operator thesis + verification question slots filled');
      return;
    }
    setPromoting('anchor');
    setPromoteError(null);
    try {
      const anchor = await marketingOpsService.createCampaignAnchor(campaignId, {
        anchorType: template.anchorType,
        title,
        operatorThesis: thesis.trim(),
        observedIssue: fieldValue('note', 'observed_gap') ?? undefined,
        verificationQuestion: verifyQ.trim(),
        painQuestion: fieldValue('thesis', 'pain_question') ?? undefined,
        recommendedTransition: fieldValue('thesis', 'recommended_transition') ?? undefined,
      });
      await stampPromotion({ promoted_anchor_id: anchor.id });
      onPromoted?.('anchor');
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Failed to create anchor');
    } finally {
      setPromoting(null);
    }
  };

  // Send the opener straight to the Opener tab's "Import External Opener"
  // box — same custom-event bridge the Pitch tab's "Use this hook" uses. The
  // Opener tab loads the text and switches to itself.
  const sendToImportOpener = () => {
    const text = fieldValue('opener');
    if (!text?.trim()) {
      setPromoteError('Opener slot is empty — nothing to send');
      return;
    }
    setPromoteError(null);
    window.dispatchEvent(
      new CustomEvent('hook-selected', {
        detail: { body: text.trim(), angle: template?.hookAngle ?? null },
      }),
    );
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // ─── Construction Variables ─────────────────────────────────────────
  // Scan script body + field values for {{var}} — every detected variable
  // gets a fill-in input (mirrors the Pitch Construction panel). Values
  // persist on the doc's fields jsonb and merge at read
  // (fieldCtx = { ...mergeContext, ...fields } — fields win):
  //   slot — a declared template field key ({{observed_gap}}); the input
  //          edits the same fields[key] the Play-fields inputs bind
  //   auto — a global merge key ({{business}} etc.); the campaign value
  //          shows as the placeholder — typing overrides it, clearing
  //          restores the campaign value
  //   free — anything else; stored as a plain merge value
  const detectedVars = useMemo(() => {
    const found = new Set<string>();
    const scan = (text: string) => {
      for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) found.add(m[1]);
    };
    scan(scriptBody);
    for (const v of Object.values(fields)) scan(v);
    const slotKeys = new Set((template?.fields ?? []).map((f) => f.key));
    return Array.from(found).map((key) => ({
      key,
      kind: slotKeys.has(key)
        ? ('slot' as const)
        : key in mergeCtx
          ? ('auto' as const)
          : ('free' as const),
      slotLabel: template?.fields.find((f) => f.key === key)?.label,
      mergeValue: mergeCtx[key],
    }));
  }, [scriptBody, fields, template, mergeCtx]);

  // Live preview — mirrors server fieldCtx ordering (fields win over
  // mergeCtx). Server resolved_body stays authoritative for promotion.
  const resolveClientMerge = useCallback(
    (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (m, k) => fields[k] ?? mergeCtx[k] ?? m),
    [fields, mergeCtx],
  );

  const setVarValue = (key: string, value: string) => {
    setFields((prev) => {
      const next = { ...prev };
      if (value === '') delete next[key];
      else next[key] = value;
      return next;
    });
    // Mirror into the cross-tab store so the Pitch Construction tab sees it.
    setSharedVar(key, value);
    setDirty(true);
  };

  // Cross-tab sync with the shared Construction Variables store:
  //   • doc values the store is missing → push to the store (Pitch sees them)
  //   • store values the doc is missing → pull into fields (Manual sees Pitch)
  // Only detected vars sync; the doc's `fields` stays authoritative for the
  // server-side merge and for promotion.
  useEffect(() => {
    if (!template || detectedVars.length === 0) return;
    const push: Record<string, string> = {};
    const pull: Record<string, string> = {};
    for (const v of detectedVars) {
      const shared = resolveVar(sharedVars, v.key);
      const docVal = fields[v.key];
      const hasDoc = !!docVal && !!docVal.trim();
      if (!shared && hasDoc) push[v.key] = docVal;
      else if (shared && !hasDoc) pull[v.key] = shared;
    }
    if (Object.keys(push).length > 0) setSharedVars(push);
    if (Object.keys(pull).length > 0) {
      setFields((prev) => ({ ...prev, ...pull }));
      setDirty(true);
    }
  }, [detectedVars, sharedVars, fields, template, setSharedVars]);

  // Variables for the shared panel — same shape the Pitch tab consumes.
  const panelVariables: ConstructionVariable[] = detectedVars.map((v) => ({
    key: v.key,
    hint: v.mergeValue ?? v.key,
    kind: v.kind,
    label: v.kind === 'slot' ? v.slotLabel : undefined,
  }));

  const handleTemplateSaved = useCallback(
    (created: { key: string; label: string }) => {
      setTemplateModalOpen(false);
      setTemplateSavedMsg({ key: created.key, label: created.label });
    },
    [],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  const hasRole = (role: ManualFieldRole) => template?.fields.some((f) => f.role === role);
  const canPromote = !!savedDoc && !dirty;
  // Live preview — resolves against mergeCtx + fields as the operator
  // types (spec §9.5). Unresolvable placeholders stay literal.
  const previewBody = resolveClientMerge(scriptBody);

  return (
    <div className="space-y-5">
      {/* Producer-lane framing — makes clear this lane does not touch the
          detected archetype and writes into the shared pipeline. */}
      <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4">
        <p className="text-xs text-violet-800 dark:text-violet-300">
          <strong>Manual lane.</strong> Author a play from a template, save it per campaign, then promote
          slots into the pipeline — openers, headers, and closers land in Pitch Construction; the thesis
          becomes an anchor in Call Script. The detected archetype is never changed.
        </p>
      </div>

      {/* Construction Variables — top of the tab so the operator fills the
          essential values first, then edits the body. Shared store with the
          Pitch Construction tab (values carry across tabs). */}
      {template && (
        <ConstructionVariablesPanel
          variables={panelVariables}
          values={fields}
          onChange={setVarValue}
          hintText="Fill first — values carry to Pitch Construction"
        />
      )}

      {/* Template picker */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Play template</h2>
          <button
            type="button"
            onClick={() => setTemplateModalOpen(true)}
            disabled={!template}
            title="Snapshot this play (fields + script body) as a reusable template for every campaign"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            {template?.source === 'operator' ? 'Update template' : 'Save as template'}
          </button>
        </div>
        <select
          value={selectedKey}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
              {t.source === 'operator' ? ' — custom' : ''}
              {t.source === 'operator' && t.status === 'archived' ? ' (archived)' : ''}
              {t.suggested ? ' — suggested (signal detected)' : ''}
              {t.saved ? ' — saved' : ''}
            </option>
          ))}
        </select>
        {template && (
          <div className="mt-2 flex items-start gap-2">
            {template.suggested && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <Sparkles className="w-3 h-3" /> Suggested — audit signal fired
              </span>
            )}
            {template.source === 'operator' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                Custom{template.status === 'archived' ? ' · archived' : ''}
              </span>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">{template.description}</p>
          </div>
        )}
        {templateSavedMsg && (
          <div className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center justify-between gap-2">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Template saved — <strong>{templateSavedMsg.label}</strong> is now in the list for every campaign.
            </p>
            <button
              type="button"
              onClick={async () => {
                const saved = templateSavedMsg;
                const tpls = await marketingOpsService.listManualScriptTemplates(campaignId);
                setTemplates(tpls);
                setTemplateSavedMsg(null);
                const fresh = tpls.find((t) => t.key === saved.key);
                if (fresh && fresh.key !== selectedKey) {
                  setSelectedKey(fresh.key);
                  loadDoc(fresh, scripts.find((d) => d.template_key === fresh.key) ?? null);
                }
              }}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline whitespace-nowrap"
            >
              Switch to it →
            </button>
          </div>
        )}
      </div>

      {template && (
        <>
          {/* Title + field slots */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Play fields</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {template.fields.map((f) => (
              <div key={f.key}>
                <div className="flex items-center gap-2 mb-1">
                  <label htmlFor={`manual-field-${f.key}`} className="text-xs font-medium text-gray-600 dark:text-gray-400">{f.label}</label>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ROLE_BADGES[f.role].classes}`}>
                    {ROLE_BADGES[f.role].label}
                  </span>
                </div>
                {f.role === 'opener' || f.role === 'thesis' ? (
                  <textarea
                    id={`manual-field-${f.key}`}
                    value={fields[f.key] ?? ''}
                    onChange={(e) => { setFields((p) => ({ ...p, [f.key]: e.target.value })); setDirty(true); }}
                    placeholder={f.placeholder}
                    rows={f.role === 'opener' ? 8 : 3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                ) : (
                  <input
                    id={`manual-field-${f.key}`}
                    type="text"
                    value={fields[f.key] ?? ''}
                    onChange={(e) => { setFields((p) => ({ ...p, [f.key]: e.target.value })); setDirty(true); }}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Script body + resolved preview */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Script body <span className="font-normal text-gray-400">({'{{business}}'} {'{{category}}'} {'{{claim_url}}'} and field keys merge at read)</span>
              </label>
              <textarea
                value={scriptBody}
                onChange={(e) => { setScriptBody(e.target.value); setDirty(true); }}
                rows={10}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Resolved preview <span className="font-normal text-gray-400">— live</span>
                </label>
                <button
                  type="button"
                  onClick={() => copyText('body', previewBody)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {copied === 'body' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  Copy
                </button>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-3">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">{previewBody}</pre>
              </div>
            </div>
          </div>

          {promoteError && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {promoteError}
              </p>
            </div>
          )}

          {/* Save + pipeline actions */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save play'}
              </button>
              {savedDoc && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Saved {new Date(savedDoc.updated_at).toLocaleString()}
                  {savedDoc.updated_by ? ` · ${savedDoc.updated_by}` : ''}
                </p>
              )}
              {!savedDoc && (
                <p className="text-xs text-gray-400">Not saved yet — promotion unlocks after save.</p>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-neutral-700 pt-4">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Promote into pipeline</h3>
              <div className="flex flex-wrap items-center gap-2">
                {hasRole('opener') && (
                  <PromoteButton
                    label="Use as opener"
                    title="Import as opener → Pitch Construction"
                    busy={promoting === 'opener'}
                    disabled={!canPromote || !!promoting}
                    onClick={promoteOpener}
                    done={!!savedDoc?.promoted_opener_id}
                    doneLabel={savedDoc?.promoted_opener_id ?? ''}
                  />
                )}
                {hasRole('opener') && (
                  <button
                    type="button"
                    onClick={sendToImportOpener}
                    title="Load this opener into tab 2's Import External Opener box"
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-300 rounded-lg hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Send to Import Opener
                  </button>
                )}
                {hasRole('header') && (
                  <PromoteButton
                    label="Send subject"
                    title="Import as header → Pitch Construction"
                    busy={promoting === 'header'}
                    disabled={!canPromote || !!promoting}
                    onClick={promoteHeader}
                    done={!!savedDoc?.promoted_header_id}
                    doneLabel={savedDoc?.promoted_header_id ?? ''}
                  />
                )}
                {hasRole('closer') && (
                  <PromoteButton
                    label="Send closer"
                    title="Import as closer → Pitch Construction"
                    busy={promoting === 'closer'}
                    disabled={!canPromote || !!promoting}
                    onClick={promoteCloser}
                    done={!!savedDoc?.promoted_closer_id}
                    doneLabel={savedDoc?.promoted_closer_id ?? ''}
                  />
                )}
                {hasRole('thesis') && (
                  <button
                    type="button"
                    onClick={promoteAnchor}
                    disabled={!canPromote || !!promoting}
                    title="Create a campaign anchor → Call Script anchor picker"
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700"
                  >
                    {promoting === 'anchor' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                    Save as anchor
                    {savedDoc?.promoted_anchor_id && (
                      <span className="text-amber-500">· {savedDoc.promoted_anchor_id}</span>
                    )}
                  </button>
                )}
              </div>
              {dirty && savedDoc && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Unsaved changes — promotion uses the last saved version. Save first to promote current edits.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {template && (
        <SaveAsTemplateModal
          open={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          onSaved={handleTemplateSaved}
          campaignId={campaignId}
          sourceTemplate={template}
          fields={fields}
          scriptBody={scriptBody}
          mergeCtx={mergeCtx}
          dirty={dirty}
          existingKeys={templates.map((t) => t.key)}
        />
      )}
    </div>
  );
}

function PromoteButton({
  label, title, busy, disabled, onClick, done, doneLabel,
}: {
  label: string;
  title: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  done: boolean;
  doneLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700"
    >
      {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
      {label}
      {done && <span className="text-blue-400">· {doneLabel}</span>}
    </button>
  );
}
