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
  OpenerArchetype,
  RankedHook,
  HookSuggestionResult,
} from '@/services/MarketingOpsService';

interface PitchConstructionPanelProps {
  campaignId: string;
  openers: OutreachOpener[];
  // Detected archetype for the selected campaign (from the opener
  // resolution). Drives which starter copy set is offered in each
  // section so the operator sees header/closer/contact starters that
  // match the campaign's actual pain (reviews, listings, CTA, product
  // visibility) instead of always review-response copy. Falls back to
  // A1 (review-response) when unknown.
  archetype?: OpenerArchetype;
}

// ─── Common convertable starters (archetype-aware) ───────────────────
// Unpersonalized starter copy that tends to convert well, keyed by the
// campaign's detected archetype so the operator sees starters aligned
// with the actual pain (reviews vs listings vs CTA vs product
// visibility). Click to load into the import field, then edit the
// {{placeholders}} before importing. AI Generate remains the recommended
// path — it personalizes these for the prospect using the audit data;
// the starters are for fast manual assembly when the operator already
// knows what they want.

const HEADER_STARTERS: Record<OpenerArchetype, string[]> = {
  // A1 — Review Response Gap
  A1: [
    'Preview - {{shown}} of your {{total}} completed review responses',
    '{{business}} — your unanswered Google reviews',
    '{{business}} — three reviews need responses',
    'Quick note about {{business}}\'s reviews',
    '{{business}} — your Yelp listing has gaps',
  ],
  // A2 — Negative Review Recovery (theme-led)
  A2: [
    'Preview - responses to the {{theme}} reviews on {{business}}',
    '{{business}} — your {{theme}} reviews are going unanswered',
    '{{business}} — three negative reviews, one pattern',
    'Quick note about the {{theme}} complaints on {{business}}',
    '{{business}} — I drafted replies to your negative reviews',
  ],
  // A3 — Listing Inconsistency (NAP drift)
  A3: [
    'Preview - your listings across Google, Yelp, and Facebook',
    '{{business}} — your address is different on Yelp',
    '{{business}} — customers are being sent to the wrong location',
    'Quick note about {{business}}\'s listings',
    '{{business}} — your phone number doesn\'t match across directories',
    '{{business}} — your profiles are unclaimed on {{remaining}} directories',
    '{{business}} — listings you don\'t control are live right now',
    'Preview - your unclaimed listings across {{remaining}} platforms',
  ],
  // A4 — Conversion / CTA Gap (website)
  A4: [
    'Preview - your website, with one fix suggested',
    '{{business}} — your website has no booking button',
    '{{business}} — visitors can\'t book online',
    'Quick note about {{business}}\'s website',
    '{{business}} — every visitor has to call to become a customer',
  ],
  // A5 — Multi-Signal Footprint (combined)
  A5: [
    'Preview - your listings and your reviews',
    '{{business}} — wrong directions and unanswered reviews',
    '{{business}} — two gaps I found in your footprint',
    'Quick note about {{business}}\'s online presence',
    '{{business}} — listings + reviews, both need work',
    '{{business}} — unclaimed listings and unanswered reviews',
    'Preview - your unclaimed profiles and review gaps',
  ],
  // A6 — Product Visibility Gap (discoverability)
  A6: [
    'Preview - what your store looks like online',
    '{{business}} — customers can\'t see what you carry',
    '{{business}} — your Google photos don\'t show the store',
    'Quick note about {{business}}\'s online presence',
    '{{business}} — no way to browse your products before visiting',
  ],
};

