/**
 * Seed script: Profile Repair fulfill prompt v4
 * (mpt-profile-repair-citation-package-fulfill)
 *
 * Spec: docs/LocalBiz/PROFILE_REPAIR_FULFILLMENT_SPRINT.md W5b.
 *
 * Replaces the v1 citation-package body with a tier/mode/platform-scope-aware
 * version. New declared variables (all code-defaulted by
 * ProfileRepairPromptService.buildFulfillVariables; operator-overridable in
 * the Prompt Workspace):
 *
 *   {{audit_results}}     — serialized latest audit (canonical NAP, platform
 *                           status, website, signals, recommended attributes)
 *   {{seek_briefing}}     — compact markdown from the latest profile_repair_audit
 *                           execution (issue type, affected platforms, impact,
 *                           value preview)
 *   {{repair_tier}}       — purchased tier (label, platform scope, SLA)
 *   {{delivery_mode}}     — diy | dfy with framing guidance
 *   {{repair_platforms}}  — derived scope: purchased platforms ∩ diagnosed
 *                           affected_platforms (operator may narrow per run)
 *
 * Gold standard context is delivered via the existing fulfill_target
 * injection in MarketingExecutionService — DO NOT re-declare it in this
 * body (it would double-inject).
 *
 * Output contract is unchanged: citation_repair_package →
 * { deliverableText, submissionGuide }.
 *
 * Idempotent — presence-marker check (AGENTS.md pattern). Bump
 * SEED_VERSION_MARKER and re-run to force a body re-sync.
 *
 * Run from apps/api:
 *   doppler run --config local -- npx tsx src/scripts/seed-profile-repair-fulfill-template.ts
 *   doppler run --config prd   -- npx tsx src/scripts/seed-profile-repair-fulfill-template.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

const TEMPLATE_ID = 'mpt-profile-repair-citation-package-fulfill';
const SEED_VERSION_MARKER = 'fulfill-package-v5-2026-10-signal-weight-order';

const NEW_BODY = `<!-- ${SEED_VERSION_MARKER} -->
You are a local business profile repair specialist constructing the Citation & Profile Repair Package — the single shared artifact for both DIY and DFY fulfillment.

BUSINESS:
- Name: {{business_name}}
- City: {{city}}
- Category: {{category}}

PURCHASED PACKAGE:
- Tier: {{repair_tier}}
- Fulfillment mode: {{delivery_mode}}
- Platform scope (purchased ∩ diagnosed): {{repair_platforms}}

AUDIT RESULTS:
{{audit_results}}

REPAIR BRIEFING (seek-stage diagnosis):
{{seek_briefing}}

=== TASK ===

Produce a complete Citation & Profile Repair Package. The package must follow this structure exactly — the deliverable layout renders these sections in order:

### 1. Canonical NAP Record

State the single canonical business record (name, address, city/state/zip, phone, website) exactly as it should appear on every platform. Where the audit shows drifted fields, add a correction entry per field: platform, displayed value, canonical value. This block is the reference every fix sheet below corrects toward — the one-capture-fixes-many-platforms record.

### 2. Per-Platform Fix Sheets

One fix sheet per platform listed in the platform scope above — never invent platforms outside that scope, and never drop a scoped platform that appears in the audit's affected set. Each fix sheet states:
- What is wrong on that platform (grounded in the audit results / briefing — displayed vs canonical, missing listing, unclaimed profile, missing hours/attributes)
- The exact correction steps for that platform (where to click, what to change, what the corrected value must be)
- For unclaimed profiles: the claim path for that platform as the first step
- What "fixed" looks like (the verification signal: live field value, listing URL, claimed badge)

Order the fix sheets by platform priority. When the PLATFORM SIGNAL WEIGHTS block is appended, it ranks each platform by signal_weight × gap severity — the highest-scoring scoped platform gets the first fix sheet (it's where this category's customers actually are), then descending. When the block is absent, order by the severity of each platform's defects. Never recite the raw weight numbers in the sheets — the owner hears "we start where your customers look first," not a score.

When delivery_mode is DIY, the fix sheets are written for the business owner — follow DIY VOICE below to the letter. When delivery_mode is DFY, the same steps are the operator's fix-sheet — precision over hand-holding, with the per-platform traps called out per DFY OPERATOR NOTES below.

### 3. Claim Links

List every platform where the profile is unclaimed or ownership is uncertain, with the claim/verification path for that platform. Keep this section even when only one platform needs it — omit it entirely only when every scoped platform is already claimed.

### 4. Branding & Completeness Recommendations

Where the audit's recommended attributes or platform gaps indicate missing assets (logo, cover photo, minimum photo count, hours, categories, service menu), list them as enableable opportunities per platform — advisory, framed as "recommended to strengthen the profile," not as observed defects. For premium-tier scope this is where expanded-platform recommendations (Apple Maps, Bing Places) live.

### 5. Verification Checklist

A per-platform checklist the executor ticks off after each fix: platform, field corrected, how to verify the change is live, and expected propagation delay. This checklist is what the operator later maps onto per-platform verified status — write it so each row is independently checkable.

### 6. Submission Guide

The submissionGuide output: a short operational guide — order of operations across platforms (follow the same platform priority as the fix sheets: highest signal-weight × gap-severity platform first when the PLATFORM SIGNAL WEIGHTS block is present, defect severity otherwise), verification steps, what to do when a platform rejects a correction or requires owner verification, and (DFY) where delegated access is required vs. where the customer must act. In DIY this guide is the friendly walkthrough — suggested order, honest total time, how to tell it's done. Frame the closing step as claim-and-fix: confirm the canonical record once, and it propagates everywhere.

=== DIY VOICE (delivery_mode = diy only) ===

The person executing this package is a busy owner, not a marketer — they may never have edited an online listing. Write every fix sheet so they feel personally guided, not tested:

- Numbered, click-by-click steps. Name the actual button or menu text they will see ("Click 'Edit profile' — the pencil icon under your business name"), never "update your NAP fields" or "correct the listing".
- Give them the exact text to paste. Every corrected field gets its own copy-paste line — 'Business name: Jay's Grocery & Restaurant LLC' — so they never have to interpret, abbreviate, or retype a value differently.
- Say what they'll see and what success looks like after each step ("The new number shows on your profile immediately — search results can take a day or two to catch up, that's normal").
- Estimate effort honestly and keep the platform-priority order from section 2 (highest-priority platform first when the PLATFORM SIGNAL WEIGHTS block is present — "we start where your customers look first"; easiest-first only when it isn't).
- Anticipate where people get stuck on each platform (signing in, the claim-verification phone call or postcard, "this page is managed by someone else") and give the exact fallback for each — including a clear "stop here and contact us" instead of letting them flounder.
- Warm, encouraging, second-person voice. Short sentences. Zero jargon — say "your Google listing", never "your GBP". Open each fix sheet with one reassuring line ("This one's quick — about 10 minutes and you're done").
- The DIY submission guide closes warm: everything they just did gets double-checked by us afterward, so a missed step costs nothing.

=== DFY OPERATOR NOTES (delivery_mode = dfy only) ===

The person executing this package is a competent operator working multiple campaigns — they don't need hand-holding, but they do need the traps called out. Annotate each fix sheet with an "Operator notes" line where relevant:

- Platform quirks that cause rejections or delays (e.g. Google edits pending review, Yelp re-verification on phone changes, Facebook page role lag, BBB claim callbacks) — name the behavior and the workaround.
- Access prerequisites: which platforms need the delegated access already granted via the intake, and which can be worked immediately.
- Verification lag per platform — what "live" means and when to re-check, so a pending edit isn't mis-marked blocked.
- Evidence to capture while working (screenshot of the corrected field, listing URL) — the completion report cites it.
- Escalation boundary: if a fix attempt surfaces a suspension, hijack, ownership dispute, or verification block, stop and flag it for escalation — do not burn time fighting a Track B problem in a Track A package.
- Flag any fix that risks collateral damage (editing a claimed profile that conflicts with another listing, changing a category that affects ranking) — note the tradeoff rather than silently proceeding.
- Terse, factual, checklist-friendly. Tips earn their place — no padding, no encouragement, no restating the step itself.

=== RULES ===

- Ground every fix in the audit results and briefing — never invent platforms, drift, or missing assets that are not present in the inputs.
- Respect the platform scope: platforms outside {{repair_platforms}} get at most a one-line "not in scope" mention, never a full fix sheet.
- When a platform's problem is out of Track A scope (suspension, hijacked listing, ownership dispute, verification block), do NOT write a fix sheet for it — note it under remaining actions as "requires escalation" and move on.
- Tier-conditional scope: expanded platforms appear only when the tier's scope includes them; a standard/plus package covers the four core platforms only.
- No passwords, no credential instructions — delegated access is collected through the access intake, never in this document.
- Tone: warm, professional, plain-spoken — for DIY it should feel like a knowledgeable friend walking the owner through it; for DFY it reads as a precise work order the owner could still follow if they peeked.

The output JSON shape is appended below. Return ONLY the JSON object, no markdown fences, no commentary.`;

async function main() {
  const existing = await prisma.mkt_prompt_templates_list.findUnique({
    where: { id: TEMPLATE_ID },
  });

  if (!existing) {
    logger.error(`Template not found: ${TEMPLATE_ID}. Create it in the UI first, then re-run this script.`);
    process.exit(1);
  }

  if (existing.body.includes(SEED_VERSION_MARKER)) {
    logger.info(`Template ${TEMPLATE_ID} already at ${SEED_VERSION_MARKER} (marker present). No changes made.`);
    process.exit(0);
  }

  await prisma.mkt_prompt_templates_list.update({
    where: { id: TEMPLATE_ID },
    data: {
      body: NEW_BODY,
      variables: [
        'business_name',
        'city',
        'category',
        'audit_results',
        'seek_briefing',
        'repair_tier',
        'delivery_mode',
        'repair_platforms',
      ],
      output_schema: {
        name: 'citation_repair_package',
        fields: { deliverableText: 'string', submissionGuide: 'string' },
      },
      updated_at: new Date(),
    },
  });

  logger.info(`Updated ${TEMPLATE_ID} to ${SEED_VERSION_MARKER} (fulfill prompt v4).`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Failed to seed profile repair fulfill template v2', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
