/**
 * Seed script: Intelligence Profile Establishment Template (GAP-P8)
 *
 * Seeds the dedicated prompt template that instructs an external AI to
 * produce a §10 Category Intelligence Profile JSON for a given category.
 * The operator runs this prompt in an external AI, then imports the result
 * via /executions/external — the result is validated against the
 * intelligence_profile schema and persisted as a DRAFT profile.
 *
 * The template uses the 'intelligence' scope and has
 * output_schema = { name: 'intelligence_profile' }.
 *
 * Idempotent — uses a deterministic ID so re-running updates in place.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-intelligence-profile-establishment-template.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';
import { INTELLIGENCE_PROFILE_SCHEMA_NAME } from '../validators/intelligence-profile.schema';

/**
 * Bump on every body change so re-runs are auditable in logs. The body also
 * carries this marker as a trailing HTML comment (repo convention) so the
 * rendered prompt records which revision produced a given profile.
 *
 * 2026-09-16-diaspora-discovery: endonym synonyms, address-indexed datasets,
 * hosted storefront platforms as a first-class source class, query-shape family
 * (incl. site-scoped sweeps), corridor derivation from evidence, and the
 * required coverage self-test.
 *
 * 2026-09-18-geography-substrate: adds the REQUIRED, category-independent
 * discovery substrate (geography_grid / generic_label_set /
 * label_independent_sweeps), coverage self-test classes (6) and (7), and the
 * hard rule that label-independent sweeps must be geography-keyed, never
 * name-token-keyed. Fixes the "name does not self-identify with the category"
 * blind spot for every category (African Grocery, Asian Grocery, Middle Eastern
 * Grocery, Beauty Supply, …), not just the one that surfaced it.
 *
 * 2026-09-18-metro-catchment: sharpens the geography_grid instruction for the
 * SCALE PATH (markets with no ZIPs at deployment time): scope is the RETAIL
 * CATCHMENT, not the administrative city — the principal city plus contiguous
 * commercial suburbs, including separately-incorporated municipalities that
 * share ZIPs with it (the shared-ZIP suburb class, e.g. Gladstone, MO / 64118).
 * Adds adjacent_municipalities to geography_grid.
 */
const SEED_VERSION_MARKER = 'intel-profile-establishment-2026-09-18-metro-catchment';

