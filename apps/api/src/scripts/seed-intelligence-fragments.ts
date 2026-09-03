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
(high / medium / low / hold). "hold" = insufficient evidence to recommend.

=== DISCOVERY SCOPE ===
Discover ALL qualifying businesses in the target market — do not impose a fixed
candidate cap. A thorough category audit for a city may surface 10, 20, or more
qualifying businesses depending on market density. Do not stop at an arbitrary
number like 5. Exhaust the discovery patterns in the Category Intelligence
Profile and the sources you can access before finalizing the qualifying set.
Every qualifying business is a potential prospect — omitting one because you
reached a self-imposed limit loses a real opportunity.`,
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
the businesses most likely to benefit from a Business Audit and outreach.

=== EMERGING IS THE OPPOSITE OF COMPETITIVE ===
This is NOT a market-leader, competitor, or benchmark scan. Do not optimize for
businesses with the strongest digital presence, highest review counts, most press,
most complete profiles, or broadest visibility. Those belong in COMPETITIVE focus.

For an EMERGING scan:
- Prioritize businesses with little, fragmented, stale, miscategorized, or
  social-only/directory-only visibility, even when community trust is strong.
- A business must have at least one evidence-backed emerging condition to be a
  primary emerging prospect: thin footprint, weak mainstream indexing, single
  source, hidden trust, recent establishment, or category misalignment.
- Do not promote an established, highly visible category leader into the emerging
  prospect set merely because it is easy to find or has strong benchmark scores.
- If an established business is useful for identity or category verification, keep
  it as reference context only and set business_seek_recommended to false; do not
  use it to fill an emerging prospect quota.
- If no emerging businesses can be verified, return fewer candidates rather than
  padding the result with competitive leaders. Never invent or infer emerging
  deficiencies from unavailable evidence.

=== GOLD STANDARD USE IN EMERGING DISCOVERY ===
For EMERGING focus, the gold standard is an opportunity-gap reference, not a
qualification filter and not a competitive ranking.

A poor rating or failed gate against the gold standard is a positive prospect
indicator when the business otherwise fits the category and market. Missing
website, incomplete profiles, sparse photos or reviews, weak category labeling,
NAP drift, and limited platform coverage may indicate fixable visibility
opportunities.

Do not disqualify or deprioritize an emerging business because it performs poorly
against the gold standard. Do not require gold-standard match for
business_seek_recommended = true. Use gold-standard gaps to explain why the
business may benefit from Business Audit and outreach.

Gold-standard weakness must still be based only on observed evidence. Do not
convert unavailable information into a failed gate. A category-fit failure,
identity conflict, or unresolved current-business-status conflict may still
require hold status independently of gold-standard performance.

Do not select established, highly visible leaders merely because they match the
gold standard. In EMERGING focus, strong gold-standard performance is not the
selection objective.

=== EMERGING × PROFILE INTEGRATION ===
Apply each emerging-focus point above USING the Category Intelligence Profile
that preceded this block. The profile is not category-neutral context — it is
the concrete mechanism set for emerging discovery in THIS category. Integrate:

- DEEP / LONG-TAIL SEARCH → use the profile's discovery_patterns as the concrete
  long-tail mechanism list. For this category, long-tail search means the
  specific vertical sources, supplier lists, community directories, social-first
  searches, and marketplace catalog searches named in the profile — not just
  "go deeper in Google." Execute the profile's named patterns, not a generic
  long-tail heuristic.

- THIN-FOOTPRINT / SOCIAL-ONLY / SINGLE-PLATFORM → tag with INT_LOW_VISIBILITY,
  INT_WEAK_MAINSTREAM_INDEXING, and INT_SINGLE_SOURCE as defined in the profile's
  signal list. The profile's evidence rules (e.g. absence_handling,
  prospect_quality) govern how thin footprint is interpreted — absence of a
  website or GBP is recorded as "not found," never converted into a negative
  signal.

- HIDDEN TRUST → use INT_HIDDEN_TRUST per the profile's hidden_trust evidence
  rule. For this category, hidden trust lives in the specific community sources,
  social recommendations, marketplace ratings, and niche directories named in
  the profile — not in a generic "high ratings" heuristic. Surface the profile's
  named vertical sources as the place to find hidden trust.

- VERTICAL / COMMUNITY DISCOVERY → use INT_VERTICAL_SOURCE_DISCOVERY when a
  business is materially discovered through any of the profile's specialized
  sources (supplier lists, community/diaspora directories, SNAP data, culturally
  specific marketplace sources). This signal is the emerging-discovery backbone
  for categories whose businesses are systematically absent from mainstream
  indexes — prioritize it.

- POSSIBLE CATEGORY MISALIGNMENT → use INT_POSSIBLE_CATEGORY_MISALIGNMENT per the
  profile's possible_category_misalignment rule. The profile names the specific
  generic/misleading category labels (e.g. "Grocery Store," "International
  Grocery," "Halal Market") that obscure specialization in THIS category —
  recover those businesses using the profile's generic_category_handling rule,
  not a generic "look for mislabels" heuristic.

- IDENTITY CORROBORATION → for thinly indexed emerging prospects, apply the
  profile's identity_resolution pattern and INT_MULTISOURCE_IDENTITY rule. The
  profile names the specific independent ecosystems whose alignment establishes
  identity for THIS category — use them as the corroboration source set.

EMERGING PRIORITY: When the profile contains discovery patterns or evidence rules
that are inherently emerging-discovery mechanisms (vertical source discovery,
community directories, supplier lists, social-first search, marketplace catalogs,
hidden trust, absence handling, prospect quality), treat them as the PRIMARY
discovery path for this run — not as optional supplements to mainstream search.
Mainstream sources remain in scope, but the emerging focus means the vertical and
community sources in the profile lead, and mainstream sources corroborate.

Do NOT compute competitive benchmarks, review-velocity comparisons, or market
leaderboard metrics — those are competitive-focus work. Emerging focus is
discovery-only: find the thin-footprint, hidden-trust, single-platform,
misaligned, and recently-established businesses the profile's source set is
designed to surface.`,
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
(they already have strong digital presence). They are context for the emerging set.

