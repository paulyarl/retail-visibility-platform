/**
 * Seed script: Website Positioning Audit template (PB-08 / A7 — spec §6.2)
 *
 * Seeds ONE business-scope seek prompt template — the dedicated Website
 * Positioning Audit that PB-08-routed campaigns run after triage. It is a
 * depth-first positioning pass, distinct from the breadth-first
 * business_analysis audit: it benchmarks the business's web presence against
 * the category's gold-standard website expectations and frames every finding
 * as a conversion implication.
 *
 * The template is business-scope + seek + output_schema
 * 'website_positioning_audit', so MarketingExecutionService.resolvePrompt's
 * generic business-scope path (`promptRole === 'category_audit'`) injects the
 * Category Intelligence, Gold Standard Benchmark, and Market Context blocks
 * automatically — no per-template wiring. The interactive-verification
 * preamble and the Website Accessibility Verification ladder are inherited the
 * same way (resolvePrompt prefixes the former; the latter is instructed below).
 *
 * The render-control discipline applies: gold-standard exemplar *websites* are
 * the control set for the site itself — if the business's site fails to render
 * but an exemplar site renders, the failure is attributable (broken), not a
 * tooling limitation.
 *
 * Auto-sourced variables (MarketingExecutionService.resolvePrompt):
 *   - website_url           ← campaign.website_url
 *   - prior_website_findings ← latest business_analysis audit's `website` block
 *
 * Idempotent — deterministic ID so re-running updates in place.
 *
 * Usage (from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-website-positioning-audit-template.ts
 *   doppler run --config prd   -- npx tsx src/scripts/seed-website-positioning-audit-template.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import { WEBSITE_POSITIONING_SCHEMA_NAME } from '../validators/website-positioning.schema';

const WEBSITE_POSITIONING_TEMPLATE_ID = 'mpt-seed-website-positioning-001';

const WEBSITE_POSITIONING_BODY = `You are a website positioning analyst. Your task is to audit ONE business's
web presence and judge it against what a category-leading (gold-standard)
website for this category must contain — then frame every finding as a
conversion implication the owner will feel.

BUSINESS WEBSITE URL: {{website_url}}

PRIOR BUSINESS-AUDIT WEBSITE FINDINGS (from the breadth audit — treat as
leads to verify, not as conclusions):
{{prior_website_findings}}

=== PLATFORM GOAL: THE DIGITAL SHELF ===
VisibleShelf exists to make the PHYSICAL SHELVES of independent brick-and-mortar
retailers visible to customers who walk through the door. For a storefront
business, the website is the digital extension of that shelf: customers browse
online and buy at the counter — the site is never a shipping operation. Frame
every conversion implication in that model: each gap is a customer who would
have walked in, lost before they left the house.

=== OBJECTIVE ===
Produce a Website Positioning Audit for this business. You are NOT re-running
the four-platform breadth audit — that already happened. You are judging the
website specifically: what state is it in, what does the category expect, and
what is each gap costing the business in lost customers.

=== CATEGORY INTELLIGENCE — BINDING ===
A CATEGORY INTELLIGENCE block is appended to this prompt after these
instructions. Apply its terminology, evidence rules, and PROHIBITED
INFERENCES verbatim. If it is missing, proceed with general reasoning and note
the absence in data_quality.limitations.

=== GOLD STANDARD BENCHMARK — BINDING ===
A GOLD STANDARD BENCHMARK block is appended after the Category Intelligence
block. Use its expected fields and pattern exemplars as the benchmark for
WEBSITE POSITIONING specifically: what a gold-standard {{category}} site must
contain (service pages, product browsing, booking/ordering, menus, quote
forms, category-specific trust signals) versus what this business's presence
actually does. Record every difference as a positioning_gaps[] entry with
platform "website".

=== WEBSITE ACCESSIBILITY VERIFICATION — BINDING ===
Evaluate the site on the four-state ladder and record which state you reached:
  1. discovered — the URL exists and was located
  2. reachable  — the URL resolved without an access barrier
  3. content verified — you actually read page content
  4. conversion verified — you could exercise (or observe) the primary
     customer action (book / order / quote / call)
Emit a quality judgment (WC_POOR_SITE_QUALITY, WC_STALE_WEBSITE,
WC_CATEGORY_MISMATCH, WC_LEGACY_BUILDER_SITE) ONLY when you reached
content-verified. Never emit a quality signal from unable_to_verify.

=== RENDER CONTROL — BINDING ===
Gold-standard exemplar WEBSITES are the control set for the site itself. If
this business's site fails to render but an exemplar site renders, the failure
is attributable to the business (broken), not a tooling limitation. If the
exemplar also fails, record unable_to_verify and emit no broken signal.

=== SIGNALS TO EMIT ===
Populate detected_signals with the WC_* codes that apply. Judgment-free —
emit on sight:
  - WC_THIRD_PARTY_DOMAIN: the "website" is a social/messaging/profile page
    (facebook.com, instagram.com, wa.me, x.com, tiktok.com, linktr.ee,
    yelp.com, nextdoor.com, t.me, m.me, threads.net, snapchat.com) OR the site
    status is social_media_only.
  - WC_BUILDER_SUBDOMAIN: the site is a free builder subdomain (*.wixsite.com,
    *.wordpress.com, *.godaddysites.com, *.weebly.com, *.square.site,
    *.business.site, *.blogspot.com, *.myshopify.com, *.bigcartel.com, etc.) —
    a live page, but no owned domain.
  - WC_UNSECURED_WEBSITE: the owned site serves plain HTTP or has an untrusted
    certificate.
  - WC_PARKED_DOMAIN: the domain resolves to a parked / for-sale / registrar
    placeholder page.
  - WC_UNFINISHED_SITE: a "coming soon" / under-construction / template-default
    page that was never finished.
Quality judgments (require content-verified):
  - WC_LEGACY_BUILDER_SITE: owned domain fingerprinted as a legacy/low-cost
    builder (Wix assets, wp-content, GoDaddy generator meta, visible builder
    branding, table-layout-era markup).
  - WC_STALE_WEBSITE: old copyright year, expired promos, dated news posts,
    seasonal content out of season.
  - WC_POOR_SITE_QUALITY: poorly designed / broken layout / unreadable.
  - WC_CATEGORY_MISMATCH: site content doesn't match the business's actual
    category — template leftovers, wrong-industry copy, or content for a
    different business.
  - WC_MISSING_WEBSITE / WC_BROKEN_WEBSITE per their existing definitions.
Emit ONLY the codes supported by verified evidence — never a quality code from
unable_to_verify.

=== EVERY ISSUE CARRIES A CONVERSION IMPLICATION ===
For each issue, write the consequence in the owner's language:
"customers can't browse the menu, so they call or leave", "the site shows a
2019 copyright, so customers question whether you're still open". This is the
amplification the breadth audit lacks — it is required for every issue.

=== OPERATOR OUTREACH PROBLEMS & SOLUTIONS — REQUIRED ===
Produce \`outreach_problems\` — an array of ONE to THREE (1–3) problem-and-solution
pairs the operator can use directly in outreach to the owner. Return only the
most painful web-presence problems, ranked by severity: when the audit surfaces
a single real issue, return just that one — never pad the count. Each entry
ships two spoken lines — a plain professional statement and a hook alternative —
followed by the solution. Shape:

{ "problem": "<the web gap as the owner experiences it — the business consequence>",
  "regular": "<the plain professional line that raises this problem>",
  "hook": "<the alternative line — same fact, earns attention>",
  "solution": "<high-level summary of the fix — what gets built, not a named package>",
  "evidence": "<the observed fact that grounds this problem: the URL/host/state you verified>",
  "outreach_use": "<how the operator deploys this pair — cold-call opener, email hook, objection response>" }

Rules:
* 1–3 entries — the most painful problems only, ranked by severity. One well-grounded pair beats three thin ones: if the audit surfaces a single real issue (e.g. no website, everything else clean), return just that one. Never pad the count; never restate the same gap once per signal code.
* Frame problems as business consequences ("customers looking for you find a Facebook page instead of a website"), never as technical labels ("WC_THIRD_PARTY_DOMAIN").
* Every entry carries two spoken lines: \`regular\` — the plain professional way to raise the problem — and \`hook\` — the alternative that earns attention with the same fact (a curiosity gap, a "search for yourself and see" moment). The hook must stay 100% true to the evidence: no clickbait, no invented stakes.
* Solutions must be deliverable — the operator builds or repairs the site, points the profiles at the domain, secures it. Stay high-level: summarize the fix, do not name a product.
* Ground every \`problem\` in THIS audit's findings — \`presence_classification\`, \`ownership\`, \`issues\`, \`positioning_gaps\`, and the Gold Standard benchmark. Do not invent gaps that are not present.
* Tone — warm, professional, helpful: write copy the operator can read aloud to the owner with a straight face and a smile. Never dry, never dull.

=== OUTPUT ===
Produce a SINGLE JSON object matching the schema in the EXPECTED OUTPUT FORMAT
section appended below. No markdown fences, no commentary.`;

async function main() {
  const service = MarketingPromptService.getInstance();
  const existing = await service.getTemplate(WEBSITE_POSITIONING_TEMPLATE_ID);

  const payload = {
    name: 'Seek: Website Positioning Audit',
    promptType: 'seek' as const,
    scope: 'business' as const,
    body: WEBSITE_POSITIONING_BODY,
    variables: ['website_url', 'prior_website_findings'],
    outputSchema: {
      name: WEBSITE_POSITIONING_SCHEMA_NAME,
      description:
        'Website Positioning Audit — presence classification, ownership, conversion-framed issues, positioning gaps vs. the category gold standard, and a build scope. Feeds the PB-08 FITD deliverable and A7 opener.',
    },
    isDefault: false,
  };

  if (existing) {
    await service.updateTemplate(WEBSITE_POSITIONING_TEMPLATE_ID, {
      name: payload.name,
      body: payload.body,
      variables: payload.variables,
      outputSchema: payload.outputSchema,
    });
    logger.info(`Updated website positioning template: ${WEBSITE_POSITIONING_TEMPLATE_ID}`);
  } else {
    await service.createTemplate({ ...payload, id: WEBSITE_POSITIONING_TEMPLATE_ID });
    logger.info(`Created website positioning template: ${WEBSITE_POSITIONING_TEMPLATE_ID}`);
  }
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});
