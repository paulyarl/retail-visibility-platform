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
 * Sprint 2 (§5.6): Added product-visibility pitch prompt variants for A6
 * campaigns. The header/closer prompts now branch on archetype via
 * buildHeaderPromptForArchetype / buildCloserPromptForArchetype.
 *
 * Hard constraints shared with the opener prompts:
 *   - No pricing, no tier labels, no "digital opportunity score", no jargon
 *   - No positive-infrastructure notes (HTTPS, mobile-friendly)
 *   - No exclamation points, no emojis
 *   - Specificity over cleverness — name the business + the audit signal
 *
 * See: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §3
 *      docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md §5.6
 */

/**
 * Shared persona preamble for review-management archetypes (A1–A5) — mirrors
 * the one in outreach-openers/archetype-prompts.ts.
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
 * Sprint 2 (§5.6): Persona preamble for A6 (Product Visibility Gap) campaigns.
 * The auditor found that customers can't see the store or its products online —
 * not a review problem. Leading with "reviews are going unanswered" would be
 * factually wrong for a grocery store with strong community loyalty.
 */
const PERSONA_PREAMBLE_A6 = `You are a local-business visibility auditor. You looked at this business's
online presence — its Google Business Profile, website, and directory listings —
and found that customers cannot see the store or its products before visiting.
The GBP photos don't show the storefront or the products. There's no way to
browse what's carried, check if something is in stock, or see pickup/delivery
options. The business has loyal customers who walk in — but new customers
searching online can't tell what's inside.

You're reaching out cold to the small business owner. The goal: prove you
actually looked at their online presence, surface the specific visibility gap,
and offer a concrete deliverable that fixes it — not a sales pitch. The tone
is quiet, specific, and useful. You are not a vendor. You are someone who did
the homework for them.`;

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

// ─── Header (Subject Line) — A6 Product Visibility ───────────────────────

const HEADER_PROMPT_A6 = `${PERSONA_PREAMBLE_A6}

Write the subject line for this cold first-touch outreach.

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write one subject line, 4–60 characters, that names the business and
references the product-visibility gap — the missing storefront/product photos,
the missing product browsing, or the missing availability inquiry path.
No pricing, no jargon, no exclamation points, no emojis. Specificity over
cleverness. Do NOT reference reviews or booking — this is a product
discoverability problem, not a review or booking problem.

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

// ─── Closer — A6 Product Visibility ──────────────────────────────────────

const CLOSER_PROMPT_A6 = `${PERSONA_PREAMBLE_A6}

Write the closer line for this cold first-touch outreach pitch. The closer
creates the itch — it tells the owner that more proof exists beyond the 3
previews shown (mobile catalog mockup, GBP photo optimization, availability-
inquiry flow).

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write one closer line, ≤25 words, that conveys "the full product
visibility plan — including the fulfillment pathway and hours sync — plus
the remaining {{remaining}} sections are ready to deliver today." Vary the
phrasing but keep the itch — the owner should feel that more evidence is
one reply away. No pricing, no exclamation points, no emojis. Do NOT
reference reviews or booking.

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

// ─── Preview-Slot Drafts (archetype-aware) ───────────────────────────────
//
// The 3-slot preview generalizes beyond review responses. Each archetype has
// its own "evidence → fix" pair shape. These prompts draft the FIX half from
// the EVIDENCE the operator pastes (the wrong listing, the missing CTA, the
// missing product presence). The evidence itself is never AI-generated — the
// operator pastes the real public state from the platform/website.

const LISTING_FIX_PROMPT = `You are drafting a corrected listing entry for a small business's
{{slot_label}} listing. The operator pasted the current (wrong) state; you
produce the corrected version that reconciles it against the business's
canonical name/address/phone. Tone: {{tone}}.

Current listing (wrong):
{{evidence_text}}

Business name: {{business_name}}

Task: Write the corrected listing entry, ≤80 words. State the canonical
value clearly (name, address, and/or phone as relevant), note what was
wrong in one phrase, and confirm the correction is ready to push. No
exclamation points, no emojis, no pricing.

Output the corrected entry only — no preamble, no explanation.`;