const ESTABLISHMENT_TEMPLATE = {
  id: 'mpt-seed-intel-profile-establishment-001',
  name: 'Seek: Intelligence Profile Establishment',
  promptType: 'seek' as const,
  scope: 'intelligence' as const,
  body: `You are a category intelligence analyst. Your task is to establish a Category Intelligence Profile for the following category.

CATEGORY: {{category}}
CITY (reference market): {{city}}
STATE: {{state}}
PLATFORM: {{platform}}

=== OBJECTIVE ===
Produce a comprehensive Category Intelligence Profile that describes how to discover businesses in this category and what evidence ecosystems matter when auditing a business in this category.

The profile will be used to:
1. Guide Intelligence-scope discovery audits (finding qualifying businesses)
2. Amplify Business-scope audit prompts with category-specific evidence rules

=== PLATFORM SCOPING ===
{{platform}} is the platform this profile is scoped to. If the platform is "all"
or empty, produce a cross-platform profile — the discovery patterns and
specialized sources should work across all major platforms (Google, Yelp,
Facebook, Apple Maps, Bing). If a specific platform is named, bias the
discovery patterns toward that platform:

- DISCOVERY PATTERNS: include platform-specific search strategies that surface
  businesses on {{platform}} that mainstream search misses. For example, on
  Google: search GBP category taxonomies for miscategorized businesses (e.g.,
  "International Grocery" instead of "African Goods Store"), search Google
  Maps for unmarked storefronts along commercial corridors, search for
  platform-specific longtail queries (e.g., "fufu powder site:google.com/maps"
  or "egusi near me" on {{platform}}). Name the concrete platform-specific
  search strategies, not generic "search the platform" instructions.
- SPECIALIZED SOURCES: when a platform is specified, include platform-specific
  sources (e.g., GBP category taxonomy, {{platform}} review ecosystems,
  platform-specific directory features) alongside the category's vertical and
  community sources. The platform sources help the discovery analyst find
  businesses that are present but miscategorized, or absent entirely, on the
  target platform.
- CATEGORY EVIDENCE RULES: include platform-specific evidence rules that
  distinguish "not found on {{platform}} during discovery" from "does not exist
  on {{platform}}" — a business may be active on other platforms but absent
  from {{platform}}, and that absence is a discovery signal, not a negative
  quality signal.

Do NOT produce a platform-agnostic profile when a specific platform is named:
the operator will run a separate establishment campaign for each platform they
want a profile for, because a profile established for one platform's discovery
is not safe to apply to a different platform's discovery campaign (the category
taxonomy, search mechanics, and directory features will not match).

=== CITY SCOPING ===
This profile is scoped to the reference market named above ({{city}}). The
specialized sources, discovery patterns, supplier retailer lists, community
networks, and business examples you produce should be concrete and actionable
for THIS city — name the actual suppliers, diaspora organizations, commercial
corridors, and community directories that operate in {{city}} and its metro
area. Do NOT produce a city-agnostic profile: the operator will run a separate
establishment campaign for each city they want a profile for, because a
profile established for one city's market is not safe to apply to a different
city's discovery campaign (the supplier lists, community sources, and business
examples will not match).

When naming sources, prefer concrete {{city}}-specific examples over generic
descriptions. For example, instead of "African-food supplier retailer lists",
name the actual supplier(s) serving {{city}} and the retailers they list.
Instead of "community directories", name the actual diaspora organizations
and international-business networks active in {{city}}.

Derive commercial corridors from EVIDENCE, not assumption. Once you have
identified two or three businesses in this category in {{city}}, cluster their
street addresses to find where the category actually concentrates, and name
those corridors. State which corridor you would have assumed and why the
evidence corrects it. Do not list the city's well-known retail districts unless
you can tie category businesses to them — the category's real corridor is often
an industrial or arterial stretch that no general city guide mentions.

=== PROFILE SECTIONS ===

1. TERMINOLOGY — Define the key terms used in this category. What do practitioners call their work? What terms would a customer use? What industry-specific vocabulary matters?

2. SYNONYMS — List alternative names for this category (what people search for when looking for this type of business). Include BOTH classes:
   (a) ENGLISH CATEGORY TERMS — the label shoppers and mainstream directories use.
   (b) ENDONYMS AND DIASPORA-LANGUAGE TOKENS — the words the community itself uses for the category and for itself. These are the highest-yield discovery tokens and are usually absent from English-language directory taxonomies. Examples across categories: "habesha" (Ethiopian/Eritrean), "supermarché" (Francophone West African), "tienda" and "bodega" (Latin American), "desi" and "kirana" (South Asian), "halal market" and "souk" (Middle Eastern), "toko" (Indonesian).
   Label each synonym as an English term or an endonym. A synonym list containing only English category words is incomplete and will miss businesses whose names are transliterations or personal names.

3. SUBCATEGORIES — Identify the major subcategories within this category. Not all businesses in the category do the same thing — what are the specializations?

4. SPECIALIZED SOURCES — This is the most important section. Identify the category-specific sources that are useful for discovering and verifying businesses in this category. For each source:
   - Name: the source name
   - Type: service_history | certification | professional_network | mainstream_directory | vertical_directory | social_platform | other
   - URL: the source's canonical web address (homepage, directory index, organization page, or store locator). Vertical directories, community organizations, professional networks, and official brand/chain websites should ALWAYS carry a URL — it is the operator's entry point to the source. Omit the URL only for sources that have no single canonical web address (e.g. "storefront photo evidence", "SNAP listings" as a class).
   - Priority: 1 (highest) to 5 (lowest)
   - Capabilities: what this source CAN tell you (list at least one)
   - Limitations: what this source CANNOT tell you or what it does NOT measure (list at least one)

   CRITICAL: Limitations are as important as capabilities. A source's limitations define what inferences must NOT be made from its data. For example, "CARFAX service history is NOT a review system" is a limitation that prevents conflating service records with customer reviews.

   Also look for DATASETS INDEXED TO THE BUSINESS ADDRESS. These are often the highest-signal sources for categories with import supply chains, regulated goods, or licensed premises, and they surface businesses that appear in no commercial directory at all. Dataset classes to consider:
   - Import / customs bill-of-lading records (importer of record, supplier country, and the exact product line imported)
   - State business-entity registries (legal name, formation date, principal office address)
   - Health department food-establishment licensing and inspection records
   - Benefit-program retailer authorization lists (e.g. SNAP/EBT authorized retailers)
   - Licensed-goods permit registries (liquor, tobacco, pharmacy, halal or kosher certification)
   Name the concrete dataset that exists for this category and market, with its URL, capabilities, AND limitations. A registration is not evidence of trading; an authorization is not a quality signal; a permit is not a review.

   Also treat HOSTED STOREFRONT PLATFORMS as a source class in their own right — not merely as a search trick. Small independent retailers in this category disproportionately adopt low-cost storefront hosts (Square Online, Wix, Shopify, GoDaddy, Weebly, WordPress.com) because they bundle point-of-sale with a simple online catalog, and the resulting subdomains stay publicly indexed even when the business's platform category is generic or wrong. Give this class its own source entry, naming the concrete hosts that matter in this market, and carry these limitations with it:
   - Presence proves the operator adopted a storefront tool, NOT that the business is trading, licensed, or accepting orders. Hosted pages frequently display "not currently accepting online orders", and a storefront can outlive a closed business or precede an opening.
   - The sweep surfaces only operators who adopted that host, so it carries selection bias toward slightly more digitized businesses. Absence from the sweep means nothing.
   - Hosted pages are typically client-side rendered, so a search-index hit proves the URL exists, not that it renders for an ordinary visitor.

4b. DISCOVERY SUBSTRATE (REQUIRED — CATEGORY-INDEPENDENT) — This section must NOT depend on the category's name, vocabulary, or tokens. It is the enumeration floor that surfaces businesses whose names do NOT self-identify with the category (e.g. "Universal Tropical Market" for an African grocery, "A-1 Market" for an Asian grocery, "Sunny Beauty" for a beauty-supply store). Produce three structured fields:
   - geography_grid — the sweep units for this market, independent of category: { "city", "state", "zips": [every ZIP the market's commercial addresses fall in], "corridors": [arterial commercial stretches, derived from address evidence where possible], "adjacent_municipalities": [separately-incorporated suburbs / contiguous commercial municipalities in the catchment], "radius_miles" }. SCOPE IS THE RETAIL CATCHMENT, NOT THE ADMINISTRATIVE CITY: the principal city PLUS its contiguous commercial suburbs, including separately-incorporated municipalities that share ZIPs with the principal city (e.g. a suburb like Gladstone, MO sharing 64118 with Kansas City). List EVERY ZIP the catchment's commercial addresses fall in — not only the ZIPs where category businesses were already found, and not only the principal city's administrative ZIPs. Name the shared-ZIP suburbs explicitly in adjacent_municipalities; a ZIP spanning the principal city and a suburb is ONE sweep unit. The grid is the exhaustive enumeration unit: every ZIP must be swept, and a ZIP with zero findings must be reported as an executed-empty result, never silently skipped.
   - generic_label_set — the platform labels that SWALLOW this category: the generic buckets a mislabeled business sits under. One entry per platform: { "platform", "labels": [...] }. This is category-specific in content but universal in class — for ANY category, name the generic labels that hide it (e.g. "Grocery store", "Convenience store", "Supermarket" for a specialty grocer; "Beauty supply", "Cosmetics", "Variety store" for a specialty beauty retailer; "International grocery", "Halal market", "Mediterranean market" for specialty food retailers). Do NOT list the correct category label — that is the label the business is MISSING.
   - label_independent_sweeps — the address-indexed datasets to sweep WITHOUT a category name token. One entry per dataset: { "dataset", "url", "sweep_key": "geography", "filter": "none", "post_filter": "assortment" }. The sweep_key MUST be "geography": these datasets are enumerated by ZIP/address and filtered to category fit by assortment evidence AFTER enumeration. Never keyed by the category name.

   A profile whose only discovery paths are keyed on the category's own tokens is incomplete. The substrate is what makes discovery category-independent.

   HARD RULE — LABEL-INDEPENDENT SWEEPS MUST BE GEOGRAPHY-KEYED. When you name an address-indexed dataset (state registry, benefit-program authorization, licensing, permit registries), specify that it is swept by GEOGRAPHY (ZIP/address) and filtered to category fit afterward. Do NOT implement it as a name-token query. Token-keying a label-independent dataset makes it label-dependent and defeats its purpose: a business whose legal name carries no category token will be invisible to it.

5. DISCOVERY PATTERNS — How should an analyst search for businesses in this category? What vertical directories, professional networks, or niche platforms should be searched? What search strategies surface businesses that are invisible to mainstream search? Provide at least one concrete pattern for EACH of these query shapes, with real examples for this category and {{city}}:
   (a) CATEGORY-TAXONOMY queries — the platform's own category labels, including the wrong or generic labels a mis-categorized business would sit under.
   (b) NAME-TOKEN queries — business names built from endonyms, transliterations, personal names, or place names. These carry no English category word and are invisible to category-name searches.
   (c) PRODUCT long-tail queries — the specific goods a customer would type.
   (d) SITE-SCOPED sweeps — restrict a search engine to a hosting platform or directory domain to enumerate an entire population at once (e.g. site:square.site, site:myshopify.com, site:wixsite.com, site:godaddysites.com, site:weebly.com, site:wordpress.com). These are cheap and high-yield, and they surface businesses whose platform category is generic or wrong. Treat the host list as illustrative and verify a host is still live before sweeping — hosted-site platforms are discontinued and rebranded regularly, so a dead host wastes the whole pattern.
   (e) GEOGRAPHIC cluster queries — derive corridors from the addresses of already-found businesses rather than assuming them.
   (f) COMMUNITY / REFERRAL queries — the places the community recommends businesses to each other.

6. CATEGORY EVIDENCE RULES — What evidence indicates that a business is active, qualified, and a good prospect? What evidence is meaningful for this category specifically (as opposed to generic digital-presence signals)?

7. PROHIBITED INFERENCES — List at least one inference that must NOT be made for this category. These are inferences that seem reasonable but are actually incorrect or misleading. For example:
   - "Absence from [source] does NOT mean the business is inactive"
   - "[Source] record count ≠ total customers served"
   - "No website does NOT mean no customers"
   - "Low [platform] review count does NOT mean few customers"

8. CATEGORY SIGNALS — List the INT_* signal codes that are most relevant to this category. Use the canonical INT_ family:
   INT_LOW_VISIBILITY, INT_WEAK_MAINSTREAM_INDEXING, INT_SINGLE_SOURCE, INT_HIDDEN_TRUST, INT_RECENT_BUSINESS_EVIDENCE, INT_POSSIBLE_CATEGORY_MISALIGNMENT, INT_VERTICAL_SOURCE_DISCOVERY, INT_MULTISOURCE_IDENTITY, INT_ACTIVE_OPERATIONAL_EVIDENCE, INT_CATEGORY_SPECIALIZATION, INT_UNDEREXPOSED_CREDENTIAL

=== EVIDENCE SAFETY ===
Do NOT convert unavailable information into a negative signal. "Website not found during discovery" is not the same as "no website exists." Record what you found and what you could not verify as separate observations. The prohibited_inferences section is where you document inferences that must not be made from absence of evidence.

=== COVERAGE SELF-TEST (REQUIRED) ===
Before finalizing, audit your own pattern set for blind spots. For each class below, confirm that at least one of your discovery patterns would surface it. If a class is uncovered, add or fix a pattern until it is covered.
  (1) A business whose platform category is generic or wrong (e.g. "Convenience store", "Grocery store", "Restaurant") while its actual specialization appears only in its description, photos, or import records.
  (2) A business whose name contains no English category word — an endonym, transliteration, personal name, or place name.
  (3) A business with no website and no claimed profile on any platform.
  (4) A business whose storefront is not on any corridor you listed.
  (5) A business that is well known in its community but has no customer reviews.
  (6) A business whose name contains NO category token and NO endonym — a generic-looking name that does not self-identify with the category (e.g. "Universal Tropical Market" for an African grocery, "A-1 Market" for an Asian grocery, "Sunny Beauty" for a beauty-supply store). Confirm a pattern surfaces it WITHOUT relying on the name.
  (7) A business reachable ONLY by sweeping a ZIP × generic-label matrix or an address-indexed dataset by geography — i.e. it is invisible to every name, endonym, and product query.
Record the result in discovery_patterns under the key "coverage_self_test", stating for each class which pattern covers it — or that it is uncovered. A pattern set that can only find businesses that already look like the category is not finished.

=== OUTPUT REQUIREMENT ===
Respond with a SINGLE JSON object only. Do NOT wrap it in markdown code fences. Do NOT include prose before or after the JSON. Do NOT include commentary. The JSON object must match the structure described in the EXPECTED OUTPUT FORMAT section below.
<!-- seed-version: intel-profile-establishment-2026-09-18-metro-catchment -->`,
  variables: ['category', 'city', 'state', 'platform'],
  outputSchema: {
    name: INTELLIGENCE_PROFILE_SCHEMA_NAME,
    description: 'Category Intelligence Profile — §10 structure with terminology, specialized sources (capabilities + limitations), the category-independent discovery substrate (geography_grid / generic_label_set / label_independent_sweeps), discovery patterns, evidence rules, prohibited inferences, and category signals.',
  },
  isDefault: false,
  intelligenceCampaignKind: 'establishment' as const,
};