const CLOSER_STARTERS: Record<OpenerArchetype, string[]> = {
  A1: [
    'The remaining {{remaining}} responses are written and ready to deliver today.',
    'I\'ve drafted replies to the other {{remaining}} unanswered reviews — ready when you are.',
    '{{remaining}} more responses are written and waiting. Want them?',
    'There are {{remaining}} more responses ready to send. Say the word.',
    'I\'ve handled {{remaining}} more reviews beyond these three. Should I send them?',
  ],
  A2: [
    'The remaining {{remaining}} negative-review responses are written and ready today.',
    'I\'ve drafted replies to the other {{remaining}} negative reviews — ready when you are.',
    '{{remaining}} more responses to the {{theme}} reviews are ready. Want them?',
    'There are {{remaining}} more negative reviews I\'ve handled. Say the word.',
    'I\'ve addressed {{remaining}} more reviews on the same pattern. Should I send them?',
  ],
  A3: [
    'The full listing reconciliation — across {{remaining}} directories — is ready today.',
    'I\'ve mapped every variation across the other {{remaining}} directories. Ready when you are.',
    '{{remaining}} more directories are reconciled and waiting. Want the list?',
    'There are {{remaining}} more platforms with the wrong info. Say the word.',
    'I\'ve corrected the other {{remaining}} listings. Should I send the diff?',
    'The other {{remaining}} profiles are unclaimed — anyone can edit them right now. Let\'s get them claimed and repaired.',
    'These {{remaining}} listings are sitting unmanaged. I can get them claimed and corrected today.',
  ],
  A4: [
    'The full CTA fix — booking button, click-to-call, and the {{remaining}} follow-on tweaks — is ready today.',
    'I\'ve drafted the other {{remaining}} conversion fixes. Ready when you are.',
    '{{remaining}} more tweaks are staged and waiting. Want them?',
    'There are {{remaining}} more friction points I\'ve mapped. Say the word.',
    'I\'ve handled {{remaining}} more conversion gaps beyond this one. Should I send them?',
  ],
  A5: [
    'The full fix — listings and the {{remaining}} review responses — is ready today.',
    'I\'ve drafted the other {{remaining}} pieces. Ready when you are.',
    '{{remaining}} more sections are written and waiting. Want them?',
    'There are {{remaining}} more gaps mapped out. Say the word.',
    'I\'ve handled {{remaining}} more items across both fronts. Should I send them?',
    'The other {{remaining}} profiles are unclaimed and unmanaged — let\'s get them claimed and repaired today.',
  ],
  A6: [
    'The full product visibility plan — photos, catalog, and the {{remaining}} sections — is ready today.',
    'I\'ve drafted the other {{remaining}} pieces of the visibility plan. Ready when you are.',
    '{{remaining}} more sections are ready — fulfillment, hours sync, the rest. Want them?',
    'There are {{remaining}} more pieces staged. Say the word.',
    'I\'ve handled {{remaining}} more sections beyond these. Should I send them?',
  ],
};

const CONTACT_STARTERS: Record<OpenerArchetype, string[]> = {
  A1: [
    '— {{name}} | {{email}} | {{phone}}',
    '— {{name}}, VisibleShelf — {{email}}',
    'Reply with "go" and I\'ll send the rest. — {{name}}',
    '— {{name}} | {{phone}}',
    'Text "more" to {{phone}} and I\'ll send the rest. — {{name}}',
  ],
  A2: [
    '— {{name}} | {{email}} | {{phone}}',
    '— {{name}}, VisibleShelf — {{email}}',
    'Reply with "go" and I\'ll send the rest. — {{name}}',
    '— {{name}} | {{phone}}',
    'Text "more" to {{phone}} and I\'ll send the rest. — {{name}}',
  ],
  A3: [
    '— {{name}} | {{email}} | {{phone}}',
    '— {{name}}, VisibleShelf — {{email}}',
    'Reply with "go" and I\'ll send the full reconciliation. — {{name}}',
    '— {{name}} | {{phone}}',
    'Text "list" to {{phone}} and I\'ll send the directory diff. — {{name}}',
  ],
  A4: [
    '— {{name}} | {{email}} | {{phone}}',
    '— {{name}}, VisibleShelf — {{email}}',
    'Reply with "go" and I\'ll send the full CTA fix. — {{name}}',
    '— {{name}} | {{phone}}',
    'Text "fix" to {{phone}} and I\'ll send the conversion tweaks. — {{name}}',
  ],
  A5: [
    '— {{name}} | {{email}} | {{phone}}',
    '— {{name}}, VisibleShelf — {{email}}',
    'Reply with "go" and I\'ll send the rest. — {{name}}',
    '— {{name}} | {{phone}}',
    'Text "more" to {{phone}} and I\'ll send the full plan. — {{name}}',
  ],
  A6: [
    '— {{name}} | {{email}} | {{phone}}',
    '— {{name}}, VisibleShelf — {{email}}',
    'Reply with "go" and I\'ll send the visibility plan. — {{name}}',
    '— {{name}} | {{phone}}',
    'Text "catalog" to {{phone}} and I\'ll send the product mockup. — {{name}}',
  ],
};

