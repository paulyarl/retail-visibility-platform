/**
 * Seed script: Per-archetype briefing seek templates (routed siblings)
 *
 * A routed sibling campaign (PB-01 listing drift, PB-02 review gap, PB-03
 * CTA gap, PB-04 negative recovery, PB-07 product visibility) carries no
 * diagnostic of its own — its briefing is composed from the archetype's
 * deterministic fact slice of the shared business_analysis audit, injected
 * at render time as {{archetype_extract}} (MarketingExecutionService.
 * resolvePrompt → ProspectReportService.archetypeFactSlice).
 *
 * THE CONSISTENCY CONTRACT: the extract is the same evidence the
 * owner-facing Business Visibility Report chapter renders. The analyst
 * composes the operator narrative; it must agree with the extract. The
 * operator's briefing can never contradict the report the owner reads.
 *
 * Output schema: profile_repair_audit (shared operator-briefing shape —
 * scope/impact/pitch/risks + outreach_problems). RepairBriefingCard renders
 * these executions unchanged; serializeSeekBriefing can lift them into
 * fulfill context.
 *
 * Idempotent — upserts by template id. Safe to re-run.
 *
 * Usage:
 *   doppler run --config local -- npx tsx src/scripts/seed-archetype-briefing-templates.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { PROFILE_REPAIR_AUDIT_SCHEMA_NAME } from '../validators/profile-repair-output.schema';
import { logger } from '../logger';

const VARIABLES = [
  'business_name',
  'city',
  'state',
  'category',
  'audit_results',
  'audit_signals',
  'issue_type',
  'archetype',
  'archetype_label',
  'archetype_extract',
];

/**
 * Shared operator-outreach directive (Triage & Repair Outreach Problems
 * spec §2.2/§4.2 — the same contract the per-issue repair briefings carry,
 * bound to the archetype instead of an issue type).
 */
function outreachProblemsSection(archetypeBinding: string): string {
  return `### 6. Operator Outreach Problems & Solutions

Produce \`outreach_problems\` — an array of ONE to THREE (1–3) problem-and-solution pairs the operator can use directly in outreach to the prospect (the business owner). Return only the most painful problems, ranked by severity: when the audit surfaces a single real issue, return just that one — never pad the count. Each entry ships two spoken lines — a plain professional statement and a hook alternative — followed by the solution. Shape:

{ "problem": "<the problem as the prospect experiences it — the business consequence>",
  "regular": "<the plain professional line that raises this problem>",
  "hook": "<the alternative line — same fact, earns attention>",
  "solution": "<high-level summary of the fix — what gets done, not a named package>",
  "evidence": "<the audit-data observation that grounds this problem: platform + observed fact>",
  "outreach_use": "<how the operator deploys this pair — cold-call opener, email hook, objection response>" }

Rules:
* 1–3 entries — the most painful problems only, ranked by severity. One well-grounded pair beats three thin ones. Never pad the count with duplicated, weak, or invented problems; never exceed three. Each entry addresses a distinct customer-facing consequence — do not restate the same defect once per platform.
* Archetype alignment — ${archetypeBinding} Most painful AND on-archetype is the bar. Off-archetype pains belong in the other briefing fields (risks, pitch), never in \`outreach_problems\`.
* Ground every \`problem\` in the ARCHETYPE EXTRACT and audit data above — do not invent findings that are not present. You MAY visit the business's live profile or website as an ordinary public visitor to confirm what is observable today (no bypassing bot defenses, no logins, no intrusive testing). \`evidence\` cites what was actually observed — platform + observed fact.
* REPORT CONSISTENCY — the owner-facing report for this prospect renders the SAME extract. Nothing in outreach_problems may contradict it: never claim a fix for something the extract shows working, never recite internal signal codes or scores to the owner.
* Use the category intelligence block (when present) to make problems and solutions category-aware.
* Frame problems as business consequences ("customers calling the listed number reach a disconnected line"), never as technical labels ("NAP inconsistency").
* Solutions must be deliverable by the operator — never promise platform-side behavior the operator cannot control. Stay high-level: articulate the fix, never name a specific product — the operator maps your summary to the actual offer.
* Frame every pair in the develop-value-first motion: the platform seeds the prospect's directory presence first and invites the owner to claim it — the pairs ease pains the owner can already see.
* Tone — warm, professional, helpful: write copy the operator can read aloud to the owner with a straight face and a smile. Never dry, never dull.
`;
}

