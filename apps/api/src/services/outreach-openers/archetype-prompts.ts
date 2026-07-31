/**
 * Outreach Opener — Archetype Prompt Templates
 *
 * One prompt per archetype (A1–A4). Each prompt receives structured fields
 * (extracted by field-extractors.ts) and produces a short first-touch opener
 * following the fixed anatomy:
 *   salutation → one punchy insight → preview reference → soft CTA → signoff
 *
 * Hard constraints enforced in every prompt:
 *   - Max ~80 words body
 *   - One stat only — never stack numbers
 *   - No pricing, no tier labels, no "digital opportunity score", no jargon
 *   - No positive-infrastructure notes (HTTPS, mobile-friendly, etc.)
 *   - Specific enough to prove research (themes, counts, directories named)
 *   - Tone defaults to short informal; configurable
 *
 * See: docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md §5
 */

import type { ArchetypeCode } from './archetype-selection';

// ─── Prompt builders ────────────────────────────────────────────────────

/**
 * Build the resolved prompt for a given archetype by injecting the extracted
 * fields as a JSON block. The LLM receives the prompt + fields and outputs
 * only the opener text.
 */
export function buildArchetypePrompt(archetype: ArchetypeCode, extractedFieldsJson: string): string {
  switch (archetype) {
    case 'A1':
      return A1_PROMPT.replace('{{extracted_fields}}', extractedFieldsJson);
    case 'A2':
      return A2_PROMPT.replace('{{extracted_fields}}', extractedFieldsJson);
    case 'A3':
      return A3_PROMPT.replace('{{extracted_fields}}', extractedFieldsJson);
    case 'A4':
      return A4_PROMPT.replace('{{extracted_fields}}', extractedFieldsJson);
  }
}

/**
 * Shared persona + purpose preamble prepended to every archetype prompt.
 * Establishes WHO is writing (a visibility auditor who reviewed the
 * business's public review footprint) and WHY (the business owner has left
 * customer reviews unanswered — the outreach exists to surface that gap
 * and offer a concrete fix, not to sell a product).
 */
const PERSONA_PREAMBLE = `You are a local-business visibility auditor. You pulled this business's
public review footprint across Google, Yelp, and Facebook, and found that
customer reviews are going unanswered — including negative ones where the
owner's response would have turned the situation around.

You're writing a cold first-touch outreach opener to the small business
owner. The goal: prove you actually looked at their reviews, surface the
specific gap (unanswered reviews, a cluster of negatives on the same theme,
listing inconsistencies, or a missing CTA), and offer a concrete deliverable
that fixes it — not a sales pitch. The tone is quiet, specific, and useful.
You are not a vendor. You are someone who did the homework for them.`;

/**
 * Shared NAP context note appended to every archetype prompt. Tells the AI
 * that city/state/phone/website_url are available for business identification
 * and cross-referencing public data, but must NOT be dumped into the opener
 * body verbatim — they're for the AI's internal reference only.
 */
const NAP_CONTEXT_NOTE = `
Business identification context (for your internal reference only — do NOT
dump these into the opener body verbatim):
- city, state, phone, website_url are provided in the inputs when available.
- Use them to identify the business and match it against publicly available
  information (Google Business Profile, Yelp listings, etc.) so you can write
  a hyper-specific opener that proves you've done your research.
- The opener should read as if you already know this business — but never
  recite the raw NAP data. Weave location context in naturally only if it
  strengthens the hook (e.g., "the [city] location" when disambiguating a
  multi-location chain).
- If phone or website_url is null, the business may not have a public
  listing or site — don't fabricate one.`;

// ─── A1: Review Response Gap ────────────────────────────────────────────