async function main() {
  const service = MarketingPromptService.getInstance();

  const existing = await service.getTemplate(ESTABLISHMENT_TEMPLATE.id);
  if (existing) {
    await service.updateTemplate(ESTABLISHMENT_TEMPLATE.id, {
      name: ESTABLISHMENT_TEMPLATE.name,
      body: ESTABLISHMENT_TEMPLATE.body,
      variables: ESTABLISHMENT_TEMPLATE.variables,
      outputSchema: ESTABLISHMENT_TEMPLATE.outputSchema,
      intelligenceCampaignKind: ESTABLISHMENT_TEMPLATE.intelligenceCampaignKind,
    });
    logger.info(`Updated establishment template: ${ESTABLISHMENT_TEMPLATE.id}`, undefined, { id: ESTABLISHMENT_TEMPLATE.id, seedVersion: SEED_VERSION_MARKER });
  } else {
    await service.createTemplate({
      id: ESTABLISHMENT_TEMPLATE.id,
      name: ESTABLISHMENT_TEMPLATE.name,
      promptType: ESTABLISHMENT_TEMPLATE.promptType,
      scope: ESTABLISHMENT_TEMPLATE.scope,
      body: ESTABLISHMENT_TEMPLATE.body,
      variables: ESTABLISHMENT_TEMPLATE.variables,
      outputSchema: ESTABLISHMENT_TEMPLATE.outputSchema,
      isDefault: ESTABLISHMENT_TEMPLATE.isDefault,
      intelligenceCampaignKind: ESTABLISHMENT_TEMPLATE.intelligenceCampaignKind,
    });
    logger.info(`Created establishment template: ${ESTABLISHMENT_TEMPLATE.id}`, undefined, { id: ESTABLISHMENT_TEMPLATE.id, seedVersion: SEED_VERSION_MARKER });
  }
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});
