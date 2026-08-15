/**
 * Seed script: Intelligence Scope Prompt Fragments
 *
 * Seeds the composition fragments for the Intelligence scope (Option A —
 * runtime fragment composition, GAP-P1). Fragments are templates with
 * prompt_type = 'fragment' and a fragment_kind that identifies their role.
 *
 * The composer service assembles: base + extension + profile block + focus.
 * These fragments are the base, extension, and focus modifiers. The profile
 * block is rendered dynamically from mkt_intelligence_profiles (not stored
 * as a fragment).
 *
 * Idempotent — uses deterministic IDs so re-running updates in place.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-intelligence-fragments.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';

const FRAGMENTS = [
  {
    id: 'mpt-frag-cat-base-001',
    name: 'Fragment: Seek Category Base',
    promptType: 'fragment' as const,
    scope: 'intelligence' as const,
    fragmentKind: 'seek_category_base',
    body: `You are a local market research analyst performing a category audit.

CATEGORY: {{category}}
CITY: {{city}}
STATE: {{state}}
{{#if zip_codes}}ZIP CODES: {{zip_codes}}{{/if}}
{{#if search_radius_miles}}SEARCH RADIUS: {{search_radius_miles}} miles{{/if}}

=== CATEGORY DEFINITION ===
Define the category precisely — what businesses qualify, what subcategories exist,
and what the typical business model looks like (service vs product vs hybrid).

=== GEOGRAPHIC CLASSIFICATION ===
Classify each discovered business by location relative to the target city:
- inside_city: physically located within the city limits
- adjacent_city: located in an immediately adjacent city/town
- metro_area: located in the broader metro area but not in or adjacent to the target city
- outside_market: located outside the relevant market area — EXCLUDE from final qualifying set

=== OWNERSHIP EXCLUSION ===
Exclude from the qualifying set:
- national_chain: businesses with nationwide presence (e.g. Midas, Meineke)
- national_franchise: nationally franchised locations with centralized marketing
- regional_chain: multi-state regional chains (3+ locations across state lines)
Include: independent, local_chain (2-5 locations in one metro), franchise (local owner, single or few locations), unknown.

=== DEDUP AND IDENTITY ===
Deduplicate by business name + city. If the same business appears under multiple
names or platforms, consolidate to the primary listing. Record identity confidence:
- high: name + address + phone all consistent
- medium: name consistent, some address/phone variation
- low: name-only verification, conflicting details

=== EVIDENCE SAFETY ===
Do NOT convert unavailable information into a negative signal. "Website not found
during discovery" is not the same as "no website exists." Record what you found
and what you could not verify as separate observations. Never infer a deficiency
from absence of evidence.

=== BUSINESS-AUDIT ROUTING ===
For each qualifying business, assess whether it warrants a full business audit.
Provide a recommended_for_business_audit[] list with business_seek_priority
(high / medium / low / hold). "hold" = insufficient evidence to recommend.`,
    variables: ['category', 'city', 'state', 'zip_codes', 'search_radius_miles'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-frag-intel-ext-001',
    name: 'Fragment: Intelligence Extension',
    promptType: 'fragment' as const,
    scope: 'intelligence' as const,
    fragmentKind: 'seek_intelligence_extension',
    body: `=== INTELLIGENCE AMPLIFICATION ===
This is an Intelligence-scope discovery audit, not a Business Audit. The goal is
to DISCOVER qualifying businesses and route them to Business Seek — not to perform
the business audit itself.

Discovery discipline:
1. Focus on finding businesses that fit the category and geographic criteria.
2. For each business, record discovery signals (INT_* family) — NOT business audit
   signals (RA/DS/WC/CP/VP). The INT family is separate and must never be mixed
   with Business Audit signal families.
3. Record discovery provenance for each candidate: which sources surfaced it,
   what role each source played, and what evidence types were found.
4. Assess category_fit: verified / probable / insufficient.
5. Assess business_seek_priority: high / medium / low / hold.
   - hold = identity_confidence conflict OR category_fit = insufficient
6. Do NOT compute benchmarks, tiers, fees, or audit-adjacent metrics — those are
   Business Audit scope. Intelligence scope is discovery-only.

=== DISCOVERY SIGNALS (INT_ family) ===
Use these signal codes in discovery_signals[]:
- INT_LOW_VISIBILITY: thin online footprint, hard to find via mainstream search
- INT_WEAK_MAINSTREAM_INDEXING: present but poorly indexed by Google/mainstream
- INT_SINGLE_SOURCE: found on only one platform/source
- INT_HIDDEN_TRUST: strong trust signals (reviews, reputation) but low visibility
- INT_RECENT_BUSINESS_EVIDENCE: recently established (new listing, new reviews)
- INT_POSSIBLE_CATEGORY_MISALIGNMENT: may be miscategorized or mislabeled
- INT_VERTICAL_SOURCE_DISCOVERY: found via category-specific vertical source
- INT_MULTISOURCE_IDENTITY: identity confirmed across 2+ independent sources
- INT_ACTIVE_OPERATIONAL_EVIDENCE: signs of active operation (recent reviews, hours)
- INT_CATEGORY_SPECIALIZATION: strong evidence of category specialization
- INT_UNDEREXPOSED_CREDENTIAL: has credentials/certifications not surfaced online`,
    variables: [],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-frag-intel-focus-emerging-001',
    name: 'Fragment: Intelligence Focus — Emerging',
    promptType: 'fragment' as const,
    scope: 'intelligence' as const,
    fragmentKind: 'seek_intelligence_focus_emerging',
    body: `=== FOCUS: EMERGING DISCOVERY ===
Focus modifier: EMERGING

Target emerging businesses — those with thin digital footprints that represent
untapped opportunity. Specifically seek:

1. THIN-FOOTPRINT BUSINESSES: businesses with minimal online presence — no website,
   unclaimed GBP, sparse directory listings. Low visibility ≠ poor quality.

2. DEEP / LONG-TAIL SEARCH: go beyond the first page of Google. Search directories,
   vertical platforms, social media, and niche sources. Many quality businesses
   are invisible to mainstream search.

3. SOCIAL-ONLY / DIRECTORY-ONLY / SINGLE-PLATFORM: businesses that exist on only
   one platform (e.g. Facebook-only, Yelp-only, Instagram-only). These are real
   businesses with real customers that have simply not been indexed broadly.

4. HIDDEN TRUST: businesses with strong reputation signals (high ratings, loyal
   customer base) but low discoverability. These are high-value prospects.

5. RECENTLY ESTABLISHED: new businesses (new GBP listings, recent first reviews)
   that have not yet built their digital presence.

6. POSSIBLE CATEGORY MISALIGNMENT: businesses that may be miscategorized or
   mislabeled on platforms — they operate in the category but are not tagged as such.

The emerging focus builds the PROSPECT SET — businesses that need us. These are
the businesses most likely to benefit from a Business Audit and outreach.`,
    variables: ['focus'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-frag-intel-focus-competitive-001',
    name: 'Fragment: Intelligence Focus — Competitive',
    promptType: 'fragment' as const,
    scope: 'intelligence' as const,
    fragmentKind: 'seek_intelligence_focus_competitive',
    body: `=== FOCUS: COMPETITIVE BENCHMARKING ===
Focus modifier: COMPETITIVE

Target the competitive landscape — businesses with established digital footprints
that represent the benchmark for the category in this market. Specifically seek:

1. MARKET LEADERS: businesses with the strongest online presence, highest review
   counts, best ratings, most complete GBP profiles.

2. ESTABLISHED COMPETITORS: businesses with websites, claimed GBPs, active review
   responses — the businesses that prospects compare themselves against.

3. CATEGORY BENCHMARKS: identify the top performers that set the standard for
   digital presence in this category and city.

4. COMPETITIVE POSITIONING: note what makes each leader successful — review
   velocity, photo quality, posting frequency, response patterns.

The competitive focus builds the BENCHMARKING SET — who leads this market. This
context helps frame the emerging prospects' gaps relative to the competitive standard.

Note: competitive-focus businesses are generally NOT prospects for outreach
(they already have strong digital presence). They are context for the emerging set.`,
    variables: ['focus'],
    outputSchema: null,
    isDefault: false,
  },
  {
    id: 'mpt-frag-intel-generic-fallback-001',
    name: 'Fragment: Intelligence Generic Fallback',
    promptType: 'fragment' as const,
    scope: 'intelligence' as const,
    fragmentKind: 'seek_intelligence_generic_fallback',
    body: `=== INTELLIGENCE MODE: GENERIC FALLBACK ===
No category intelligence profile is active for this category. Using generic
discovery with mainstream sources only.

Disclosure: The output must include intelligence_mode: "generic_fallback" to
indicate that no category-specific intelligence was applied. Discovery will use
general-purpose sources (Google, GBP, Yelp, Facebook) without category-specific
specialized sources, terminology, or evidence rules.

Operators should consider establishing a category intelligence profile for this
category to improve discovery quality.`,
    variables: [],
    outputSchema: null,
    isDefault: false,
  },
];

async function main() {
  const service = MarketingPromptService.getInstance();

  for (const frag of FRAGMENTS) {
    // Check if the fragment already exists (idempotent upsert)
    const existing = await service.getTemplate(frag.id);
    if (existing) {
      // Update in place — fragments are versioned like templates
      await service.updateTemplate(frag.id, {
        name: frag.name,
        body: frag.body,
        variables: frag.variables,
        outputSchema: frag.outputSchema,
        fragmentKind: frag.fragmentKind,
      });
      logger.info(`Updated fragment: ${frag.id} (${frag.fragmentKind})`, undefined, { id: frag.id });
    } else {
      await service.createTemplate({
        id: frag.id,
        name: frag.name,
        promptType: frag.promptType,
        scope: frag.scope,
        body: frag.body,
        variables: frag.variables,
        outputSchema: frag.outputSchema,
        isDefault: frag.isDefault,
        fragmentKind: frag.fragmentKind,
      });
      logger.info(`Created fragment: ${frag.id} (${frag.fragmentKind})`, undefined, { id: frag.id });
    }
  }

  logger.info('Intelligence fragment seeding complete', undefined, { count: FRAGMENTS.length });
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});
