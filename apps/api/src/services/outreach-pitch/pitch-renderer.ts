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

export interface ReviewPair {
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
    lines.push(slotName);
    lines.push(`${evidenceLabel}: "${pair.review_text.trim()}"`);
    lines.push(`${fixLabel}: "${pair.response_text.trim()}"`);
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