interface ArchetypeTemplate {
  id: string;
  name: string;
  /** The `{{archetype_extract}}` section header + per-archetype instructions. */
  extractFocus: string;
  /** Archetype-specific scope/impact/pitch/risk guidance. */
  instructions: string;
  /** Fixed issueType the output must emit. */
  issueType: string;
  archetypeBinding: string;
}

const TEMPLATES: ArchetypeTemplate[] = [
  {
    id: 'mpt-archetype-briefing-a1',
    name: 'Seek: Archetype Briefing — Review Gap (A1)',
    issueType: 'review_gap',
    extractFocus:
      'The extract carries the review picture: combined review metrics, per-platform rating/volume/response counts, the review-scoped gold-standard gap rows, plus the internal signal and outreach ammunition the owner-facing report redacts.',
    instructions: `### 1. Scope

Identify the review gap's specific scope from the extract and audit data:
- **summary**: 1-2 sentence plain-language summary (e.g., "44 reviews across listings but competitors carry hundreds; 3 sit with no reply.")
- **affected_platforms**: which platforms are thin or silent (from platform_reviews)
- **specifics**: what the numbers say — volume vs. the category benchmark, rating spread across platforms, response rate, the oldest unanswered review

### 2. Impact

Assess the business consequence of a thin or unmanaged review footprint:
- **primary_consequence**: the main business pain (e.g., "shoppers comparing two listings pick the one with 200 reviews", "a stale first page of reviews reads as a business that peaked years ago")
- **estimated_reach_loss**: qualitative estimate (e.g., "moderate — every comparison shopper sees the thinner profile")
- **competitive_gap**: how far behind competitors whose review velocity compounds

### 3. Pitch

Use the category intelligence block (appended below) as PRIMARY context for framing the pitch. Craft:
- **opener_hook**: 1-2 sentence opener the operator can use verbatim — specific to THIS business's review picture and category, not generic
- **pain_points**: 2-4 category-aware pain points that resonate for this business type
- **value_preview**: what a review-acceleration program unlocks — the specific value proposition

### 4. Risks

List anything that makes review growth harder than it looks:
- Owner may have tried review requests before and gotten silence
- Platform anti-solicitation rules limit what "asking" can look like
- A burst of reviews after a dry spell can read as purchased
- Negative review themes may need fixing before volume helps

### 5. Severity + Issue Type

- **severityScore** (1-10): how damaging is the review gap to customer acquisition
- **issueType**: "review_gap"`,
    archetypeBinding:
      'every entry must be a review-picture pair (volume, rating, unanswered reviews, response cadence) — even when the audit data contains a more painful off-archetype signal.',
  },
  {
    id: 'mpt-archetype-briefing-a2',
    name: 'Seek: Archetype Briefing — Negative Recovery (A2)',
    issueType: 'negative_recovery',
    extractFocus:
      'The extract carries the negative-review exposure: unanswered negative review examples with platform/rating/date/complaint, the negative themes recurring across reviews, the unanswered-negative count, the recovery-scoped gap rows, plus the internal signal and outreach ammunition the owner-facing report redacts.',
    instructions: `### 1. Scope

Identify the recovery scope from the extract and audit data:
- **summary**: 1-2 sentence plain-language summary (e.g., "Two negative Google reviews sit publicly unanswered — one about an order never ready, one about hours being wrong.")
- **affected_platforms**: which platforms carry the unanswered complaints
- **specifics**: each example's complaint, rating, and age — and whether the themes recur (a pattern is a reputation, not an incident)

### 2. Impact

Assess the business consequence of publicly unanswered complaints:
- **primary_consequence**: the main business pain (e.g., "every shopper reading reviews sees the complaint and the silence — not the resolution", "the last impression on the profile is a 1-star story with no reply")
- **estimated_reach_loss**: qualitative estimate (e.g., "concentrated — review readers are the highest-intent shoppers")
- **competitive_gap**: how competitors who answer every review convert the same browse into a visit

### 3. Pitch

Use the category intelligence block (appended below) as PRIMARY context for framing the pitch. Craft:
- **opener_hook**: 1-2 sentence opener the operator can use verbatim — name the actual complaint pattern, not "you have bad reviews"
- **pain_points**: 2-4 category-aware pain points that resonate for this business type
- **value_preview**: what professional review recovery delivers — the specific value proposition (public replies, dispute intake where warranted, a response cadence)

### 4. Risks

List anything that makes recovery harder than it looks:
- The complaint may be accurate — the fix is operational before reputational
- Some platforms don't allow owner replies on old reviews
- An argued response does more damage than silence
- Owner may not know the reviews exist

### 5. Severity + Issue Type

- **severityScore** (1-10): how damaging is the unanswered-negative exposure
- **issueType**: "negative_recovery"`,
    archetypeBinding:
      'every entry must be a negative-review pair (unanswered complaints, recurring negative themes) — even when the audit data contains a more painful off-archetype signal.',
  },
  {
    id: 'mpt-archetype-briefing-a3',
    name: 'Seek: Archetype Briefing — Listing Drift (A3)',
    issueType: 'listing_drift',
    extractFocus:
      'The extract carries the identity picture: NAP consistency status with canonical facts and per-field variations, displayed-name/address/phone on Google, per-platform claim status, the identity-scoped gap rows, plus the internal signal and outreach ammunition the owner-facing report redacts.',
    instructions: `### 1. Scope

Identify the drift's specific scope from the extract and audit data:
- **summary**: 1-2 sentence plain-language summary (e.g., "The business name appears three different ways across listings; Yelp's address conflicts with Google's.")
- **affected_platforms**: which listings carry which variation (from nap_consistency + platform_statuses)
- **specifics**: exactly what's drifted — which fields (name, address, phone, hours, photos), displayed value vs canonical value per platform. Be precise.

### 2. Impact

Assess the business consequence of inconsistent identity:
- **primary_consequence**: the main business pain (e.g., "customers calling the listed number reach a dead line", "search engines split the rankings across what look like three different businesses")
- **estimated_reach_loss**: qualitative estimate of how much discovery leaks to variants
- **competitive_gap**: how competitors with one consistent identity consolidate reviews and rankings the drifted listing splits

### 3. Pitch

Use the category intelligence block (appended below) as PRIMARY context for framing the pitch. Craft:
- **opener_hook**: 1-2 sentence opener the operator can use verbatim — name the actual variation ("Apple Maps still shows you on the old street")
- **pain_points**: 2-4 category-aware pain points that resonate for this business type
- **value_preview**: what a consistency cleanup delivers — the specific value proposition (one verified name/address/phone everywhere, unclaimed profiles claimed, missing assets filled)

### 4. Risks

List anything that makes this repair harder than it looks:
- Owner may have intentionally changed a field (track to the new value, not back to canonical)
- An old address may be a former location with residual value (redirect, not delete)
- Platform-side caching delays fixes showing up
- Postcard verification may be required (timeline delay)

### 5. Severity + Issue Type

- **severityScore** (1-10): how damaging is the identity drift to discovery and trust
- **issueType**: "listing_drift"`,
    archetypeBinding:
      'every entry must be an identity pair (name/address/phone/hours/photo consistency, unclaimed listings, displayed-vs-canonical drift) — even when the audit data contains a more painful off-archetype signal.',
  },
  {
    id: 'mpt-archetype-briefing-a4',
    name: 'Seek: Archetype Briefing — CTA & Friction Gap (A4)',
    issueType: 'cta_gap',
    extractFocus:
      `The extract carries the next-step picture: which conversion surfaces the site has and lacks (call-to-action, click-to-call, contact info, ordering/pickup/delivery/inquiry), the audit's conversion_opportunities and website issues, the conversion-scoped gap rows, plus the internal signal and outreach ammunition the owner-facing report redacts.`,
    instructions: `### 1. Scope

Identify the friction's specific scope from the extract and audit data:
- **summary**: 1-2 sentence plain-language summary (e.g., "The site loads and looks fine, but there's no way to call, order, or ask — a visitor's only move is to leave.")
- **affected_platforms**: the website itself (and any listing whose link lands on the friction)
- **specifics**: exactly which next-step surfaces are missing — CTA, tap-to-call, contact info, ordering/pickup path — grounded in the extract's flags

### 2. Impact

Assess the business consequence of a site with no next step:
- **primary_consequence**: the main business pain (e.g., "a customer ready to order hits a dead end and the next search result is one tap away", "every visitor who can't act is a walk-in that never happens")
- **estimated_reach_loss**: qualitative estimate (e.g., "total — every site visit hits the same wall")
- **competitive_gap**: how competitors whose sites ask for the order convert the same visitor

### 3. Pitch

Use the category intelligence block (appended below) as PRIMARY context for framing the pitch. Craft:
- **opener_hook**: 1-2 sentence opener the operator can use verbatim — name the missing next step, not "your website needs work"
- **pain_points**: 2-4 category-aware pain points that resonate for this business type
- **value_preview**: what closing the friction delivers — the specific value proposition (one obvious next step on every page: call, order, or directions)

### 4. Risks

List anything that makes this harder than it looks:
- The site may be platform-hosted with no edit access (fix may be a rebuild, not a tweak)
- Owner may not control the site (a nephew built it)
- Some friction is business-model-shaped — pickup-only vs delivery changes the fix

### 5. Severity + Issue Type

- **severityScore** (1-10): how damaging is the missing next step to conversion
- **issueType**: "cta_gap"`,
    archetypeBinding:
      'every entry must be a next-step pair (missing call-to-action, click-to-call, ordering, pickup, or contact path) — even when the audit data contains a more painful off-archetype signal.',
  },
  {
    id: 'mpt-archetype-briefing-a6',
    name: 'Seek: Archetype Briefing — Product Visibility (A6)',
    issueType: 'product_visibility',
    extractFocus:
      'The extract carries the shelf-visibility picture: business type, whether products are browsable online, the product categories visible, pickup/delivery surfaces, Google photo depth, the visibility-scoped gap rows, plus the internal signal and outreach ammunition the owner-facing report redacts.',
    instructions: `### 1. Scope

Identify the visibility gap's specific scope from the extract and audit data:
- **summary**: 1-2 sentence plain-language summary (e.g., "The shelves are real — halal meats, imported spices — but nothing online shows what the store actually carries.")
- **affected_platforms**: website, Google listing photos, any surface where the stock should show
- **specifics**: which visibility surfaces are missing — browsable categories, product photos, pickup/delivery clarity — grounded in the extract's flags

### 2. Impact

Assess the business consequence of invisible shelves:
- **primary_consequence**: the main business pain (e.g., "a customer who can't check whether you stock what they need picks the store they can check", "the walk-in you never got never shows up in any metric")
- **estimated_reach_loss**: qualitative estimate (e.g., "every phone-first shopper — the largest and growing share")
- **competitive_gap**: how competitors with browsable stock convert research into visits

### 3. Pitch

Use the category intelligence block (appended below) as PRIMARY context for framing the pitch. Craft:
- **opener_hook**: 1-2 sentence opener the operator can use verbatim — name what's actually on the shelves that nobody can see ("nobody searching for halal goat in Milwaukee can tell you carry it")
- **pain_points**: 2-4 category-aware pain points that resonate for this business type
- **value_preview**: what visible shelves deliver — the specific value proposition (products browsable, pickup clear, photos that show what's in stock)

### 4. Risks

List anything that makes this harder than it looks:
- Catalog depth varies — a full SKU catalog may be unrealistic; category-level visibility may be the right scope
- Photos need an owner visit or owner-supplied images
- Stock rotates — the listing must not promise what isn't there (the platform's freshness model matters)

### 5. Severity + Issue Type

- **severityScore** (1-10): how damaging is the invisible inventory to discovery and conversion
- **issueType**: "product_visibility"`,
    archetypeBinding:
      'every entry must be a shelf-visibility pair (unbrowsable products, missing categories, thin photos, unclear pickup/delivery) — even when the audit data contains a more painful off-archetype signal.',
  },
];

