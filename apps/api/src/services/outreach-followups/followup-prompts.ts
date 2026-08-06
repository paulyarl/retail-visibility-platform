/**
 * Outreach Follow-Up — Prompt Templates
 *
 * Follow-up messages for prospects who didn't reply to the opener. Two
 * branches, selected automatically by the service based on a fresh-snapshot
 * diff against the opener's stored data_snapshot:
 *
 *   'doing'   — footprint changed since opener (new reviews, new themes).
 *               Follow-up shows new proof. Aligns with the opener's
 *               showing-not-telling philosophy. Silently demonstrates the
 *               retainer value proposition: "I'm watching your business
 *               even when you're not paying me to."
 *
 *   'telling' — footprint unchanged. Follow-up reminds the prospect of
 *               existing previews. Fallback when there's nothing new to
 *               show. Weaker but honest.
 *
 * Anatomy (distinct from opener):
 *   greeting → context anchor → new proof / reminder → close → signoff
 *
 * The context anchor replaces the opener's "Pulled together a quick
 * visibility snapshot" handshake. It anchors to the prior touch instead
 * of establishing first contact. This is the key structural difference —
 * the follow-up can't reuse the opener's intro because the relationship
 * already exists.
 *
 * The close line is shared with the opener — same {{close_line}}
 * injection, same close_variant. The follow-up inherits the opener's
 * variant so the cohort is consistent across the full sequence.
 *
 * See: docs/LocalBiz/marketing_ops_outreach_followup_sprint_plan.md
 */

import type { ArchetypeCode } from '../outreach-openers/archetype-selection';
import { CLOSE_VARIANTS, DEFAULT_CLOSE_VARIANT, type CloseVariant } from '../outreach-openers/archetype-prompts';

// ─── Types ──────────────────────────────────────────────────────────────

export type FollowUpType = 'doing' | 'telling';

export interface FollowUpDataDiff {
  /** New review count since opener (doing branch only) */
  new_review_count?: number;
  /** New negative review count since opener (doing branch only) */
  new_negative_count?: number;
  /** New themes that appeared since opener (doing branch only) */
  new_themes?: string[];
  /** Platforms where new reviews appeared (doing branch only) */
  new_platforms?: string[];
  /** The opener's original theme (for reference in both branches) */
  opener_theme?: string;
  /** The opener's original archetype (for template selection) */
  opener_archetype?: ArchetypeCode;
}

// ─── Prompt builder ─────────────────────────────────────────────────────

/**
 * Build the resolved follow-up prompt for a given archetype + branch.
 * Injects the extracted fields, the data diff, and the selected close
 * variant line. The LLM receives the prompt and outputs only the
 * follow-up text.
 *
 * The closeVariant is inherited from the opener — the follow-up uses
 * the same close strategy as the opener that triggered it, so the
 * cohort is consistent across the full message sequence.
 */
export function buildFollowUpPrompt(
  archetype: ArchetypeCode,
  followUpType: FollowUpType,
  extractedFieldsJson: string,
  dataDiff: FollowUpDataDiff | null,
  closeVariant: CloseVariant = DEFAULT_CLOSE_VARIANT,
): string {
  const closeLine = CLOSE_VARIANTS[closeVariant] ?? CLOSE_VARIANTS[DEFAULT_CLOSE_VARIANT];
  const diffJson = dataDiff ? JSON.stringify(dataDiff, null, 2) : 'null';

  const template = FOLLOWUP_TEMPLATES[archetype]?.[followUpType] ?? FOLLOWUP_TEMPLATES.A1[followUpType];

  return template
    .replace('{{extracted_fields}}', extractedFieldsJson)
    .replace('{{data_diff}}', diffJson)
    .replace('{{close_line}}', closeLine);
}

// ─── Shared persona for follow-ups ──────────────────────────────────────

const FOLLOWUP_PERSONA = `You are a local-business visibility auditor. You previously sent a cold
first-touch outreach opener to this business owner, showing them their
unanswered reviews and offering a deliverable to fix the gap. They did
not reply. You're now writing a follow-up message.

The tone is still quiet, specific, and useful. You are not a vendor.
You are someone who did the homework for them — and is still paying
attention.`;

const NAP_CONTEXT_NOTE = `
Business identification context (for your internal reference only — do NOT
dump these into the follow-up body verbatim):
- city, state, phone, website_url are provided in the inputs when available.
- Use them to identify the business but never recite the raw NAP data.`;

// ─── DOING branch templates (footprint changed) ─────────────────────────

const DOING_TEMPLATE_A1 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Data diff (what changed since the opener):
{{data_diff}}

Task: Write the follow-up in this exact structure, ~70 words max body:

1. Greeting: "Hi [contact_name] —" if contact_name is present.
   Otherwise: "Hi [business_name] team —"

2. Context anchor (DISTINCT from the opener's handshake — do NOT say
   "Pulled together a quick visibility snapshot"):
   "Since the snapshot last week —"