const CTA_FIX_PROMPT = `You are drafting a concrete conversion fix for a small business's website.
The operator pasted the current state (the missing booking button, the
missing click-to-call, the missing scheduling link); you produce the
specific fix and where it goes. Tone: {{tone}}.

Current state:
{{evidence_text}}

Business name: {{business_name}}

Task: Write the proposed fix, ≤80 words. Name the exact element to add
(button label, placement, link target), why it removes the friction, and
confirm it's ready to implement. No exclamation points, no emojis, no
pricing.

Output the fix only — no preamble, no explanation.`;

const PRODUCT_VISIBILITY_FIX_PROMPT = `You are drafting a concrete product-visibility fix for a small business.
The operator pasted the current state (no storefront photos, no product
browsing, no availability inquiry); you produce the specific fix that
makes the store's products visible online. Tone: {{tone}}.

Current state:
{{evidence_text}}

Business name: {{business_name}}

Task: Write the proposed fix, ≤80 words. Name the exact change (photo set,
catalog page, availability/inquiry flow), what it lets the customer do
that they couldn't before, and confirm it's ready to deliver. No
exclamation points, no emojis, no pricing. Do NOT reference reviews or
booking — this is a product discoverability problem.

Output the fix only — no preamble, no explanation.`;

// ─── Builders ────────────────────────────────────────────────────────────

/**
 * Build the resolved header (subject line) prompt by injecting extracted
 * fields as a JSON block.
 */
export function buildHeaderPrompt(extractedFieldsJson: string): string {
  return HEADER_PROMPT.replace('{{extracted_fields}}', extractedFieldsJson);
}

/**
 * Sprint 2 (§5.6): Build the resolved header prompt for a specific archetype.
 * A6 → product-visibility header; A1–A5 or unknown → review-management header.
 */
export function buildHeaderPromptForArchetype(
  archetype: string,
  extractedFieldsJson: string,
): string {
  if (archetype === 'A6') {
    return HEADER_PROMPT_A6.replace('{{extracted_fields}}', extractedFieldsJson);
  }
  return buildHeaderPrompt(extractedFieldsJson);
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
 * Sprint 2 (§5.6): Build the resolved closer prompt for a specific archetype.
 * A6 → product-visibility closer (references the product visibility plan, not
 * review responses); A1–A5 or unknown → review-management closer.
 */
export function buildCloserPromptForArchetype(
  archetype: string,
  extractedFieldsJson: string,
  remaining: number,
): string {
  if (archetype === 'A6') {
    return CLOSER_PROMPT_A6.replace('{{extracted_fields}}', extractedFieldsJson)
      .replace('{{remaining}}', String(remaining));
  }
  return buildCloserPrompt(extractedFieldsJson, remaining);
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

/**
 * Build the resolved preview-slot draft prompt for a specific archetype.
 *
 * The 3-slot preview generalizes beyond review responses:
 *   - A1/A2 (and A5 fallback) → review-response prompt (the original behavior)
 *   - A3 → listing correction prompt (evidence = wrong listing, fix = corrected entry)
 *   - A4 → CTA fix prompt (evidence = current state, fix = proposed conversion fix)
 *   - A6 → product-visibility fix prompt (evidence = current presence, fix = proposed visibility fix)
 *
 * `slotLabel` is the per-slot label (e.g. "Google", "Booking button",
 * "Storefront photos") used to focus the draft on that specific platform/gap.
 */
export function buildPreviewSlotPrompt(
  archetype: string,
  evidenceText: string,
  businessName: string,
  tone: string,
  slotLabel?: string,
): string {
  const label = slotLabel || 'the listing';
  const toneStr = tone || 'short informal';
  if (archetype === 'A3') {
    return LISTING_FIX_PROMPT
      .replace('{{slot_label}}', label.toLowerCase())
      .replace('{{evidence_text}}', evidenceText)
      .replace('{{business_name}}', businessName)
      .replace('{{tone}}', toneStr);
  }
  if (archetype === 'A4') {
    return CTA_FIX_PROMPT
      .replace('{{evidence_text}}', evidenceText)
      .replace('{{business_name}}', businessName)
      .replace('{{tone}}', toneStr);
  }
  if (archetype === 'A6') {
    return PRODUCT_VISIBILITY_FIX_PROMPT
      .replace('{{evidence_text}}', evidenceText)
      .replace('{{business_name}}', businessName)
      .replace('{{tone}}', toneStr);
  }
  // A1, A2, A5, or unknown → review-response prompt (legacy behavior)
  return buildReviewResponsePrompt(evidenceText, businessName, toneStr);
}