function bodyFor(t: ArchetypeTemplate): string {
  return `You are a local business visibility analyst producing an operator briefing for ONE routed sibling campaign — its declared archetype is {{archetype_label}} ({{archetype}}).

Your job is to read the audit data and the deterministic archetype extract, then compose an actionable briefing that helps the operator understand this archetype's scope, business impact, and how to pitch the owner on fixing it.

${t.extractFocus}

REPORT CONSISTENCY — HARD RULE: the ARCHETYPE EXTRACT below is the same evidence the owner-facing Business Visibility Report renders as this sibling's chapter. Your briefing is the operator-facing narrative OF THE SAME FACTS. You may interpret and prioritize, but you may never contradict the extract — never claim a fix for something it shows working, never present an internal signal code or score as fact to the owner, and never cite a finding that appears in neither the extract nor the audit results.

## Business

- Name: {{business_name}}
- City: {{city}}
- State: {{state}}
- Category: {{category}}

## Archetype Extract (the report chapter's evidence — authoritative)

{{archetype_extract}}

## Audit Results (full business_analysis — context)

{{audit_results}}

## Audit Signals (collapsed to triage vocabulary — internal, never recited to the owner)

{{audit_signals}}

## Instructions

Produce an operator briefing for the {{archetype_label}} archetype grounded in the extract above. Do not invent findings that are not present in the extract or audit results.

${t.instructions}

${outreachProblemsSection(t.archetypeBinding)}
The output JSON shape is appended after the category intelligence block. Return ONLY the JSON object, no markdown fences, no commentary.`;
}

async function main() {
  const service = MarketingPromptService.getInstance();
  let created = 0;
  let updated = 0;

  for (const t of TEMPLATES) {
    const payload = {
      name: t.name,
      promptType: 'seek' as const,
      scope: 'business' as const,
      category: 'profile_repair',
      body: bodyFor(t),
      variables: VARIABLES,
      outputSchema: {
        name: PROFILE_REPAIR_AUDIT_SCHEMA_NAME,
        description: `${t.name} — operator briefing for the routed sibling's declared archetype, composed from the deterministic archetype extract of the shared business_analysis audit.`,
      },
      isDefault: false,
    };

    const existing = await service.getTemplate(t.id);
    if (existing) {
      await service.updateTemplate(t.id, {
        name: payload.name,
        body: payload.body,
        variables: payload.variables,
        outputSchema: payload.outputSchema,
      });
      logger.info(`Updated archetype briefing template: ${t.id}`);
      updated++;
    } else {
      await service.createTemplate({ ...payload, id: t.id });
      logger.info(`Created archetype briefing template: ${t.id}`);
      created++;
    }
  }

  logger.info(`Seed complete: ${created} created, ${updated} updated.`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Failed to seed archetype briefing templates', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
