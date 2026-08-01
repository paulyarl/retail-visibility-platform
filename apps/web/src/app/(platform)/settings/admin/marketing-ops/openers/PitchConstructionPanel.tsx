'use client';

/**
 * PitchConstructionPanel — Pitch assembly UI for the Outreach Openers page.
 *
 * Rendered inside the "Pitch Construction" tab of the openers workspace when
 * a campaign is selected. Lets the admin assemble a full outreach pitch from
 * component variants:
 *   - Opener (selected from existing variants)
 *   - Header (subject line) — dual AI/Import path, split-testable
 *   - 3-slot Preview (review paste + AI/Import owner response, negative-first)
 *   - Closer — dual AI/Import path, pre-filled editable template
 *   - Contact (optional) — simple CRUD
 *   - Assemble → rendered output + Copy/Download + pitch history
 *
 * See: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §1, §5
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Upload,
  Copy,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import marketingOpsService, {
  OutreachOpener,
  OutreachHeader,
  OutreachCloser,
  OutreachContact,
  OutreachPitch,
  ReviewPair,
  CloserResolution,
} from '@/services/MarketingOpsService';

interface PitchConstructionPanelProps {
  campaignId: string;
  openers: OutreachOpener[];
}

export default function PitchConstructionPanel({ campaignId, openers }: PitchConstructionPanelProps) {
  // ─── Variant lists ──────────────────────────────────────────────────
  const [headers, setHeaders] = useState<OutreachHeader[]>([]);
  const [closers, setClosers] = useState<OutreachCloser[]>([]);
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [pitches, setPitches] = useState<OutreachPitch[]>([]);

  // ─── Selections ─────────────────────────────────────────────────────
  const [selectedOpenerId, setSelectedOpenerId] = useState('');
  const [selectedHeaderId, setSelectedHeaderId] = useState('');
  const [selectedCloserId, setSelectedCloserId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');

  // ─── Closer resolution (for default template) ───────────────────────
  const [closerResolution, setCloserResolution] = useState<CloserResolution | null>(null);

  // ─── Review pairs (3 slots) ─────────────────────────────────────────
  const [reviewPairs, setReviewPairs] = useState<ReviewPair[]>([
    { review_text: '', response_text: '', response_source: 'ai', is_negative_first: true },
    { review_text: '', response_text: '', response_source: 'ai', is_negative_first: false },
    { review_text: '', response_text: '', response_source: 'ai', is_negative_first: false },
  ]);
  const [pairLoading, setPairLoading] = useState<number | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);

  // ─── Header AI/Import ───────────────────────────────────────────────
  const [headerImportText, setHeaderImportText] = useState('');
  const [headerBusy, setHeaderBusy] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // ─── Closer AI/Import ───────────────────────────────────────────────
  const [closerImportText, setCloserImportText] = useState('');
  const [closerBusy, setCloserBusy] = useState(false);
  const [closerError, setCloserError] = useState<string | null>(null);

  // ─── Contact create ─────────────────────────────────────────────────
  const [contactText, setContactText] = useState('');
  const [contactLabel, setContactLabel] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // ─── Assemble ───────────────────────────────────────────────────────
  const [assembling, setAssembling] = useState(false);
  const [assembleError, setAssembleError] = useState<string | null>(null);
  const [assembledText, setAssembledText] = useState<string | null>(null);
  const [assembledPitchId, setAssembledPitchId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Fetchers ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!campaignId) return;
    try {
      const [hdrs, cls, cts, pchs] = await Promise.all([
        marketingOpsService.listHeaders(campaignId),
        marketingOpsService.listClosers(campaignId),
        marketingOpsService.listContacts(campaignId),
        marketingOpsService.listPitches(campaignId),
      ]);
      setHeaders(hdrs);
      setClosers(cls);
      setContacts(cts);
      setPitches(pchs);
    } catch {
      // ignore — individual list calls will surface errors
    }
  }, [campaignId]);

  const fetchCloserResolution = useCallback(async () => {
    if (!campaignId) return;
    try {
      const res = await marketingOpsService.resolveCloser(campaignId);
      setCloserResolution(res);
      if (!closerImportText) {
        setCloserImportText(res.defaultTemplate);
      }
    } catch {
      // non-fatal — closer can still be manually typed
    }
  }, [campaignId, closerImportText]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Fetch the closer resolution (default template) on mount. Previously
  // this was deferred until the collapsible panel was opened; now that the
  // panel lives behind a tab and is always rendered when shown, we fetch
  // eagerly so the closer template is pre-filled as soon as the tab opens.
  useEffect(() => {
    if (!closerResolution) {
      fetchCloserResolution();
    }
  }, [closerResolution, fetchCloserResolution]);

  // Auto-select first opener when list changes
  useEffect(() => {
    if (openers.length > 0 && !selectedOpenerId) {
      setSelectedOpenerId(openers[0].id);
    }
  }, [openers, selectedOpenerId]);

  // ─── Header handlers ────────────────────────────────────────────────
  const handleExecuteHeader = async () => {
    setHeaderBusy(true);
    setHeaderError(null);
    try {
      await marketingOpsService.executeHeader(campaignId);
      const hdrs = await marketingOpsService.listHeaders(campaignId);
      setHeaders(hdrs);
      if (hdrs.length > 0) setSelectedHeaderId(hdrs[0].id);
    } catch (err: any) {
      setHeaderError(err.message || 'Failed to generate header');
    } finally {
      setHeaderBusy(false);
    }
  };

  const handleImportHeader = async () => {
    if (!headerImportText.trim()) return;
    setHeaderBusy(true);
    setHeaderError(null);
    try {
      await marketingOpsService.importHeader(campaignId, headerImportText.trim());
      const hdrs = await marketingOpsService.listHeaders(campaignId);
      setHeaders(hdrs);
      if (hdrs.length > 0) setSelectedHeaderId(hdrs[0].id);
      setHeaderImportText('');
    } catch (err: any) {
      setHeaderError(err.message || 'Failed to import header');
    } finally {
      setHeaderBusy(false);
    }
  };

  // ─── Closer handlers ────────────────────────────────────────────────
  const handleExecuteCloser = async () => {
    setCloserBusy(true);
    setCloserError(null);
    try {
      await marketingOpsService.executeCloser(campaignId);
      const cls = await marketingOpsService.listClosers(campaignId);
      setClosers(cls);
      if (cls.length > 0) setSelectedCloserId(cls[0].id);
    } catch (err: any) {
      setCloserError(err.message || 'Failed to generate closer');
    } finally {
      setCloserBusy(false);
    }
  };

  const handleImportCloser = async () => {
    if (!closerImportText.trim()) return;
    setCloserBusy(true);
    setCloserError(null);
    try {
      await marketingOpsService.importCloser(campaignId, closerImportText.trim());
      const cls = await marketingOpsService.listClosers(campaignId);
      setClosers(cls);
      if (cls.length > 0) setSelectedCloserId(cls[0].id);
      setCloserImportText('');
    } catch (err: any) {
      setCloserError(err.message || 'Failed to import closer');
    } finally {
      setCloserBusy(false);
    }
  };

  // ─── Contact handlers ───────────────────────────────────────────────
  const handleCreateContact = async () => {
    if (!contactText.trim()) return;
    setContactBusy(true);
    setContactError(null);
    try {
      await marketingOpsService.createContact(campaignId, contactText.trim(), contactLabel.trim() || undefined);
      const cts = await marketingOpsService.listContacts(campaignId);
      setContacts(cts);
      if (cts.length > 0) setSelectedContactId(cts[0].id);
      setContactText('');
      setContactLabel('');
    } catch (err: any) {
      setContactError(err.message || 'Failed to create contact');
    } finally {
      setContactBusy(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await marketingOpsService.deleteContact(id);
      const cts = await marketingOpsService.listContacts(campaignId);
      setContacts(cts);
      if (selectedContactId === id) setSelectedContactId('');
    } catch {
      // ignore
    }
  };

  // ─── Review pair handlers ───────────────────────────────────────────
  const updatePair = (idx: number, field: keyof ReviewPair, value: any) => {
    setReviewPairs((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const handleGenerateResponse = async (idx: number) => {
    const pair = reviewPairs[idx];
    if (!pair.review_text.trim()) {
      setPairError(`Slot ${idx + 1}: paste a customer review first`);
      return;
    }
    setPairLoading(idx);
    setPairError(null);
    try {
      const draft = await marketingOpsService.generateReviewResponse(campaignId, pair.review_text.trim());
      updatePair(idx, 'response_text', draft.response_text);
      updatePair(idx, 'response_source', 'ai');
      updatePair(idx, 'response_ai_provider', draft.response_ai_provider);
      updatePair(idx, 'response_ai_model', draft.response_ai_model);
      updatePair(idx, 'response_tokens_used', draft.response_tokens_used);
    } catch (err: any) {
      setPairError(err.message || `Slot ${idx + 1}: failed to generate response`);
    } finally {
      setPairLoading(null);
    }
  };

  const handleImportResponse = async (idx: number) => {
    const pair = reviewPairs[idx];
    if (!pair.review_text.trim()) {
      setPairError(`Slot ${idx + 1}: paste a customer review first`);
      return;
    }
    if (!pair.response_text.trim()) {
      setPairError(`Slot ${idx + 1}: paste the owner response text first`);
      return;
    }
    // No API call needed — just mark as external source
    updatePair(idx, 'response_source', 'external');
    updatePair(idx, 'response_ai_provider', null);
    updatePair(idx, 'response_ai_model', null);
    updatePair(idx, 'response_tokens_used', 0);
  };

  // ─── Assemble ───────────────────────────────────────────────────────
  const canAssemble = !!selectedOpenerId && reviewPairs.every((p) => p.review_text.trim() && p.response_text.trim());

  const handleAssemble = async () => {
    if (!canAssemble) return;
    setAssembling(true);
    setAssembleError(null);
    try {
      const result = await marketingOpsService.assemblePitch({
        campaignId,
        openerId: selectedOpenerId,
        headerId: selectedHeaderId || null,
        closerId: selectedCloserId || null,
        contactId: selectedContactId || null,
        reviewPairs,
      });
      setAssembledText(result.assembledText);
      setAssembledPitchId(result.pitch.id);
      const pchs = await marketingOpsService.listPitches(campaignId);
      setPitches(pchs);
    } catch (err: any) {
      setAssembleError(err.message || 'Failed to assemble pitch');
    } finally {
      setAssembling(false);
    }
  };

  const handleCopyAssembled = () => {
    if (!assembledText) return;
    navigator.clipboard.writeText(assembledText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAssembled = () => {
    if (!assembledText) return;
    const blob = new Blob([assembledText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pitch_${campaignId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedHeader = headers.find((h) => h.id === selectedHeaderId);
  const selectedCloser = closers.find((c) => c.id === selectedCloserId);
  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 space-y-6">
      {/* ─── Opener selector ─────────────────────────────────────── */}
      <section>
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
              Opener (handshake)
            </h3>
            <select
              value={selectedOpenerId}
              onChange={(e) => setSelectedOpenerId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select an opener variant —</option>
              {openers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.archetype} · {o.source}{o.close_variant ? ` · close: ${o.close_variant}` : ''} · {o.quality_gate_passed ? '✓' : '✗'} · {new Date(o.executed_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            {openers.length === 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                No openers yet. Generate or import one in the workspace above first.
              </p>
            )}
          </section>

          {/* ─── Header (Subject Line) ───────────────────────────────── */}
          <section className="border-t border-gray-100 dark:border-neutral-700 pt-4">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
              Header (Subject Line)
            </h3>
            <select
              value={selectedHeaderId}
              onChange={(e) => setSelectedHeaderId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None (optional) —</option>
              {headers.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.source} · {h.quality_gate_passed ? '✓' : '✗'} · {h.header_text?.slice(0, 40) ?? '(empty)'} · {new Date(h.executed_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            {selectedHeader && (
              <div className="mt-2 p-3 bg-gray-50 dark:bg-neutral-900/50 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">{selectedHeader.header_text}</p>
                {selectedHeader.quality_gate_issues && selectedHeader.quality_gate_issues.length > 0 && (
                  <ul className="mt-1 text-xs text-amber-600 dark:text-amber-400 list-disc list-inside">
                    {selectedHeader.quality_gate_issues.map((iss, i) => <li key={i}>{iss}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExecuteHeader}
                disabled={headerBusy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {headerBusy ? 'Generating...' : 'AI Generate'}
              </button>
              <input
                type="text"
                value={headerImportText}
                onChange={(e) => setHeaderImportText(e.target.value)}
                placeholder="Paste subject line..."
                className="flex-1 min-w-[200px] px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                onClick={handleImportHeader}
                disabled={headerBusy || !headerImportText.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
            </div>
            {headerError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{headerError}</p>}
          </section>

          {/* ─── 3-Slot Preview ──────────────────────────────────────── */}
          <section className="border-t border-gray-100 dark:border-neutral-700 pt-4">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
              Preview (3 completed reviews + responses)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Slot 1 is the handled 1-star negative (rendered first). Paste the real customer review from a public platform, then AI-draft or import the owner response.
            </p>
            {pairError && (
              <div className="mb-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2">
                <p className="text-xs text-red-700 dark:text-red-400">{pairError}</p>
              </div>
            )}
            <div className="space-y-3">
              {reviewPairs.map((pair, idx) => (
                <div key={idx} className="border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                      Slot {idx + 1}
                      {pair.is_negative_first && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          NEGATIVE FIRST
                        </span>
                      )}
                    </span>
                    {idx === 0 && (
                      <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <input
                          type="checkbox"
                          checked={pair.is_negative_first}
                          onChange={(e) => updatePair(idx, 'is_negative_first', e.target.checked)}
                          className="w-3 h-3"
                        />
                        1-star negative
                      </label>
                    )}
                  </div>
                  <textarea
                    value={pair.review_text}
                    onChange={(e) => updatePair(idx, 'review_text', e.target.value)}
                    placeholder={`Customer review ${idx + 1} (paste from Google/Yelp/Facebook)...`}
                    rows={3}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
                  />
                  <textarea
                    value={pair.response_text}
                    onChange={(e) => updatePair(idx, 'response_text', e.target.value)}
                    placeholder="Owner response (AI-drafted or imported)..."
                    rows={3}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGenerateResponse(idx)}
                      disabled={pairLoading === idx || !pair.review_text.trim()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {pairLoading === idx ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      AI Draft
                    </button>
                    <button
                      onClick={() => handleImportResponse(idx)}
                      disabled={!pair.response_text.trim()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50"
                    >
                      <Upload className="w-3 h-3" />
                      Mark Imported
                    </button>
                    {pair.response_source === 'ai' && pair.response_ai_model && (
                      <span className="text-xs text-gray-400">{pair.response_ai_model}</span>
                    )}
                    {pair.response_source === 'external' && (
                      <span className="text-xs text-gray-400">imported</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Closer ──────────────────────────────────────────────── */}
          <section className="border-t border-gray-100 dark:border-neutral-700 pt-4">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
              Closer (creates the itch)
            </h3>
            {closerResolution && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Remaining: <strong>{closerResolution.remaining}</strong> responses beyond the 3 shown.
              </p>
            )}
            <select
              value={selectedCloserId}
              onChange={(e) => setSelectedCloserId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None (optional) —</option>
              {closers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.source} · {c.quality_gate_passed ? '✓' : '✗'} · {c.closer_text?.slice(0, 40) ?? '(empty)'} · {new Date(c.executed_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            {selectedCloser && (
              <div className="mt-2 p-3 bg-gray-50 dark:bg-neutral-900/50 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">{selectedCloser.closer_text}</p>
                {selectedCloser.quality_gate_issues && selectedCloser.quality_gate_issues.length > 0 && (
                  <ul className="mt-1 text-xs text-amber-600 dark:text-amber-400 list-disc list-inside">
                    {selectedCloser.quality_gate_issues.map((iss, i) => <li key={i}>{iss}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExecuteCloser}
                disabled={closerBusy}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {closerBusy ? 'Generating...' : 'AI Generate'}
              </button>
              <input
                type="text"
                value={closerImportText}
                onChange={(e) => setCloserImportText(e.target.value)}
                placeholder="Edit closer template..."
                className="flex-1 min-w-[200px] px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                onClick={handleImportCloser}
                disabled={closerBusy || !closerImportText.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
            </div>
            {closerError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{closerError}</p>}
          </section>

          {/* ─── Contact (optional) ──────────────────────────────────── */}
          <section className="border-t border-gray-100 dark:border-neutral-700 pt-4">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
              My Contact (optional footer)
            </h3>
            <select
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None (pitch stands alone) —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label ?? c.contact_text?.slice(0, 30) ?? '(empty)'} · {new Date(c.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            {selectedContact && (
              <div className="mt-2 p-3 bg-gray-50 dark:bg-neutral-900/50 rounded-lg flex items-start justify-between">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-mono flex-1">{selectedContact.contact_text}</p>
                <button
                  onClick={() => handleDeleteContact(selectedContact.id)}
                  className="ml-2 text-gray-400 hover:text-red-600"
                  title="Delete contact"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={contactLabel}
                onChange={(e) => setContactLabel(e.target.value)}
                placeholder="Label (optional)"
                className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                value={contactText}
                onChange={(e) => setContactText(e.target.value)}
                placeholder="Contact footer text..."
                className="flex-1 min-w-[200px] px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateContact}
                disabled={contactBusy || !contactText.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                {contactBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
            {contactError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{contactError}</p>}
          </section>

          {/* ─── Assemble ────────────────────────────────────────────── */}
          <section className="border-t border-gray-100 dark:border-neutral-700 pt-4">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
              Assemble Pitch
            </h3>
            <button
              onClick={handleAssemble}
              disabled={assembling || !canAssemble}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {assembling ? 'Assembling...' : 'Assemble & Save Pitch'}
            </button>
            {!canAssemble && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Select an opener and fill all 3 review/response pairs to assemble.
              </p>
            )}
            {assembleError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{assembleError}</p>
            )}

            {assembledText && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Assembled pitch {assembledPitchId && <code className="font-mono">{assembledPitchId}</code>}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadAssembled}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                    <button
                      onClick={handleCopyAssembled}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <pre className="text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-96 overflow-y-auto">
                  {assembledText}
                </pre>
              </div>
            )}
          </section>

          {/* ─── Pitch History ───────────────────────────────────────── */}
          {pitches.length > 0 && (
            <section className="border-t border-gray-100 dark:border-neutral-700 pt-4">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                Pitch History ({pitches.length})
              </h3>
              <div className="space-y-2">
                {pitches.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-neutral-900/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <code className="font-mono">{p.id}</code>
                      <span>·</span>
                      <span>{new Date(p.created_at).toLocaleString()}</span>
                      {p.header_id && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">H</span>}
                      {p.closer_id && <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">C</span>}
                      {p.contact_id && <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">Contact</span>}
                    </div>
                    <button
                      onClick={() => {
                        setAssembledText(p.assembled_text);
                        setAssembledPitchId(p.id);
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
    </div>
  );
}
