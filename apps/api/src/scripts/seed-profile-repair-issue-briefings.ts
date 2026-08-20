/**
 * Seed script: Update the 3 per-issue profile repair seek prompt bodies
 *
 * Aligns the NAP Drift, Unclaimed Profile, and Platform Gap seek prompts to
 * the same operator-briefing focus as the triage prompt (seed-profile-repair-triage-briefing.ts).
 *
 * Each prompt now:
 *   - Uses {{audit_results}} as a PRIMARY input (the actual audit data showing
 *     which platforms have what) — previously only injected audit_signals
 *     (collapsed vocab terms), so the AI was working blind.
 *   - Uses the category intelligence block (appended by the amplification path)
 *     as PRIMARY context for the pitch angle.
 *   - Produces an aligned repair briefing: scope, impact, pitch, risks.
 *
 * Idempotent — detects whether the new body is already present (by marker)
 * and skips if so. Safe to re-run.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-profile-repair-issue-briefings.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

const BRIEFING_MARKER = 'ISSUE-SPECIFIC REPAIR BRIEFING — PRIMARY OUTPUT';

interface IssueTemplate {
  id: string;
  issueType: string;
  issueLabel: string;
  body: string;
}

const TEMPLATES: IssueTemplate[] = [
  {
    id: 'mpt-profile-repair-nap-drift-seek',
    issueType: 'nap_drift',
    issueLabel: 'NAP Drift',
    body: `You are a local business profile repair analyst producing an issue-specific repair briefing for NAP (Name, Address, Phone) drift.

Your job is to read the audit data and category intelligence, then produce an actionable briefing that helps the operator understand the NAP drift's scope, business impact, and how to pitch the owner on fixing it.

## Business

- Name: {{business_name}}
- City: {{city}}
- State: {{state}}
- Category: {{category}}

## Audit Results

{{audit_results}}

## Audit Signals (collapsed to triage vocabulary)

{{audit_signals}}

## Instructions

Produce an issue-specific repair briefing grounded in the audit data above. Do not invent platform names, drift details, or missing assets that are not present in the audit results.

### 1. Scope

Identify the NAP drift's specific scope from the audit data:
- **summary**: 1-2 sentence plain-language summary (e.g., "Google and Yelp show a stale phone number; Apple Maps has the old business name.")
- **affected_platforms**: which platforms show inconsistent NAP (from the Platform Status section of audit_results)
- **specifics**: exactly what's drifted — which fields (name, address, phone), displayed value vs canonical value per platform. Be precise: "Google shows phone (816) 555-1234 but canonical is (816) 555-9999" not "phone is wrong."

### 2. Impact

Assess the business consequence of the NAP drift:
- **primary_consequence**: the main business pain (e.g., "customers are calling the wrong number and reaching a disconnected line", "navigation apps route to the old address")
- **estimated_reach_loss**: qualitative estimate of how many searchers are affected (e.g., "moderate — affects Apple Maps and Bing users, ~15-20% of local search traffic")
- **competitive_gap**: how far behind competitors whose NAP is consistent (e.g., "competitors with consistent NAP appear in more local pack results")

### 3. Pitch

Use the category intelligence block (appended below) as PRIMARY context for framing the pitch. The category intelligence tells you how this business type typically operates and what matters to its customers. Use it to craft:
- **opener_hook**: 1-2 sentence opener the operator can use verbatim. Must be specific to NAP drift for this business and category, not generic. (e.g., for an African Grocery Store: "When customers search for fufu and egusi on their iPhone, Apple Maps sends them to your old location — you're losing walk-ins to the international market down the street.")
- **pain_points**: 2-4 category-aware pain points that resonate for this business type
- **value_preview**: what the Citation & Profile Repair Package will fix — the specific value proposition (e.g., "We'll correct your name, address, and phone across Google, Apple, Bing, and Yelp so customers reach you every time.")

### 4. Risks

List anything that makes this repair harder than it looks:
- Owner may have intentionally changed the phone number (track to new number, not back to canonical)
- Old address may be a former location with residual SEO value (redirect, not delete)
- Platform-side caching may delay fixes showing up
- Postcard verification may be required for address changes (timeline delay)

### 5. Severity + Issue Type

- **severityScore** (1-10): how damaging is this NAP drift to local search visibility and customer acquisition
- **issueType**: "nap_drift"

The output JSON shape is appended after the category intelligence block. Return ONLY the JSON object, no markdown fences, no commentary.`,
  },
  {
    id: 'mpt-profile-repair-unclaimed-seek',
    issueType: 'unclaimed_profile',
    issueLabel: 'Unclaimed Profile',
    body: `You are a local business profile repair analyst producing an issue-specific repair briefing for an unclaimed Google Business Profile.

Your job is to read the audit data and category intelligence, then produce an actionable briefing that helps the operator understand the unclaimed profile's scope, business impact, and how to pitch the owner on claiming it.

## Business

- Name: {{business_name}}
- City: {{city}}
- State: {{state}}
- Category: {{category}}

## Audit Results

{{audit_results}}

## Audit Signals (collapsed to triage vocabulary)

{{audit_signals}}

## Instructions

Produce an issue-specific repair briefing grounded in the audit data above. Do not invent platform details or missed features that are not supported by the audit results.

### 1. Scope

Identify the unclaimed profile's specific scope:
- **summary**: 1-2 sentence plain-language summary (e.g., "The Google Business Profile exists but is unclaimed — the owner has no access to manage it.")
- **affected_platforms**: which platforms have unclaimed profiles (Google, Bing, Apple Maps, etc. — from audit_results)
- **specifics**: what's missing because the profile is unclaimed — no owner posts, no Q&A responses, no messaging, no insights/analytics, no photo management, no service menu editing. List the specific features unavailable.

### 2. Impact

Assess the business consequence of the unclaimed profile:
- **primary_consequence**: the main business pain (e.g., "the owner can't respond to reviews or post updates, so the profile looks abandoned to customers", "competitors with claimed profiles appear more active and trustworthy")
- **estimated_reach_loss**: qualitative estimate of engagement loss (e.g., "moderate — unclaimed profiles get fewer interactions and appear less prominently in local pack")
- **competitive_gap**: how far behind competitors who have claimed and actively manage their profiles

### 3. Pitch

Use the category intelligence block (appended below) as PRIMARY context for framing the pitch. The category intelligence tells you how this business type typically operates and what matters to its customers. Use it to craft:
- **opener_hook**: 1-2 sentence opener the operator can use verbatim. Must be specific to unclaimed profiles for this business and category, not generic. (e.g., for an African Grocery Store: "Your Google profile is the only way most customers find you, but you can't post your new product arrivals or respond to the reviews asking about fufu availability — your competitors can.")
- **pain_points**: 2-4 category-aware pain points that resonate for this business type
- **value_preview**: what claiming and managing the profile will unlock — the specific value proposition (e.g., "We'll claim your Google profile so you can post product arrivals, respond to reviews, add your hours, and see how customers are finding you.")

### 4. Risks

List anything that makes this repair harder than it looks:
- Google may require postcard verification (5-14 day delay)
- An unverified previous owner or manager request may be pending
- The business may have moved, complicating the claim process
- Competitor or hijacker may attempt to claim the profile first
- Owner may lack a Google account or be uncomfortable creating one

### 5. Severity + Issue Type

- **severityScore** (1-10): how damaging is the unclaimed profile to local search visibility and customer acquisition
- **issueType**: "unclaimed_profile"

The output JSON shape is appended after the category intelligence block. Return ONLY the JSON object, no markdown fences, no commentary.`,
  },
  {
    id: 'mpt-profile-repair-platform-gap-seek',
    issueType: 'platform_gap',
    issueLabel: 'Platform Gap',
    body: `You are a local business profile repair analyst producing an issue-specific repair briefing for platform coverage gaps.

Your job is to read the audit data and category intelligence, then produce an actionable briefing that helps the operator understand which platforms the business is missing from, the business impact, and how to pitch the owner on closing the gaps.

## Business

- Name: {{business_name}}
- City: {{city}}
- State: {{state}}
- Category: {{category}}

## Audit Results

{{audit_results}}

## Audit Signals (collapsed to triage vocabulary)

{{audit_signals}}

## Instructions

Produce an issue-specific repair briefing grounded in the audit data above. Do not invent missing platforms or reach estimates that are not supported by the audit results.

### 1. Scope

Identify the platform gap's specific scope:
- **summary**: 1-2 sentence plain-language summary (e.g., "The business has no Apple Maps or Bing Places listing — iPhone and Windows users can't find it via native map apps.")
- **affected_platforms**: which platforms the business is missing from (from the Platform Status section of audit_results — e.g., Apple Maps, Bing Places, Yelp, Facebook)
- **specifics**: what each missing platform means for discovery (e.g., "Apple Maps powers Siri and iPhone navigation — 30% of local mobile searches use Apple Maps", "Bing Places feeds Bing search and Windows Maps")

### 2. Impact

Assess the business consequence of the platform gaps:
- **primary_consequence**: the main business pain (e.g., "iPhone users asking Siri for 'African grocery store near me' get directed to competitors", "Windows and Bing users never see the business")
- **estimated_reach_loss**: qualitative estimate of reach loss (e.g., "significant — missing Apple Maps alone affects ~30% of iOS users in the market")
- **competitive_gap**: how competitors with full platform coverage appear in more search contexts

### 3. Pitch

Use the category intelligence block (appended below) as PRIMARY context for framing the pitch. The category intelligence tells you how this business type typically operates, what sources matter, and what positioning challenges they face. Use it to craft:
- **opener_hook**: 1-2 sentence opener the operator can use verbatim. Must be specific to platform gaps for this business and category, not generic. (e.g., for an African Grocery Store: "When customers ask Siri on their iPhone for 'African market near me', Siri sends them to the international grocery across town — you're invisible to every Apple user in Kansas City.")
- **pain_points**: 2-4 category-aware pain points that resonate for this business type
- **value_preview**: what closing the platform gaps will fix — the specific value proposition (e.g., "We'll list you on Apple Maps, Bing Places, and Yelp so every map app and search engine can find you.")

### 4. Risks

List anything that makes this repair harder than it looks:
- Some platforms require postcard or phone verification (timeline delays)
- Platform may not support the business's specific category (category mapping needed)
- Niche/culturally specific businesses may be misclassified by platform taxonomies
- Owner may not see value in platforms they don't personally use
- Competitor saturation on secondary platforms may limit visibility gains

### 5. Severity + Issue Type

- **severityScore** (1-10): how damaging are the platform gaps to local search visibility and customer acquisition
- **issueType**: "platform_gap"

The output JSON shape is appended after the category intelligence block. Return ONLY the JSON object, no markdown fences, no commentary.`,
  },
];

async function main() {
  let updated = 0;
  let skipped = 0;

  for (const tmpl of TEMPLATES) {
    const existing = await prisma.mkt_prompt_templates_list.findUnique({
      where: { id: tmpl.id },
    });

    if (!existing) {
      logger.error(`Template not found: ${tmpl.id}. Create it in the UI first, then re-run this script.`);
      continue;
    }

    if (!existing.body.includes('## Output')) {
      logger.info(`Template ${tmpl.id} already has no embedded ## Output section (suffix handles output shape). Skipping.`);
      skipped++;
      continue;
    }

    // Inject the marker into the body so the script is idempotent on re-run.
    // Place it right after the first line (the role statement).
    const bodyWithMarker = tmpl.body.replace(
      /^(You are a local business profile repair analyst.*\n)/,
      `$1\n${BRIEFING_MARKER}\n`,
    );

    await prisma.mkt_prompt_templates_list.update({
      where: { id: tmpl.id },
      data: {
        body: bodyWithMarker,
        // Update variables metadata to include audit_results (informational only;
        // the actual injection is handled by buildSeekVariables + resolvePrompt).
        variables: ['business_name', 'city', 'state', 'category', 'audit_signals', 'audit_results'],
        updated_at: new Date(),
      },
    });

    logger.info(`Updated ${tmpl.id} body to issue-specific repair briefing format.`);
    updated++;
  }

  logger.info(`Seed complete: ${updated} updated, ${skipped} skipped.`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Failed to seed profile repair issue briefing bodies', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
