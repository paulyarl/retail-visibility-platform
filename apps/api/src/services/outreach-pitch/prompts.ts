/**
 * Outreach Pitch — Prompt Templates
 *
 * Three prompt builders for the pitch components that use the dual AI/Import
 * path:
 *   - buildHeaderPrompt        — subject line (Header variants)
 *   - buildCloserPrompt        — closer line (Closer variants)
 *   - buildReviewResponsePrompt — owner response draft (per review slot)
 *
 * The opener prompt lives in outreach-openers/archetype-prompts.ts and is not
 * re-built here — the opener is selected from existing variants at pitch
 * assembly time.
 *
 * Hard constraints shared with the opener prompts:
 *   - No pricing, no tier labels, no "digital opportunity score", no jargon
 *   - No positive-infrastructure notes (HTTPS, mobile-friendly)
 *   - No exclamation points, no emojis
 *   - Specificity over cleverness — name the business + the audit signal
 *
 * See: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §3
 */

// ─── Header (Subject Line) ───────────────────────────────────────────────

const HEADER_PROMPT = `You are writing a cold first-touch outreach subject line to a small business owner.

Inputs (JSON):
{{extracted_fields}}

Task: Write one subject line, 4–60 characters, that names the business and
references the single most uncomfortable signal from the audit (the review
cluster theme, the listing inconsistency, or the missing CTA — whichever
the opener archetype uses). No pricing, no jargon, no exclamation points,
no emojis. Specificity over cleverness.

Output the subject line only — no preamble, no quotes, no explanation.`;

// ─── Closer ──────────────────────────────────────────────────────────────

const CLOSER_PROMPT = `You are writing the closer line for a cold first-touch outreach pitch to a
small business owner. The closer creates the itch — it tells the owner that
more proof exists beyond the 3 previews shown.

Inputs (JSON):
{{extracted_fields}}

Task: Write one closer line, ≤25 words, that conveys "the remaining
{{remaining}} responses are written and ready to deliver today." Vary the
phrasing but keep the itch — the owner should feel that more evidence is
one reply away. No pricing, no exclamation points, no emojis.

Output the closer only — no preamble, no signoff, no explanation.`;

// ─── Review Response Draft ───────────────────────────────────────────────

const REVIEW_RESPONSE_PROMPT = `You are drafting an owner response to a customer review for a small business.
The response turns the review around — acknowledges the issue, names the
specific fix, and invites the customer back. Tone: {{tone}}.

Customer review:
{{review_text}}

Business name: {{business_name}}

Task: Write the owner response, ≤80 words. No exclamation points, no emojis,
no pricing. Acknowledge the specific complaint, name the concrete fix, end
with an invitation to return.

Output the response only — no preamble, no explanation.`;

// ─── Builders ────────────────────────────────────────────────────────────

/**
 * Build the resolved header (subject line) prompt by injecting extracted
 * fields as a JSON block.
 */
export function buildHeaderPrompt(extractedFieldsJson: string): string {
  return HEADER_PROMPT.replace('{{extracted_fields}}', extractedFieldsJson);
}

/**
 * Build the resolved closer prompt by injecting extracted fields + the
 * computed remaining count.
 */
export function buildCloserPrompt(extractedFieldsJson: string, remaining: number): string {
  return CLOSER_PROMPT.replace('{{extracted_fields}}', extractedFieldsJson)
    .replace('{{remaining}}', String(remaining));
}

/**
 * Build the resolved review-response draft prompt for one review slot.
 * Uses the campaign's tone field.
 */
export function buildReviewResponsePrompt(reviewText: string, businessName: string, tone: string): string {
  return REVIEW_RESPONSE_PROMPT
    .replace('{{review_text}}', reviewText)
    .replace('{{business_name}}', businessName)
    .replace('{{tone}}', tone || 'short informal');
}
