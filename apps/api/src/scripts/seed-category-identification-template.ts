/**
 * Seed script: Business Category Identification Seek Template
 *
 * Seeds the "Seek: Business Category Identification" prompt template. This
 * template takes a business name + location (NO category input) and identifies
 * which niche category the business belongs to, producing ranked candidate
 * categories with confidence scores.
 *
 * The output_schema is category_identification so imported results are
 * validated against the category-identification schema and create an audit
 * with platform='category_identification'. The CategoryIdentificationAuditCard
 * renders the result in the campaign's Audits tab with per-candidate-category
 * action buttons (queue / verify / spawn campaign).
 *
 * Idempotent — uses a deterministic ID so re-running updates in place.
 *
 * Usage (from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-category-identification-template.ts
 *   doppler run --config prd -- npx tsx src/scripts/seed-category-identification-template.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import { CATEGORY_IDENTIFICATION_SCHEMA_NAME } from '../validators/category-identification.schema';

const TEMPLATE = {
  id: 'mpt-seed-category-identification-001',
  name: 'Seek: Business Category Identification',
  promptType: 'seek' as const,
  scope: 'business' as const,
  body: `You are a local business categorization analyst. Your task is to identify the correct niche category for a business when the operator cannot determine it.

Business: {{business_name}}
City: {{city}}
State: {{state}}

=== TASK ===
Research the business using publicly available sources (Google Business Profile, Yelp, Facebook, BBB, website, social media) and determine which niche category this business belongs to.

The goal is to identify the SINGLE best-fit category label that would be used in a business-scope marketing campaign. This is not a broad industry classification — it is the specific niche label (e.g., "Auto Repair Shop", "Transmission Repair", "African Grocery Store", "Pediatric Dentistry").

=== KNOWN CATEGORIES ===
The platform maintains a vocabulary of known categories. Where possible, match the business to an existing known category label. If no known category fits, propose a new label — the operator can register it with one click.

=== DIRECTORY HOSTING CONTEXT ===
A category label is not a positioning statement — it becomes a public directory page that hosts every similar business in the market. Evaluate every candidate as a directory shelf:
1. Population test: the label should naturally host multiple businesses in the same city/market — the identified business plus its actual peers. When research surfaces peer businesses, name them in the candidate's reasoning as the hosting population. If the local population would be only the identified business, go one level broader.
2. No bespoke labels: never invent compound or hybrid labels tailored to one business (e.g., "Middle Eastern Restaurant & Market") and never narrow to a label only this business could fill (e.g., "Turkish Grocery Store" when it is the city's only Turkish market). Be as specific as possible while the shelf still holds more than one business.
3. Hybrid businesses: classify by dominant customer intent / revenue line (a market with a lunch counter is a grocery, not a "restaurant & market"). Express the secondary facet as its own candidate category instead of fusing both into one label.
4. Search-intent alignment: prefer labels a customer would type or browse ("middle eastern grocery", "halal market", "auto repair"), not marketing phrasing.

=== CATEGORY IDENTIFICATION RULES ===
1. Consult at least 2 independent sources before assigning a category.
2. Record the specific evidence (GBP primary category, Yelp category, website meta description, etc.) that supports each candidate.
3. Rank candidates by confidence:
   - high: multiple sources agree on the category label
   - medium: sources agree on the general category but differ on specificity
   - low: conflicting or thin evidence; category is a best guess
4. If the business is a subcategory of a broader category (e.g., "Transmission Repair" is a subcategory of "Auto Repair"), list both — the specific subcategory first, the broader category as an alternative. Specific beats broad only while the specific label still plausibly hosts multiple businesses in the market (see DIRECTORY HOSTING CONTEXT); otherwise rank the population-bearing broader label first.
5. Classify the business type: "service" (sells labor/expertise), "product" (sells physical inventory), "hybrid" (both significantly), or "unable_to_verify".
6. Do NOT invent a category that has no evidence. If you cannot determine the category, set confidence to "low" and explain what evidence is missing.

=== EVIDENCE SAFETY ===
Do NOT convert unavailable information into a negative signal. "Website not found" does not mean "no website exists." Record what you found and what you could not verify as separate observations.

=== BUSINESS SUMMARY (required) ===
Write a 2-4 sentence operator-facing summary of the business's digital footprint based on your cross-platform research. This gives the operator richer context for the business without running a full business audit. Include:
* What the business does (category, specialization, format)
* Where it is located (neighborhood, corridor, city)
* Digital presence highlights (GBP status, website, review volume, social media)
* Any notable signature products, services, or community role verified during research

=== PUBLIC NARRATIVE (required) ===
Write a factual, public-safe, SEO-rich description of the business for the \`public_narrative\` field. This text will appear on a public directory listing page that visitors and the business owner will see, and it is the primary long-tail SEO surface for unclaimed listings.

Include:
* What the business is (category, format, specialization — use the specific category label, not a generic one)
* Where it is located (neighborhood, corridor, district, city — use geo-modified phrasing a searcher would use)
* What it is known for (signature products, services, dishes, or community role — name the specific items verified in the audit, not generic categories)
* Community, cultural, or ownership context when verifiable
* Services offered when verified

Exclude (these are internal assessment content — never public):
* Digital Opportunity Score, tier classifications, or alignment labels
* Review response rates, unanswered review counts, or deficiency language
* Recommended services, pricing, or upsell language
* Competitive benchmark comparisons
* Any language that could embarrass the business owner or signal weakness

Length: 2-4 sentences, 300-600 characters. Write in third person. Be specific and vivid. Do not invent details; use only verified public information.

=== DIGITAL FOOTPRINT (required) ===
Capture a structured snapshot of what you found across platforms in the \`digital_footprint\` block:
* platforms_found: each platform you consulted (google, yelp, facebook, bbb, etc.) with URL, claimed status, rating, review count, and notes
* website_url + website_status: the business website if found (working / broken / none_found / unable_to_verify)
* social_profiles: any social media profiles found
* gbp_primary_category: the Google Business Profile primary category label (often the strongest category signal)
* signature_products_services: specific product or service names verified during research (e.g., "frozen cassava leaves", "transmission rebuild", "pediatric cleanings")

=== NAP (required) ===
Extract the canonical Name / Address / Phone / Website for the business from your cross-platform research and return it in the \`nap\` block. This data is used to automatically populate the business campaign's contact fields, so accuracy matters.

Rules:
* Use the most authoritative source available (GBP > official website > Yelp > other directories).
* Set each field to null if you could not verify it from a public source — do NOT guess or fabricate.
* canonical_name: the business's formal public name (from GBP or website, not a shortened nickname).
* address_line1 / address_line2 / city / state / postal_code / country_code: the structured street address. Use address_line2 for suite/unit numbers only.
* phone: the public-facing phone number (prefer GBP displayed phone).
* website: the canonical website URL (prefer the official domain, not a directory link).
* directory_profile_urls: URLs for each platform profile found (GBP, Yelp, Facebook, BBB, etc.).
* field_confidence: for each NAP field you populated, record the confidence level and the source you used:
  - high: verified from 2+ independent sources or the authoritative primary source (GBP/website)
  - medium: found on a single reputable source but not cross-verified
  - low: inferred or uncertain (e.g., partial address, outdated listing)
* provenance: a short note on the primary source of the NAP (e.g., "GBP + official website cross-verified").

=== OUTPUT ===
Return JSON matching the category_identification schema. The candidate_categories array must contain at least one entry. The primary_category must match the highest-confidence candidate. business_summary, public_narrative, digital_footprint, and nap are required.`,
  variables: ['business_name', 'city', 'state'],
  outputSchema: {
    name: CATEGORY_IDENTIFICATION_SCHEMA_NAME,
    description: 'Business category identification — takes a business name + location (no category input) and returns ranked candidate categories with confidence scores, business type classification, evidence sources, and reasoning. Used when the operator cannot determine the correct niche category for a business.',
  },
  isDefault: false,
};

async function main() {
  const service = MarketingPromptService.getInstance();

  const existing = await service.getTemplate(TEMPLATE.id);
  if (existing) {
    await service.updateTemplate(TEMPLATE.id, {
      name: TEMPLATE.name,
      body: TEMPLATE.body,
      variables: TEMPLATE.variables,
      outputSchema: TEMPLATE.outputSchema,
    });
    logger.info(`Updated category identification template: ${TEMPLATE.id}`, undefined, { id: TEMPLATE.id });
  } else {
    await service.createTemplate({
      id: TEMPLATE.id,
      name: TEMPLATE.name,
      promptType: TEMPLATE.promptType,
      scope: TEMPLATE.scope,
      body: TEMPLATE.body,
      variables: TEMPLATE.variables,
      outputSchema: TEMPLATE.outputSchema,
      isDefault: TEMPLATE.isDefault,
    } as any);
    logger.info(`Created category identification template: ${TEMPLATE.id}`, undefined, { id: TEMPLATE.id });
  }

  logger.info('Category identification template seeded successfully', undefined, { id: TEMPLATE.id });
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});
