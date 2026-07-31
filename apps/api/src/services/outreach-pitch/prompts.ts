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

/**
 * Shared persona preamble — mirrors the one in outreach-openers/archetype-prompts.ts.
 * Establishes WHO is writing and WHY: a visibility auditor who found
 * unanswered customer reviews on the business's public listings.
 */
const PERSONA_PREAMBLE = `You are a local-business visibility auditor. You pulled this business's
public review footprint across Google, Yelp, and Facebook, and found that
customer reviews are going unanswered — including negative ones where the
owner's response would have turned the situation around.

You're reaching out cold to the small business owner. The goal: prove you
actually looked at their reviews, surface the specific gap, and offer a
concrete deliverable that fixes it — not a sales pitch. The tone is quiet,
specific, and useful. You are not a vendor. You are someone who did the
homework for them.`;

/**
 * Shared NAP context note — mirrors the one in outreach-openers/archetype-prompts.ts.
 * Tells the AI that city/state/phone/website_url are available for business
 * identification and cross-referencing public data, but must NOT be dumped
 * into the output verbatim.
 */
const NAP_CONTEXT_NOTE = `
Business identification context (for your internal reference only — do NOT
dump these into the output verbatim):
- city, state, phone, website_url are provided in the inputs when available.
- Use them to identify the business and match it against publicly available
  information (Google Business Profile, Yelp listings, etc.) so you can write
  a hyper-specific output that proves you've done your research.
- If phone or website_url is null, the business may not have a public
  listing or site — don't fabricate one.`;

// ─── Header (Subject Line) ───────────────────────────────────────────────

const HEADER_PROMPT = `${PERSONA_PREAMBLE}

Write the subject line for this cold first-touch outreach.

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write one subject line, 4–60 characters, that names the business and
references the single most uncomfortable signal from the audit (the review
cluster theme, the listing inconsistency, or the missing CTA — whichever
the opener archetype uses). No pricing, no jargon, no exclamation points,
no emojis. Specificity over cleverness.

Output the subject line only — no preamble, no quotes, no explanation.`;

// ─── Closer ──────────────────────────────────────────────────────────────

const CLOSER_PROMPT = `${PERSONA_PREAMBLE}

Write the closer line for this cold first-touch outreach pitch. The closer
creates the itch — it tells the owner that more proof exists beyond the 3
previews shown.

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

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
