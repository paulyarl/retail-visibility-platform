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

  const lines: string[] = [];

  lines.push('The Pitch');
  lines.push('');
  lines.push('The Opener (handshake):');
  lines.push(openerText.trim());
  lines.push('');
  lines.push('The Header (subject):');
  lines.push(headerText ? headerText.trim() : '(header not set)');
  lines.push('');
  lines.push('The Preview (3 completed reviews + responses):');
  lines.push('');
  lines.push('THE NEGATIVE - The handled 1-star goes first');
  lines.push('');

  ordered.forEach((pair, idx) => {
    const reviewNum = idx + 1;
    lines.push(`Review # ${reviewNum}`);
    lines.push(`Customer Review: "${pair.review_text.trim()}"`);
    lines.push(`Owner Response Message: "${pair.response_text.trim()}"`);
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