const ARCHETYPE_LABELS: Record<OpenerArchetype, string> = {
  A1: 'Review Response Gap',
  A2: 'Negative Review Recovery',
  A3: 'Listing Inconsistency',
  A4: 'Conversion / CTA Gap',
  A5: 'Multi-Signal Footprint',
  A6: 'Product Visibility Gap',
};

interface StarterExamplesProps {
  examples: string[];
  onPick: (text: string) => void;
  archetype?: OpenerArchetype;
}

function StarterExamples({ examples, onPick, archetype }: StarterExamplesProps) {
  return (
    <details className="mt-3 group rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/60 dark:bg-neutral-900/30">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 select-none flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          Common convertable starters (click to load)
          {archetype && (
            <span
              title={`Aligned to the detected campaign archetype (${archetype} — ${ARCHETYPE_LABELS[archetype]})`}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {archetype}
            </span>
          )}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400 group-open:hidden">
          AI Generate recommended for personalization
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-1.5">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Unpersonalized starters — edit the <code className="font-mono">{'{{placeholders}}'}</code> after loading. AI Generate personalizes for the prospect automatically.
        </p>
        {examples.map((ex, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(ex)}
            className="block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 rounded-md border border-gray-200 dark:border-neutral-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-mono"
          >
            {ex}
          </button>
        ))}
      </div>
    </details>
  );
}

// ─── Archetype-aware preview-slot config ──────────────────────────────
// The 3-slot preview generalizes beyond review responses. Each archetype
// has its own "evidence → fix" pair shape, slot labels, placeholders, and
// the "first slot" framing (which slot is rendered first and why). The
// wire format (ReviewPair) is unchanged — review_text holds the evidence,
// response_text holds the fix — but the labels the operator sees and the
// labels stamped into the assembled pitch are archetype-appropriate.
//
// `useReviewEndpoint` controls which AI Draft endpoint the slot calls:
//   true  → POST /openers/review-responses/generate (legacy review response)
//   false → POST /openers/preview-slots/generate (archetype-aware slot fix)

interface PreviewSlotConfig {
  sectionTitle: string;           // "The Preview (3 completed reviews + responses):"
  sectionBlurb: string;           // explanatory text under the section header
  firstSlotLabel: string;         // "THE NEGATIVE - The handled 1-star goes first"
  firstSlotBadge: string;         // "NEGATIVE FIRST" / "MOST VISIBLE FIRST"
  firstSlotCheckboxLabel: string; // "1-star negative" / "most visible platform"
  slotLabelPrefix: string;        // "Review #" / "Platform #" / "Fix #"
  evidenceLabel: string;          // "Customer Review" / "Current Listing"
  fixLabel: string;               // "Owner Response Message" / "Corrected Listing"
  evidencePlaceholder: string;    // textarea placeholder for the evidence field
  fixPlaceholder: string;         // textarea placeholder for the fix field
  slotLabels: string[];           // per-slot label (e.g. ["Google", "Yelp", "Facebook"])
  useReviewEndpoint: boolean;     // true → review-response endpoint, false → preview-slot endpoint
}

