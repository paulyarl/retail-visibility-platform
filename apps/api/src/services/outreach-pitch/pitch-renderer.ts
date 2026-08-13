/**
 * Outreach Pitch — Renderer + Shared Types
 *
 * Pure function that renders the full pitch in the operator's fixed format:
 *
 *   The Pitch
 *
 *   The Opener (handshake):
 *   <opener text>
 *
 *   The Header (subject):
 *   <header text>
 *
 *   The Preview (3 completed reviews + responses):
 *
 *   THE NEGATIVE - The handled 1-star goes first
 *
 *   Review # 1
 *   Customer Review: "...."
 *   Owner Response Message: "...."
 *   ----------------------
 *   Review # 2
 *   ...
 *   ----------------------
 *   Review # 3
 *   ...
 *   ----------------------
 *   CLOSER - The closer creates the itch
 *
 *   <closer text>
 *
 *   My Contact:  <optional contact text>
 *
 * The negative-first slot is rendered first regardless of its position in
 * the input array (the renderer enforces the "handled 1-star goes first"
 * rule from the format spec).
 *
 * See: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §1, §5.5
 */

// ─── Types ───────────────────────────────────────────────────────────────

// ── Structured footprint fields (A5 Multi-Signal Footprint, A3 Listing) ──
// When present, the slot carries a structured "current state → proposed fix"
// pair keyed by platform + profile URL + a single focus attribute (one of
// NAP+W or Claim Status). The renderer formats these into a readable
// before/after block instead of the free-text evidence/fix lines. Stored
// in the review_pairs JSON column on mkt_outreach_pitches_list — queryable
// via GET /openers/pitches/:id/footprint-diff for completed-work reporting.
// Optional on every archetype; only A5/A3 surface them in the UI today.
export type FootprintFocusAttribute =
  | 'name'
  | 'address'
  | 'phone'
  | 'website'
  | 'claim_status';

export interface FootprintFields {
  platform_name?: string;        // e.g. "Google", "Yelp", "Facebook"
  profile_url?: string;          // canonical profile URL on the platform
  focus_attribute?: FootprintFocusAttribute; // which attribute is inconsistent
  current_value?: string;        // the inconsistent info as it appears today
  correct_value?: string;        // the corrected info to apply
  summary?: string;              // optional one-line summary in the fix box
}

export interface ReviewPair extends FootprintFields {
  review_text: string;
  response_text: string;
  response_source: 'ai' | 'external';
  response_ai_provider?: string | null;
  response_ai_model?: string | null;
  response_tokens_used?: number;
  is_negative_first: boolean;
  // ── Archetype-aware preview-slot labels (all optional, additive) ──
  // When present, the renderer uses these instead of the review-centric
  // defaults so the assembled pitch reads appropriately for the campaign's
  // archetype (e.g. "Current Listing" / "Corrected Listing" for A3 instead
  // of "Customer Review" / "Owner Response Message"). Omitted on legacy
  // pitches → existing labels are used (full backward compatibility).
  evidence_label?: string;       // e.g. "Current Listing", "Current State"
  fix_label?: string;            // e.g. "Corrected Listing", "Proposed Fix"
  slot_label?: string;           // e.g. "Google", "Booking button"
  slot_label_prefix?: string;    // e.g. "Platform #" instead of "Review #"
  section_title?: string;        // e.g. "The Preview (3 listing corrections)"
  first_slot_label?: string;     // e.g. "THE MOST VISIBLE - ..." instead of "THE NEGATIVE - ..."
}

export interface PitchRenderInput {
  openerText: string;
  headerText: string | null;
  reviewPairs: ReviewPair[];
  closerText: string | null;
  contactText: string | null;
}

export interface AssemblePitchInput {
  campaignId: string;
  openerId: string;
  headerId?: string | null;
  closerId?: string | null;
  contactId?: string | null;
  reviewPairs: ReviewPair[];
  createdBy?: string;
}

// ─── Renderer ────────────────────────────────────────────────────────────

const SECTION_DIVIDER = '----------------------';

// Human-readable labels for the structured footprint focus attributes.
// Used by the renderer + the footprint-diff reporting endpoint so the
// before/after report reads "Address" instead of "address".
export const FOOTPRINT_FOCUS_LABELS: Record<FootprintFocusAttribute, string> = {
  name: 'Name',
  address: 'Address',
  phone: 'Phone',
  website: 'Website',
  claim_status: 'Claim Status',
};

