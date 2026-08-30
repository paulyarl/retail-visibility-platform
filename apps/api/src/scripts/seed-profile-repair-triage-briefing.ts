/**
 * Seed script: Update mpt-profile-repair-triage-default template body
 *
 * Replaces the signal-confirmation triage prompt with an operator-briefing
 * prompt that produces actionable intelligence (scope, viability, pitch
 * angle, risks) from the audit data + category intelligence, rather than
 * rubber-stamping the deterministic signal→track mapping.
 *
 * The track decision is retained in the output (for the confirm-button UX)
 * but is now backed by a code-side floor (resolveTrackFromSignals) that
 * validates the AI's recommendation — the AI may escalate above the rule,
 * never de-escalate below it.
 *
 * Idempotent — detects whether the new body is already present (by marker)
 * and skips if so. Safe to re-run.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-profile-repair-triage-briefing.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

const TEMPLATE_ID = 'mpt-profile-repair-triage-default';

const BRIEFING_MARKER = 'OPERATOR BRIEFING — PRIMARY OUTPUT';

const NEW_BODY = `You are a local business profile repair analyst producing an operator briefing.

Your job is NOT to classify signals — the signal→track mapping is deterministic. Your job is to read the audit data and category intelligence, then produce an actionable briefing that helps the operator understand what's broken, whether the campaign is worth pursuing, and how to pitch the owner.

## Business

- Name: {{business_name}}
- City: {{city}}
- State: {{state}}
- Category: {{category}}

## Audit Results

{{audit_results}}

## Audit Signals (collapsed to triage vocabulary)

{{audit_signals}}

## Issue Type (initial diagnosis)

{{issue_type}}

## Instructions

Produce an operator briefing with five sections. Each section must be grounded in the audit data above — do not invent platform names, drift details, or missing assets that are not present in the audit results.

### 1. Scope

Read the audit results and identify what is actually broken. Be specific:
- **summary**: 1-2 sentence plain-language summary of what's wrong (e.g., "Google and Yelp show a stale phone number; Bing listing is missing entirely.")
- **broken_platforms**: which platforms have issues (from the Platform Status section of audit_results)
- **drift_details**: specifics of what's drifted — displayed name vs canonical, phone mismatch, address mismatch, etc.
- **missing_assets**: what's absent (website, Apple Maps listing, photos, hours, category labels, etc.)

### 2. Viability

Assess whether this campaign is worth the operator's time:
- **pursuit_recommendation**: "pursue" (clear case, likely to engage), "pursue_with_caveats" (worth trying but has friction), or "low_probability" (owner unlikely to engage or issue unlikely to resolve)
- **rationale**: why — consider the business's digital maturity, the severity of the issue, and whether the fix is something the owner can self-serve or needs help with

### 3. Pitch

Use the category intelligence block (appended below) as PRIMARY context for framing the pitch. The category intelligence tells you how this business type typically operates, what sources matter, and what positioning challenges they face. Use it to craft:
- **primary_angle**: the main hook for the opener — not "your NAP is inconsistent" but the business consequence (e.g., "customers outside your community can't find you on Google Maps")
- **opener_hook**: 1-2 sentence opener the operator can use verbatim in outreach. Must be specific to this business and category, not generic.
- **pain_points**: 2-4 category-aware pain points that resonate for this business type (drawn from the category intelligence — what matters to an African Grocery Store is different from what matters to a plumbing contractor)
- **marketplace_positioning**: how this business is positioned in its market — underexposed on mainstream directories, community-reliant, competing with generic international markets, etc.

### 4. Risks

List anything that makes this campaign harder than it looks:
- Owner likely won't engage (no website, no claimed profile, minimal digital presence)
- Issue may self-resolve (transient suspension, pending verification)
- Appeal unlikely to succeed (hard suspension, policy violation)
- Category misalignment risk (business may not fit standard repair patterns)
- Competitive saturation (many similar businesses, hard to stand out)

### 5. Track Recommendation

Determine the repair track. This is a derived field — the signal→track mapping is deterministic:
- Any signal in {suspension, hijacked_listing, duplicate_listing, ownership_dispute, address_verification_block} → "escalated"
- Only {nap_drift, unclaimed_profile, missing_category, missing_hours, platform_gap} → "standard"

You MAY escalate above the rule (e.g., recommend "escalated" for a nap_drift case if the audit data reveals an underlying ownership issue). You may NOT de-escalate below the rule (a suspension signal always means "escalated").

Also provide:
- **severity_score** (1-10): how damaging is this to the business's local search visibility and customer acquisition
- **issue_type_confirmed**: the confirmed issue type (may refine the initial diagnosis based on audit data)
- **rationale**: overall reasoning for the track recommendation (kept for stage history)
- **escalation_signals**: signals that pushed toward escalated (if any)
- **standard_signals**: signals that kept it on standard (if any)

The output JSON shape is appended after the category intelligence block. Return ONLY the JSON object, no markdown fences, no commentary.`;

async function main() {
  const existing = await prisma.mkt_prompt_templates_list.findUnique({
    where: { id: TEMPLATE_ID },
  });

  if (!existing) {
    logger.error(`Template not found: ${TEMPLATE_ID}. Create it in the UI first, then re-run this script.`);
    process.exit(1);
  }

  if (existing.body.includes(BRIEFING_MARKER)) {
    logger.info(`Template ${TEMPLATE_ID} already has the operator briefing body (marker present). No changes made.`);
    process.exit(0);
  }

  const bodyWithMarker = NEW_BODY.replace(
    /^(You are a local business profile repair analyst producing an operator briefing\.\n)/,
    `$1\n${BRIEFING_MARKER}\n`,
  );

  await prisma.mkt_prompt_templates_list.update({
    where: { id: TEMPLATE_ID },
    data: {
      body: bodyWithMarker,
      updated_at: new Date(),
    },
  });

  logger.info(`Updated ${TEMPLATE_ID} body to operator-briefing format.`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Failed to seed profile repair triage briefing body', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