const PREVIEW_SLOT_CONFIGS: Record<OpenerArchetype, PreviewSlotConfig> = {
  A1: {
    sectionTitle: 'The Preview (3 completed reviews + responses):',
    sectionBlurb:
      'Slot 1 is the handled 1-star negative (rendered first). Paste the real customer review from any platform (same or mixed), then AI-draft or import the owner response. Label each slot if useful — or leave blank.',
    firstSlotLabel: 'THE NEGATIVE - The handled 1-star goes first',
    firstSlotBadge: 'NEGATIVE FIRST',
    firstSlotCheckboxLabel: '1-star negative',
    slotLabelPrefix: 'Review #',
    evidenceLabel: 'Customer Review',
    fixLabel: 'Owner Response Message',
    evidencePlaceholder: 'Customer review (paste from Google/Yelp/Facebook)...',
    fixPlaceholder: 'Owner response (AI-drafted or imported)...',
    // No default per-slot labels — the 3 reviews can be from any platform,
    // same or mixed. The operator can label each slot via the editable
    // slot-label input if they want to track provenance.
    slotLabels: ['', '', ''],
    useReviewEndpoint: true,
  },
  A2: {
    sectionTitle: 'The Preview (3 negative-review recoveries + responses):',
    sectionBlurb:
      'Slot 1 is the strongest negative on the recurring theme (rendered first). Paste the real customer review from any platform (same or mixed), then AI-draft or import the owner response. Label each slot if useful — or leave blank.',
    firstSlotLabel: 'THE THEME NEGATIVE - The strongest themed 1-star goes first',
    firstSlotBadge: 'THEME NEGATIVE FIRST',
    firstSlotCheckboxLabel: 'strongest themed negative',
    slotLabelPrefix: 'Review #',
    evidenceLabel: 'Customer Review',
    fixLabel: 'Owner Response Message',
    evidencePlaceholder: 'Negative review on the recurring theme (paste from Google/Yelp)...',
    fixPlaceholder: 'Owner response (AI-drafted or imported)...',
    slotLabels: ['', '', ''],
    useReviewEndpoint: true,
  },
  A3: {
    sectionTitle: 'The Preview (3 listing corrections):',
    sectionBlurb:
      'Slot 1 is the most visible platform (rendered first). Paste the current (wrong) listing state from the platform, then AI-draft or import the corrected entry.',
    firstSlotLabel: 'THE MOST VISIBLE - The highest-traffic platform goes first',
    firstSlotBadge: 'MOST VISIBLE FIRST',
    firstSlotCheckboxLabel: 'highest-traffic platform',
    slotLabelPrefix: 'Platform #',
    evidenceLabel: 'Current Listing',
    fixLabel: 'Corrected Listing',
    evidencePlaceholder: 'Current listing on this platform (paste name/address/phone as shown)...',
    fixPlaceholder: 'Corrected listing entry (AI-drafted or imported)...',
    slotLabels: ['Google', 'Yelp', 'Facebook'],
    useReviewEndpoint: false,
  },
  A4: {
    sectionTitle: 'The Preview (3 conversion fixes):',
    sectionBlurb:
      'Slot 1 is the highest-impact friction point (rendered first). Paste the current website state, then AI-draft or import the proposed fix.',
    firstSlotLabel: 'THE HIGHEST IMPACT - The biggest conversion gap goes first',
    firstSlotBadge: 'HIGHEST IMPACT FIRST',
    firstSlotCheckboxLabel: 'highest-impact gap',
    slotLabelPrefix: 'Fix #',
    evidenceLabel: 'Current State',
    fixLabel: 'Proposed Fix',
    evidencePlaceholder: 'Current website state (paste what the visitor sees today)...',
    fixPlaceholder: 'Proposed fix (AI-drafted or imported)...',
    slotLabels: ['Booking button', 'Click-to-call', 'Scheduling link'],
    useReviewEndpoint: false,
  },
  A5: {
    sectionTitle: 'The Preview (3 footprint corrections):',
    sectionBlurb:
      'Slot 1 is the most visible gap (rendered first). Paste the current state — listing or review — then AI-draft or import the fix.',
    firstSlotLabel: 'THE MOST VISIBLE - The highest-traffic gap goes first',
    firstSlotBadge: 'MOST VISIBLE FIRST',
    firstSlotCheckboxLabel: 'highest-traffic gap',
    slotLabelPrefix: 'Gap #',
    evidenceLabel: 'Current State',
    fixLabel: 'Proposed Fix',
    evidencePlaceholder: 'Current state (paste the listing inconsistency or unanswered review)...',
    fixPlaceholder: 'Proposed fix (AI-drafted or imported)...',
    slotLabels: ['Google listing', 'Yelp listing', 'Google reviews'],
    useReviewEndpoint: true,
  },
  A6: {
    sectionTitle: 'The Preview (3 product-visibility fixes):',
    sectionBlurb:
      'Slot 1 is the highest-impact visibility gap (rendered first). Paste the current online presence, then AI-draft or import the proposed fix.',
    firstSlotLabel: 'THE HIGHEST IMPACT - The biggest discoverability gap goes first',
    firstSlotBadge: 'HIGHEST IMPACT FIRST',
    firstSlotCheckboxLabel: 'highest-impact gap',
    slotLabelPrefix: 'Fix #',
    evidenceLabel: 'Current State',
    fixLabel: 'Proposed Fix',
    evidencePlaceholder: 'Current online presence (paste what customers can/can\'t see today)...',
    fixPlaceholder: 'Proposed visibility fix (AI-drafted or imported)...',
    slotLabels: ['Storefront photos', 'Product browsing', 'Availability inquiry'],
    useReviewEndpoint: false,
  },
};