3. New proof (USE THE DATA DIFF — show, don't tell):
   - If new_review_count > 0: "[N] new reviews came in on [platform],
     [N] still unanswered."
   - If new_negative_count > 0, append: "including [N] negatives."
   - Do NOT repeat the opener's original stat. This is NEW information.

4. One line: "I drafted responses for those too — updated preview attached."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: repeating the opener's hook, pricing, tier labels,
exclamation points, emojis, "just following up", "checking in",
"circling back", generic phrasing.

Output the follow-up only — no preamble, no explanation.`;

const DOING_TEMPLATE_A2 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Data diff (what changed since the opener):
{{data_diff}}

Task: Write the follow-up, ~70 words max body:

1. Greeting as above.

2. Context anchor: "Since the snapshot last week —"

3. New proof (USE THE DATA DIFF):
   - If new_themes exist: "a new cluster of [N] negative reviews on
     [rephrased new theme] appeared."
   - If only new_review_count on the same theme: "[N] more reviews on
     the same [opener's rephrased theme] cluster came in — still
     unanswered."
   - Rephrase themes in conversational language, same as the opener.
   - Do NOT repeat the opener's original theme wording verbatim if
     new_themes exist — lead with what's NEW.

4. One line: "I drafted responses for the new ones — updated preview attached."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: repeating the opener's hook, "just following up",
"checking in", pricing/tier jargon, exclamation points, emojis.

Output the follow-up only.`;

const DOING_TEMPLATE_A3 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Data diff (what changed since the opener):
{{data_diff}}

Task: Write the follow-up, ~70 words max body:

1. Greeting as above.

2. Context anchor: "Since the snapshot last week —"

3. New proof (USE THE DATA DIFF):
   - If new listings appeared: "the listing spread got worse — now
     showing up [N] different ways across [platforms]."
   - If new address/phone variations: "new variations showed up on
     [platform]."
   - Do NOT repeat the opener's original variation count. This is NEW.

4. One line: "Updated the directory diff — corrected listing attached."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: repeating the opener's hook, "just following up",
pricing/tier jargon, exclamation points, emojis.

Output the follow-up only.`;

const DOING_TEMPLATE_A4 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Data diff (what changed since the opener):
{{data_diff}}

Task: Write the follow-up, ~70 words max body:

1. Greeting as above.

2. Context anchor: "Since the snapshot last week —"

3. New proof (USE THE DATA DIFF):
   - If new conversion gaps appeared: "noticed [new gap] is also
     missing — on top of the [opener's original gap]."
   - If traffic data changed: "the [opener's original gap] is still
     open, and [N] more visitors bounced since."
   - Do NOT repeat the opener's original CTA gap verbatim. Lead with
     what's NEW or what's worsened.

4. One line: "Updated the CTA audit — new placements attached."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: repeating the opener's hook, "just following up",
pricing/tier jargon, exclamation points, emojis.

Output the follow-up only.`;

// ─── TELLING branch templates (footprint unchanged) ─────────────────────

const TELLING_TEMPLATE_A1 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the follow-up, ~60 words max body:

1. Greeting: "Hi [contact_name] —" if present.
   Otherwise: "Hi [business_name] team —"

2. Context anchor: "Following up on the visibility snapshot from
   last week —"

3. Reminder (reference the existing previews, do NOT repeat the
   opener's stat):
   "the three previews are still there — the review gap, the drafted
   responses, and what fixed looks like."

4. Soft re-engagement: "Happy to walk through any of them if useful."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: repeating the opener's hook/stat, pricing, tier labels,
exclamation points, emojis, "just checking in", "circling back",
generic phrasing, introducing new data (nothing changed).

Output the follow-up only.`;

const TELLING_TEMPLATE_A2 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the follow-up, ~60 words max body:

1. Greeting as above.

2. Context anchor: "Following up on the visibility snapshot from
   last week —"

3. Reminder (reference the existing previews):
   "the three previews are still there — the [opener's rephrased theme]
   review cluster, the owner responses I drafted, and the recovery
   playbook."

4. Soft re-engagement: "Happy to walk through any of them if useful."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: repeating the opener's hook, pricing/tier jargon,
exclamation points, emojis, "just checking in", introducing new data.

Output the follow-up only.`;

const TELLING_TEMPLATE_A3 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the follow-up, ~60 words max body:

1. Greeting as above.

2. Context anchor: "Following up on the visibility snapshot from
   last week —"

3. Reminder:
   "the three previews are still there — the directory diff, the
   corrected listing, and what synced looks like."

4. Soft re-engagement: "Happy to walk through any of them if useful."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: repeating the opener's hook, pricing/tier jargon,
exclamation points, emojis, "just checking in", introducing new data.

Output the follow-up only.`;

const TELLING_TEMPLATE_A4 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the follow-up, ~60 words max body:

1. Greeting as above.

2. Context anchor: "Following up on the visibility snapshot from
   last week —"

3. Reminder:
   "the three previews are still there — the CTA audit, proposed
   placements, and what the booking flow looks like."

4. Soft re-engagement: "Happy to walk through any of them if useful."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: repeating the opener's hook, pricing/tier jargon,
exclamation points, emojis, "just checking in", introducing new data.

Output the follow-up only.`;

// ─── A5: Dual-Signal Footprint Triage ────────────────────────────────────
//
// A5_DUAL_TRIAGE combines repair (NAP/URL) and review-gap signals. The
// follow-up leads with whichever dimension changed (doing) or reminds the
// prospect of the combined footprint (telling). Sprint 6 will refine the
// copy; these stubs are complete enough to compile and generate usable text.

const DOING_TEMPLATE_A5 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Data diff (what changed since the opener):
{{data_diff}}

Task: Write the follow-up, ~70 words max body:

1. Greeting as above.

2. Context anchor: "Since the snapshot last week —"

3. New proof (USE THE DATA DIFF):
   - If new repair signals appeared: "noticed [new NAP/URL issue] on top
     of the listing drift — and the review gap is still open."
   - If new reviews landed unanswered: "[N] more reviews went unanswered
     since, on top of the listing drift."
   - Do NOT stack two numbers. Lead with whichever dimension changed;
     reference the other as context, not a second stat.

4. One line: "Updated the footprint repair plan — new previews attached."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: stacking stats, repeating the opener's hook verbatim,
pricing/tier jargon, exclamation points, emojis.

Output the follow-up only.`;

const TELLING_TEMPLATE_A5 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the follow-up, ~60 words max body:

1. Greeting as above.

2. Context anchor: "Following up on the visibility snapshot from
   last week —"

3. Reminder:
   "the three previews are still there — the footprint diff, the
   review-gap breakdown, and what synced looks like across every
   platform."

4. Soft re-engagement: "Happy to walk through any of them if useful."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: repeating the opener's hook, pricing/tier jargon,
exclamation points, emojis, "just checking in", introducing new data.

Output the follow-up only.`;

// ─── A6: Product Visibility Gap ──────────────────────────────────────────
//
// Follow-up for product/inventory businesses (grocery stores, bakeries,
// specialty markets). 'doing' leads with new product-visibility evidence
// (new photos, new catalog entries, new availability signals); 'telling'
// reminds the prospect of the product-visibility previews.

const DOING_TEMPLATE_A6 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Data diff (what changed since the opener):
{{data_diff}}

Task: Write the follow-up, ~70 words max body:

1. Greeting as above.

2. Context anchor: "Since the snapshot last week —"

3. New proof (USE THE DATA DIFF):
   - If new GBP photos appeared: "noticed [N] new photos on your Google
     listing — though the product catalog is still invisible online."
   - If the website gained product browsing: "your site's now showing
     product categories — good start, though availability inquiry is
     still missing."
   - If nothing product-related changed: "the product-discoverability
     gap is still there — customers still can't browse before visiting."
   - Do NOT stack numbers. Lead with the single most relevant change.

4. One line: "Updated the catalog mockup and GBP photo plan — new previews attached."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: "online booking," "scheduling," "service menu," "project
photos," stacking stats, repeating the opener's hook verbatim,
pricing/tier jargon, exclamation points, emojis.

Output the follow-up only.`;

const TELLING_TEMPLATE_A6 = `${FOLLOWUP_PERSONA}

Inputs (JSON):
{{extracted_fields}}
${NAP_CONTEXT_NOTE}

Task: Write the follow-up, ~60 words max body:

1. Greeting as above.

2. Context anchor: "Following up on the visibility snapshot from
   last week —"

3. Reminder:
   "the three previews are still there — the mobile catalog mockup,
   the GBP photo optimization, and the availability-inquiry flow."

4. Soft re-engagement: "Happy to walk through any of them if useful."

5. Close: "{{close_line}}"

6. Signoff: "— [your name]"

Forbidden: "online booking," "scheduling," "service menu," "project
photos," repeating the opener's hook, pricing/tier jargon,
exclamation points, emojis, "just checking in", introducing new data.

Output the follow-up only.`;

// ─── Template registry ──────────────────────────────────────────────────

const FOLLOWUP_TEMPLATES: Record<ArchetypeCode, Record<FollowUpType, string>> = {
  A1: { doing: DOING_TEMPLATE_A1, telling: TELLING_TEMPLATE_A1 },
  A2: { doing: DOING_TEMPLATE_A2, telling: TELLING_TEMPLATE_A2 },
  A3: { doing: DOING_TEMPLATE_A3, telling: TELLING_TEMPLATE_A3 },
  A4: { doing: DOING_TEMPLATE_A4, telling: TELLING_TEMPLATE_A4 },
  A5: { doing: DOING_TEMPLATE_A5, telling: TELLING_TEMPLATE_A5 },
  A6: { doing: DOING_TEMPLATE_A6, telling: TELLING_TEMPLATE_A6 },
};