=== COMPETITIVE × PROFILE INTEGRATION ===
Apply each competitive-focus point above USING the Category Intelligence Profile
that preceded this block. The profile is not category-neutral context — it
defines what "established" and "leader" concretely mean for THIS category.
Integrate:

- MARKET LEADERS / ESTABLISHED COMPETITORS → identify leaders using the profile's
  category_fit and category_qualification evidence rules. A business only counts
  as a competitive benchmark for THIS category if it meets the profile's
  qualification criteria — not merely "has high reviews." Apply the profile's
  category_specialization rule: a leader must demonstrate the coherent
  specialization the profile defines, not just a generic high-visibility listing.

- CATEGORY BENCHMARKS → use the profile's terminology and synonyms to recognize
  the full set of competitive businesses. Leaders may operate under name variants
  or nationality-specific labels the profile lists — a competitive scan that
  misses those variants is incomplete. Use the profile's name_variant_search
  pattern to surface the complete competitive set.

- COMPETITIVE POSITIONING → assess positioning using the profile's evidence rules.
  Note that the profile's prohibited_inferences still apply in competitive mode:
  do NOT infer revenue, customer volume, or business quality from review count,
  store size, or marketplace presence. Competitive positioning describes digital
  presence and engagement patterns, not business health.

- SOURCE USAGE → for competitive focus, mainstream sources (Google, GBP, Yelp,
  Facebook) lead because competitive benchmarks are by definition
  mainstream-visible. The profile's vertical sources (supplier lists, community
  directories, SNAP) remain available but are SECONDARY for competitive work —
  they help confirm category_fit and specialization, not discover hidden leaders.

COMPETITIVE PRIORITY: When the profile contains discovery patterns or evidence
rules that are inherently emerging-discovery mechanisms (vertical source
discovery, community directories, supplier lists, hidden trust, absence
handling), treat them as CORROBORATION for competitive work, not as the primary
discovery path. Competitive focus means mainstream-visible leaders lead, and
the profile's category-specific evidence rules govern whether a high-visibility
business actually qualifies as a category benchmark versus a generic
high-visibility business that does not meet the profile's specialization bar.

Do NOT compute the emerging prospect set in this run — thin-footprint,
hidden-trust, and single-platform discovery are emerging-focus work. Competitive
focus is benchmarking-only: find the established, mainstream-visible,
category-qualified leaders that set the standard the emerging prospects will
later be measured against.`,
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