export default function PitchConstructionPanel({ campaignId, openers, archetype }: PitchConstructionPanelProps) {
  // Resolve the starter set + preview-slot config for the detected archetype.
  // Falls back to A1 (review-response) when the archetype is unknown —
  // matches the opener resolver's fallback behavior.
  const effectiveArchetype: OpenerArchetype = archetype ?? 'A1';
  const headerStarters = HEADER_STARTERS[effectiveArchetype] ?? HEADER_STARTERS.A1;
  const closerStarters = CLOSER_STARTERS[effectiveArchetype] ?? CLOSER_STARTERS.A1;
  const contactStarters = CONTACT_STARTERS[effectiveArchetype] ?? CONTACT_STARTERS.A1;
  const slotConfig = PREVIEW_SLOT_CONFIGS[effectiveArchetype] ?? PREVIEW_SLOT_CONFIGS.A1;

  // Stamp the renderer labels onto a review pair. The labels are read from
  // the first pair by the backend renderer, so we only need them on pair[0],
  // but stamping on every pair is harmless and survives reordering.
  //
  // `slot_label` is operator-editable via the per-slot input, so we only
  // fill it from the config default when the pair doesn't already have one.
  // This lets the operator override the suggested label (e.g. "Google review
  // 1" instead of "Google") or clear it entirely for archetypes where a
  // per-slot label isn't meaningful (A1/A2 — the 3 reviews can be from any
  // platform, same or mixed).
  const stampRendererLabels = useCallback(
    (pairs: ReviewPair[]): ReviewPair[] =>
      pairs.map((p, idx) => ({
        ...p,
        evidence_label: slotConfig.evidenceLabel,
        fix_label: slotConfig.fixLabel,
        slot_label: p.slot_label ?? slotConfig.slotLabels[idx] ?? undefined,
        slot_label_prefix: slotConfig.slotLabelPrefix,
        section_title: slotConfig.sectionTitle,
        first_slot_label: slotConfig.firstSlotLabel,
      })),
    [slotConfig],
  );
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
  // Initialized with the A1 (review-response) slot config; re-stamped
  // whenever the archetype changes via the effect below so the renderer
  // labels always match the detected archetype.
  const [reviewPairs, setReviewPairs] = useState<ReviewPair[]>(
    stampRendererLabels([
      { review_text: '', response_text: '', response_source: 'ai', is_negative_first: true },
      { review_text: '', response_text: '', response_source: 'ai', is_negative_first: false },
      { review_text: '', response_text: '', response_source: 'ai', is_negative_first: false },
    ]),
  );
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

  // ─── Hook suggestions (Sprint 2 — Light-Score Hook Library) ──────────
  const [hookSuggestions, setHookSuggestions] = useState<RankedHook[]>([]);
  const [hookLoading, setHookLoading] = useState(false);
  const [hookError, setHookError] = useState<string | null>(null);
  const [hookArchetype, setHookArchetype] = useState<string | null>(null);

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

  // Fetch hook suggestions on mount — ranked hooks with merge fields resolved.
  // The operator picks one and loads it into the import field (attribution
  // flows through importOpener with hookAngle).
  const fetchHookSuggestions = useCallback(async () => {
    if (!campaignId) return;
    setHookLoading(true);
    setHookError(null);
    try {
      const result = await marketingOpsService.getHookSuggestions(campaignId);
      setHookSuggestions(result.suggestions);
      setHookArchetype(result.archetype);
    } catch (err: any) {
      setHookError(err.message || 'Failed to load hook suggestions');
      setHookSuggestions([]);
    } finally {
      setHookLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchHookSuggestions();
  }, [fetchHookSuggestions]);

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

  // Re-stamp renderer labels on the review pairs whenever the archetype
  // changes (campaign switch). Preserves the evidence/fix text the operator
  // already typed; only the labels (evidence_label, fix_label, slot_label,
  // section_title, etc.) are refreshed so the assembled pitch renders with
  // archetype-appropriate framing.
  useEffect(() => {
    setReviewPairs((prev) => stampRendererLabels(prev));
  }, [stampRendererLabels]);

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

  // AI Draft for one preview slot. Dispatches to the review-response
  // endpoint for review archetypes (A1/A2/A5) and to the archetype-aware
  // preview-slot endpoint for non-review archetypes (A3/A4/A6). The wire
  // format (ReviewResponseDraft) is the same either way.
  const handleGenerateResponse = async (idx: number) => {
    const pair = reviewPairs[idx];
    if (!pair.review_text.trim()) {
      setPairError(`Slot ${idx + 1}: paste the ${slotConfig.evidenceLabel.toLowerCase()} first`);
      return;
    }
    setPairLoading(idx);
    setPairError(null);
    try {
      const draft = slotConfig.useReviewEndpoint
        ? await marketingOpsService.generateReviewResponse(campaignId, pair.review_text.trim())
        : await marketingOpsService.generatePreviewSlot(
            campaignId,
            pair.review_text.trim(),
            effectiveArchetype,
            slotConfig.slotLabels[idx],
          );
      updatePair(idx, 'response_text', draft.response_text);
      updatePair(idx, 'response_source', 'ai');
      updatePair(idx, 'response_ai_provider', draft.response_ai_provider);
      updatePair(idx, 'response_ai_model', draft.response_ai_model);
      updatePair(idx, 'response_tokens_used', draft.response_tokens_used);
    } catch (err: any) {
      setPairError(err.message || `Slot ${idx + 1}: failed to generate ${slotConfig.fixLabel.toLowerCase()}`);
    } finally {
      setPairLoading(null);
    }
  };

  const handleImportResponse = async (idx: number) => {
    const pair = reviewPairs[idx];
    if (!pair.review_text.trim()) {
      setPairError(`Slot ${idx + 1}: paste the ${slotConfig.evidenceLabel.toLowerCase()} first`);
      return;
    }
    if (!pair.response_text.trim()) {
      setPairError(`Slot ${idx + 1}: paste the ${slotConfig.fixLabel.toLowerCase()} text first`);
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
        // Stamp the archetype-aware renderer labels right before assemble
        // so the persisted pitch always carries the right framing even if
        // the operator switched archetypes mid-assembly.
        reviewPairs: stampRendererLabels(reviewPairs),
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
      {/* ─── Suggested Hooks (Sprint 2 — Light-Score Hook Library) ──── */}
      <section className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-900/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
            Suggested Hooks
            {hookArchetype && (
              <span
                title={`Ranked by affinity to the campaign's detected archetype (${hookArchetype})`}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {hookArchetype}
              </span>
            )}
          </h3>
          <button
            onClick={fetchHookSuggestions}
            disabled={hookLoading}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${hookLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {hookError && (
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {hookError}
          </div>
        )}

        {hookLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-md bg-gray-100 dark:bg-neutral-800 animate-pulse" />
            ))}
          </div>
        ) : hookSuggestions.length > 0 ? (
          <details open className="group">
            <summary className="cursor-pointer list-none text-[11px] text-gray-500 dark:text-gray-400 mb-2 select-none">
              Ranked by archetype affinity + signal match — click a hook to load it into the import field below.
            </summary>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {hookSuggestions.map((hook) => (
                <div
                  key={hook.angle}
                  className="rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-gray-400">#{hook.rank}</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{hook.label}</span>
                      {hook.matchedSignals.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {hook.matchedSignals.map((sig) => (
                            <span
                              key={sig}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            >
                              {sig}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderImportText(hook.resolved.subject);
                        // Load the body into the opener import field via a
                        // custom event — the opener tab listens for it.
                        window.dispatchEvent(
                          new CustomEvent('hook-selected', {
                            detail: { body: hook.resolved.body, angle: hook.angle },
                          }),
                        );
                      }}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      <Upload className="w-3 h-3" />
                      Use this hook
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-1">
                    <span className="text-gray-400">Subject:</span> {hook.resolved.subject}
                  </p>
                  <pre className="text-xs text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {hook.resolved.body}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        ) : !hookError ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">No hook suggestions available.</p>
        ) : null}
      </section>

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
            <StarterExamples
              examples={headerStarters}
              onPick={(text) => setHeaderImportText(text)}
              archetype={archetype}
            />
          </section>

          {/* ─── 3-Slot Preview (archetype-aware) ─────────────────────── */}
          <section className="border-t border-gray-100 dark:border-neutral-700 pt-4">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
              {slotConfig.sectionTitle.replace(/:$/, '')}
              <span
                title={`Aligned to the detected campaign archetype (${effectiveArchetype} — ${ARCHETYPE_LABELS[effectiveArchetype]})`}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {effectiveArchetype}
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {slotConfig.sectionBlurb}
            </p>
            {pairError && (
              <div className="mb-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2">
                <p className="text-xs text-red-700 dark:text-red-400">{pairError}</p>
              </div>
            )}
            <div className="space-y-3">
              {reviewPairs.map((pair, idx) => (
                <div key={idx} className="border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
                      {slotConfig.slotLabelPrefix} {idx + 1}
                      {pair.is_negative_first && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {slotConfig.firstSlotBadge}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Editable per-slot label. Defaults from the archetype
                          config (e.g. "Google" for A3) but the operator can
                          override or clear it. For A1/A2 the default is empty
                          — the 3 reviews can be from any platform, same or
                          mixed. Flows through to slot_label on the pair and
                          into the assembled pitch rendering. */}
                      <input
                        type="text"
                        value={pair.slot_label ?? ''}
                        onChange={(e) => updatePair(idx, 'slot_label', e.target.value || undefined)}
                        placeholder={slotConfig.slotLabels[idx] ? `e.g. ${slotConfig.slotLabels[idx]}` : 'label (optional)'}
                        className="w-32 px-2 py-1 text-xs border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {idx === 0 && (
                        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <input
                            type="checkbox"
                            checked={pair.is_negative_first}
                            onChange={(e) => updatePair(idx, 'is_negative_first', e.target.checked)}
                            className="w-3 h-3"
                          />
                          {slotConfig.firstSlotCheckboxLabel}
                        </label>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={pair.review_text}
                    onChange={(e) => updatePair(idx, 'review_text', e.target.value)}
                    placeholder={slotConfig.evidencePlaceholder}
                    rows={3}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
                  />
                  <textarea
                    value={pair.response_text}
                    onChange={(e) => updatePair(idx, 'response_text', e.target.value)}
                    placeholder={slotConfig.fixPlaceholder}
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
            <StarterExamples
              examples={closerStarters}
              onPick={(text) => setCloserImportText(text)}
              archetype={archetype}
            />
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
            <StarterExamples
              examples={contactStarters}
              onPick={(text) => setContactText(text)}
              archetype={archetype}
            />
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
                Select an opener and fill all 3 {slotConfig.evidenceLabel.toLowerCase()}/{slotConfig.fixLabel.toLowerCase()} pairs to assemble.
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
