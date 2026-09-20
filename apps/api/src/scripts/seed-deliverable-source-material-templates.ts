/**
 * Seed script: Deliverable Source Material prompt templates
 *
 * Seeds 7 templates (spec §6.1):
 *   - mpt-review-intake                  (seek)   review_intake              §5.7
 *   - mpt-deliverable-source-material    (seek)   deliverable_source_material §5.1
 *   - mpt-seed-fulfill-004..008          (fulfill) raw_json                  §5.2
 *
 * Idempotent — deterministic IDs, update-in-place. Bump SEED_VERSION_MARKER
 * to force a body re-sync on already-seeded rows.
 *
 * Tone directives are imported from report-directives.ts (single definition —
 * no drift). See spec §5.4.
 *
 * Usage (run from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-deliverable-source-material-templates.ts
 *   doppler run --config prd   -- npx tsx src/scripts/seed-deliverable-source-material-templates.ts
 *
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import {
  DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE,
  DELIVERABLE_FULFILL_TONE_DIRECTIVE,
} from '../services/intelligence/report-directives';
import {
  DELIVERABLE_SOURCE_MATERIAL_SCHEMA_NAME,
  REVIEW_INTAKE_SCHEMA_NAME,
} from '../validators/market-analysis.schema';

const SEED_VERSION_MARKER = '<!-- DELIVERABLE_SOURCE_MATERIAL_SEED_V3 -->';

const RAW_JSON = { name: 'raw_json' };

interface SeedTemplate {
  id: string;
  name: string;
  promptType: 'seek' | 'fulfill';
  category: string;
  body: string;
  variables: string[];
  outputSchema: { name: string } | null;
  isDefault: boolean;
}

const REVIEW_INTAKE_BODY = `${SEED_VERSION_MARKER}
You are structuring raw customer reviews pasted by an operator so they can be used
to build a business's review-response and testimonial deliverables.

Business: {{business_name}} — a {{category}} business in {{city}}

Raw reviews (pasted verbatim from the source; may be messy, numbered, or partially
formatted):
{{raw_reviews}}

TASK
Parse each review into a structured row and classify it.

RULES
- Preserve the review text verbatim — do not paraphrase, correct, or summarize. Trim
  trailing whitespace only.
- Infer platform (google | yelp | facebook | other), rating (1-5 or null), date
  (ISO or null), and author (name or null) where the pasted text shows them. If a
  field is not present, use null — do not guess.
- sentiment: positive (4-5), neutral (3), negative (1-2); null when rating is unknown.
- is_negative_first: true for exactly the most severe negative review (lowest rating,
  most recent as tiebreak); false otherwise.
- answered: true if the pasted text includes an existing owner response; carry that
  response text in owner_response.
- testimonials: select reviews with sentiment = positive and a substantive quote
  (>= 12 words). Quote verbatim; never fabricate.
- Return the JSON object only — no preamble, no markdown fences.

${DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE}`;

const SOURCE_MATERIAL_BODY = `${SEED_VERSION_MARKER}
You are assembling the source material for a small business's marketing deliverables.
You are given the business audit and the canonical signal set extracted from it.
Your job is to produce the raw material each deliverable type needs — NOT the finished
deliverable copy.

Business: {{business_name}}
City: {{city}}
Category: {{category}}

Signals detected (canonical set):
{{detected_signals}}

Audit results:
{{audit_results}}

Already sent to the owner — do NOT reuse this phrasing or rhetorical structure:
{{prior_outreach}}

Parsed review intake (verbatim reviews already structured by the operator; may be empty):
{{review_intake}}

TASK
For each deliverable type whose governing signal is present in the signal set above,
populate its source block in deliverable_sources. For every other type, set the
block to null.

Signal -> deliverable type:
- review_responses          <- RA_UNADDRESSED_NEGATIVE_BACKLOG, RA_UNADDRESSED_POSITIVE_BACKLOG, RA_REVIEW_DROUGHT, RA_LOW_REVIEW_VOLUME
- service_menu              <- DS_MISSING_SERVICE_MENU, WC_MISSING_SERVICE_PAGES
- gbp_audit                 <- DS_CLAIMED_STATUS, DS_PHOTO_DEFICIT, DS_OUTDATED_HOURS, DS_OUTDATED_HOLIDAY_HOURS, DS_MISSING_PROFILE
- testimonial_cards         <- RA_UNADDRESSED_POSITIVE_BACKLOG, VP_MISSING_STOREFRONT_PHOTOS, VP_MISSING_PROJECT_PHOTOS
- nap_report                <- CP_NAP_NAME_DRIFT, CP_NAP_ADDRESS_DRIFT, CP_NAP_PHONE_DRIFT, WC_URL_MISMATCH, DS_BROKEN_PROFILE_LINK
- seo_content               <- WC_MISSING_SERVICE_PAGES, WC_MISSING_WEBSITE, DS_MISSING_SERVICE_MENU
- lead_magnet               <- WC_MISSING_CTA, WC_MOBILE_FRICTION, RA_LOW_REVIEW_VOLUME
- product_visibility_preview <- DS_MISSING_PRODUCT_CATALOG, WC_MISSING_PRODUCT_BROWSING, WC_MISSING_AVAILABILITY_INQUIRY, WC_MISSING_PICKUP_DELIVERY

RULES
- Ground every field in the supplied audit results or parsed review intake. Do not
  invent services, reviews, testimonials, NAP values, or product categories.
- Absence is not a negative. If a field is unavailable, mark it null — do not fabricate.
- For review_responses, copy the unanswered reviews from the parsed review intake
  verbatim. Include ONLY unanswered reviews.
- For testimonial_cards, copy the verbatim quotes from the parsed review intake.
- Do not reuse the phrasing or rhetorical structure of any line in prior_outreach —
  the owner has already seen it. No two source blocks may open with the same sentence
  pattern.
- Echo the signal set you actually used in signals_consumed.
- Return the JSON object only — no preamble, no markdown fences.

${DELIVERABLE_SOURCE_MATERIAL_TONE_DIRECTIVE}`;

const FULFILL_TONE = `Tone: ${DELIVERABLE_FULFILL_TONE_DIRECTIVE}`;

// Claim-and-fix closing CTA (spec §5.6). `claim_cta` is a single resolved
// variable (link present, or a link-less variant when no claim path resolves),
// so the body never renders a literal {{claim_url}}.
const CLAIM_CTA = `Close with the claim-and-fix CTA, using the supplied text verbatim:
"{{claim_cta}}"`;

const FULFILL_004 = `${SEED_VERSION_MARKER}
You are producing ready-to-publish testimonial cards for {{business_name}}, a
{{category}} business in {{city}}.

Testimonials (verbatim quotes):
{{testimonials}}

TASK
Produce one card per testimonial. Each card: the verbatim quote (trimmed to <= 40
words without altering meaning), an attribution line (author + platform + rating),
and a one-line business tagline.

RULES
- Never invent quotes or attribution. Use only the supplied testimonials.
- Keep the quote's wording intact — trim only.
- Output JSON: { "cards": [{ "quote", "attribution", "tagline" }] }

${CLAIM_CTA}

${FULFILL_TONE}`;

const FULFILL_005 = `${SEED_VERSION_MARKER}
You are producing a per-platform NAP consistency report for {{business_name}}, a
{{category}} business in {{city}}.

NAP status:
{{nap_status}}

TASK
Header: the canonical record (name/address/phone). Then one row per platform:
platform, observed values, status (consistent | drift | missing | unverified), and
the exact correction to apply. Close with a prioritized correction checklist
(highest-impact first).

RULES
- Ground every row in the supplied NAP status. Mark unobserved platforms unverified.
- Do not invent addresses, phones, or platform listings.
- Output JSON: { "canonical", "platform_rows": [...], "corrections": [...] }

${CLAIM_CTA}

${FULFILL_TONE}`;

const FULFILL_006 = `${SEED_VERSION_MARKER}
You are producing an SEO content pack for {{business_name}}, a {{category}} business
in {{city}}.

Service page briefs:
{{service_pages}}

Public narrative (if supplied):
{{public_narrative}}

TASK
For each supplied service page brief, write a ready-to-publish page: H1, meta title
(<= 60 chars), meta description (<= 155 chars), a 150-250 word body grounded in the
supplied differentiators and local context, and 3 internal-link suggestions.

RULES
- Ground claims in the brief. No keyword stuffing, no superlatives, no hype.
- Output JSON: { "pages": [...] }

${CLAIM_CTA}

${FULFILL_TONE}`;

const FULFILL_007 = `${SEED_VERSION_MARKER}
You are producing a lead magnet for {{business_name}}, a {{category}} business in
{{city}}.

Offer:
{{offer}}

TASK
Produce a one-page lead magnet for the supplied offer: title, a 2-sentence promise,
a short intake/checklist section that addresses each friction point, and a clear CTA
with contact details.

RULES
- Ground the offer in the supplied source. Do not invent fees or guarantees.
- Output JSON: { "title", "promise", "sections": [...], "cta" }

${CLAIM_CTA}

${FULFILL_TONE}`;

const FULFILL_008 = `${SEED_VERSION_MARKER}
You are producing a product-visibility preview for {{business_name}}, a {{category}}
business in {{city}}.

Product-visibility gaps:
{{product_visibility}}

TASK
Produce the product-visibility preview sections: mobile catalog structure, GBP photo
shot list + captions, availability-inquiry flow, pickup/delivery pathway, and an
hours/holiday-hours sync plan — each grounded in the supplied gaps.

RULES
- Ground every section in the supplied gaps. Do not invent inventory or capabilities.
- Output JSON: { "sections": [{ "title", "content" }] }

${CLAIM_CTA}

${FULFILL_TONE}`;

const SEED_TEMPLATES: SeedTemplate[] = [
  {
    id: 'mpt-review-intake',
    name: 'Seek: Review Intake',
    promptType: 'seek',
    category: 'Deliverables',
    body: REVIEW_INTAKE_BODY,
    variables: ['business_name', 'category', 'city', 'raw_reviews'],
    outputSchema: { name: REVIEW_INTAKE_SCHEMA_NAME },
    isDefault: false,
  },
  {
    id: 'mpt-deliverable-source-material',
    name: 'Seek: Deliverable Source Material',
    promptType: 'seek',
    category: 'Deliverables',
    body: SOURCE_MATERIAL_BODY,
    variables: ['business_name', 'city', 'category', 'detected_signals', 'audit_results', 'prior_outreach', 'review_intake'],
    outputSchema: { name: DELIVERABLE_SOURCE_MATERIAL_SCHEMA_NAME },
    isDefault: false,
  },
  { id: 'mpt-seed-fulfill-004', name: 'Fulfill: Testimonial Cards', promptType: 'fulfill', category: 'Deliverables', body: FULFILL_004, variables: ['business_name', 'category', 'city', 'testimonials', 'claim_cta'], outputSchema: RAW_JSON, isDefault: false },
  { id: 'mpt-seed-fulfill-005', name: 'Fulfill: NAP Consistency Report', promptType: 'fulfill', category: 'Deliverables', body: FULFILL_005, variables: ['business_name', 'category', 'city', 'nap_status', 'claim_cta'], outputSchema: RAW_JSON, isDefault: false },
  { id: 'mpt-seed-fulfill-006', name: 'Fulfill: SEO Content Pack', promptType: 'fulfill', category: 'Deliverables', body: FULFILL_006, variables: ['business_name', 'category', 'city', 'service_pages', 'public_narrative', 'claim_cta'], outputSchema: RAW_JSON, isDefault: false },
  { id: 'mpt-seed-fulfill-007', name: 'Fulfill: Lead Magnet', promptType: 'fulfill', category: 'Deliverables', body: FULFILL_007, variables: ['business_name', 'category', 'city', 'offer', 'claim_cta'], outputSchema: RAW_JSON, isDefault: false },
  { id: 'mpt-seed-fulfill-008', name: 'Fulfill: Product Visibility Preview', promptType: 'fulfill', category: 'Deliverables', body: FULFILL_008, variables: ['business_name', 'category', 'city', 'product_visibility', 'claim_cta'], outputSchema: RAW_JSON, isDefault: false },
];

async function main() {
  const service = MarketingPromptService.getInstance();
  const prisma = (service as any).prisma;
  let created = 0;
  let updated = 0;

  for (const template of SEED_TEMPLATES) {
    try {
      const existing = await prisma.mkt_prompt_templates_list.findUnique({ where: { id: template.id } });
      const data = {
        name: template.name,
        prompt_type: template.promptType,
        category: template.category,
        body: template.body,
        variables: template.variables,
        output_schema: template.outputSchema,
        is_active: true,
        is_default: template.isDefault,
        updated_at: new Date(),
      };

      if (existing) {
        await prisma.mkt_prompt_templates_list.update({ where: { id: template.id }, data });
        updated++;
        logger.info(`Updated template: ${template.name}`);
      } else {
        await prisma.mkt_prompt_templates_list.create({
          data: { id: template.id, ...data, created_by: 'system' },
        });
        created++;
        logger.info(`Created template: ${template.name}`);
      }
    } catch (err) {
      logger.error(`Failed to seed template: ${template.name}`, undefined, {
        error: err instanceof Error ? { message: err.message } : String(err),
      });
    }
  }

  logger.info(`Seed complete: ${created} created, ${updated} updated`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