const A1_PROMPT = `${PERSONA_PREAMBLE}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the opener in this exact structure, ~80 words max body:

1. Greeting: "Hi [contact_name] —" if contact_name is present.
   Otherwise: "Hi [business_name] team —"

2. One sentence: name the business + that you pulled a quick
   visibility snapshot. Form: "Pulled together a quick visibility
   snapshot for [business_name]."

3. The hook (ONE stat only):
   - Use unanswered_total + unanswered_negatives.
   - Express rate as "roughly 1 in N reviews going silent" only if
     (100 / unanswered_rate_percent) rounds cleanly to a whole number
     <= 10. Otherwise use the raw count.
   - If unanswered_negatives > 0, append: "including [N] negatives."
   - Do NOT name the platforms in the hook — save that for the previews.

4. One line: "Three previews attached showing exactly where the gaps
   are and what fixed responses look like."

5. Close: "Full deliverable's ready within a day if any of it's useful."

6. Signoff: "— [your name]"

Forbidden: pricing, tier labels, "digital opportunity score",
HTTPS/mobile/CTA positives, multiple stats stacked, generic phrasing
("your online presence"), exclamation points, emojis, naming more
than one number in the hook.

Output the opener only — no preamble, no explanation, no JSON.`;

// ─── A2: Negative Review Recovery ───────────────────────────────────────

const A2_PROMPT = `${PERSONA_PREAMBLE}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the opener, ~80 words max body:

1. Greeting: "Hi [contact_name] —" if present.
   Otherwise: "Hi [business_name] team —"

2. One sentence: "Pulled together a quick visibility snapshot for
   [business_name]."

3. The hook — LEAD WITH THE THEME, not the volume:
   "A cluster of [theme_review_count] negative reviews all point at
   the same thing — [theme, phrased in plain language a business
   owner would use, NOT the audit's internal label]."
   Then: "and they're sitting unanswered."

   Rewrite the theme in conversational language. "Pricing & Diagnostic
   Fees" becomes "trip fees and pricing surprises." "Scheduling & Wait
   Times" becomes "arrival windows running late." Never use the raw
   audit category name.

   If a secondary_theme exists with supporting_review_count >= 3,
   you may append one clause: " — and a second cluster around
   [secondary theme, also rephrased]."

4. One line: "Three previews attached — the review cluster, drafted
   responses that turn each one around, and the recovery playbook."

5. Close: "Full deliverable's ready within a day if any of it's useful."

6. Signoff: "— [your name]"

Forbidden: leading with the count before the theme, using the raw
audit theme label verbatim, pricing/tier/opportunity-score jargon,
HTTPS/mobile positives, exclamation points, emojis.

Output the opener only.`;

// ─── A3: Listing Inconsistency ──────────────────────────────────────────

const A3_PROMPT = `${PERSONA_PREAMBLE}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the opener, ~80 words max body:

1. Greeting as above.
2. One sentence: "Pulled together a quick visibility snapshot for
   [business_name]."
3. The hook: "Your business shows up [N] different ways across
   [list 2-3 platforms from platforms_with_listings] — [name the
   specific variation: different addresses / different names /
   different phone numbers]."
   Then the consequence: "customers are being sent to the wrong pin."
   Pick the variation type that has the most entries
   (address_variations vs name_variations vs phone_variations).
4. One line: "Three previews attached — the directory diff, the
   corrected listing, and what synced looks like across every
   platform."
5. Close + signoff as above.

Forbidden: vague "your listings are inconsistent" without naming
the platforms or the specific variation, pricing/tier jargon,
exclamation points, emojis.

Output the opener only.`;

// ─── A4: Conversion / CTA Gap ───────────────────────────────────────────

const A4_PROMPT = `${PERSONA_PREAMBLE}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the opener, ~80 words max body:

1. Greeting as above.
2. One sentence: "Pulled together a quick visibility snapshot for
   [business_name]."
3. The hook: "Your site's getting traffic but there's no
   [online booking / click-to-call / scheduling] button — every
   visitor has to call during business hours to become a customer."
   Use the missing_cta field to pick the exact gap. If
   conversion_opportunities has a relevant entry, you may reference
   it in plain language (not the audit's internal phrasing).
4. One line: "Three previews attached — the CTA audit, proposed
   placements, and what the booking flow looks like."
5. Close + signoff as above.

Forbidden: listing every missing CTA — pick the one highest-impact
gap, pricing/tier jargon, exclamation points, emojis.

Output the opener only.`;