/**
 * A pair is "structured" (carries the platform/profile/focus footprint
 * fields) when it has at least a platform_name + focus_attribute. The
 * free-text review_text/response_text may still be present as a fallback
 * or operator note, but the structured fields drive the rendering when set.
 */
function isStructuredFootprint(pair: ReviewPair): boolean {
  return !!(pair.platform_name && pair.focus_attribute);
}

/**
 * Render a single structured footprint slot as a Current State → Proposed
 * Fix block with platform name, profile URL, the focus attribute, the
 * inconsistent value, the corrected value, and an optional summary line.
 */
function renderStructuredFootprintSlot(pair: ReviewPair, slotName: string, evidenceLabel: string, fixLabel: string): string[] {
  const focusLabel = FOOTPRINT_FOCUS_LABELS[pair.focus_attribute!] ?? pair.focus_attribute;
  const out: string[] = [];
  out.push(slotName);
  // ── Current state box ──
  out.push(`${evidenceLabel}:`);
  out.push(`Platform name: ${pair.platform_name}`);
  if (pair.profile_url) out.push(`Profile URL: ${pair.profile_url}`);
  out.push(`Inconsistent Info (${focusLabel}): ${pair.current_value ?? '(not specified)'}`);
  // ── Proposed fix box ──
  out.push(`${fixLabel}:`);
  out.push(`Platform name: ${pair.platform_name}`);
  if (pair.profile_url) out.push(`Profile URL: ${pair.profile_url}`);
  out.push(`Correct Info (${focusLabel}): ${pair.correct_value ?? '(not specified)'}`);
  if (pair.summary && pair.summary.trim()) {
    out.push(`Summary: ${pair.summary.trim()}`);
  }
  return out;
}

/**
 * Render the full pitch text in the fixed format.
 *
 * The review pairs are ordered so the `is_negative_first` slot renders first,
 * then the remaining slots in their original order. This enforces the
 * "handled 1-star goes first" rule from the format spec regardless of how
 * the operator ordered them in the input.
 */
export function renderPitchText(input: PitchRenderInput): string {
  const { openerText, headerText, reviewPairs, closerText, contactText } = input;

  // Order: negative-first slot first, then the rest in original order.
  const negativeFirst = reviewPairs.find((p) => p.is_negative_first);
  const rest = reviewPairs.filter((p) => !p.is_negative_first);
  const ordered = negativeFirst ? [negativeFirst, ...rest] : reviewPairs;

  // Archetype-aware labels: read from the first pair (all pairs in a pitch
  // share the same archetype config). Fall back to the review-centric
  // defaults when absent so legacy pitches render identically.
  const cfg = reviewPairs[0] ?? {};
  const sectionTitle = cfg.section_title ?? 'The Preview (3 completed reviews + responses):';
  const firstSlotLabel = cfg.first_slot_label ?? 'THE NEGATIVE - The handled 1-star goes first';
  const slotLabelPrefix = cfg.slot_label_prefix ?? 'Review #';
  const evidenceLabel = cfg.evidence_label ?? 'Customer Review';
  const fixLabel = cfg.fix_label ?? 'Owner Response Message';

  const lines: string[] = [];

  lines.push('The Pitch');
  lines.push('');
  lines.push('The Opener (handshake):');
  lines.push(openerText.trim());
  lines.push('');
  lines.push('The Header (subject):');
  lines.push(headerText ? headerText.trim() : '(header not set)');
  lines.push('');
  lines.push(sectionTitle);
  lines.push('');
  lines.push(firstSlotLabel);
  lines.push('');

  ordered.forEach((pair, idx) => {
    const slotNum = idx + 1;
    const slotName = pair.slot_label ? `${slotLabelPrefix} ${slotNum} — ${pair.slot_label}` : `${slotLabelPrefix} ${slotNum}`;
    if (isStructuredFootprint(pair)) {
      lines.push(...renderStructuredFootprintSlot(pair, slotName, evidenceLabel, fixLabel));
    } else {
      lines.push(slotName);
      lines.push(`${evidenceLabel}: "${pair.review_text.trim()}"`);
      lines.push(`${fixLabel}: "${pair.response_text.trim()}"`);
    }
    if (idx < ordered.length - 1) {
      lines.push(SECTION_DIVIDER);
    }
  });
  lines.push(SECTION_DIVIDER);

  lines.push('CLOSER - The closer creates the itch');
  lines.push('');
  lines.push(closerText ? closerText.trim() : '(closer not set)');
  lines.push('');

  if (contactText && contactText.trim()) {
    lines.push(`My Contact:  ${contactText.trim()}`);
  }

  return lines.join('\n');
}
