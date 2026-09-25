/**
 * MarketContextBindingFormatters — Narrative-aware formatters that turn raw
 * market intelligence (from MarketContextLoader) into prompt binding blocks.
 *
 * Each formatter:
 *   1. ANNOUNCES what the intelligence is and its lineage (Stage 1 + Stage 2)
 *   2. PRESENTS each field with its meaning
 *   3. SETS EXPECTATIONS for how the analyst should use it
 *   4. DISTINGUISHES from existing inputs (intelligence profile, gold standard)
 *
 * Three formatters:
 *   - EstablishmentBindingFormatter — for gold-standard establishment scans
 *   - DiscoveryBindingFormatter — for emerging/competitive discovery scans
 *   - (AuditBindingFormatter stays in MarketingExecutionService — it has
 *     audit-specific framing and is already wired)
 *
 * Spec: docs/LocalBiz/INTELLIGENCE_CAMPAIGN_MARKET_CONTEXT_SPEC.md
 */

import type {
  MarketContext,
  CategoryIntelligence,
  LocationIntelligence,
} from './MarketContextLoader';
import { MarketContextLoader } from './MarketContextLoader';

const loader = MarketContextLoader.getInstance();

// ─── Shared helpers ─────────────────────────────────────────────────────

function formatCategoryProfileBlock(ctx: CategoryIntelligence): string[] {
  const lines: string[] = [];
  if (!ctx.category_profile) return lines;
  const p = ctx.category_profile;
  lines.push('', 'CATEGORY PROFILE (what businesses in this category look like):');
  if (p.business_model) lines.push(`  - Business model: ${p.business_model}`);
  if (p.typical_products) lines.push(`  - Typical products: ${p.typical_products}`);
  if (p.customer_base) lines.push(`  - Customer base: ${p.customer_base}`);
  if (p.online_presence_pattern) lines.push(`  - Online presence pattern: ${p.online_presence_pattern}`);
  if (p.competitive_landscape) lines.push(`  - Competitive landscape: ${p.competitive_landscape}`);
  if (p.typical_scale) lines.push(`  - Typical scale: ${p.typical_scale}`);
  return lines;
}

function formatCategoryTaxonomyBlock(ctx: CategoryIntelligence): string[] {
  const lines: string[] = [];
  const hasSuper = ctx.super_categories && ctx.super_categories.length > 0;
  const hasSub = ctx.sub_categories && ctx.sub_categories.length > 0;
  const hasAdj = ctx.adjacent_categories && ctx.adjacent_categories.length > 0;
  if (!hasSuper && !hasSub && !hasAdj) return lines;
  lines.push('', 'CATEGORY TAXONOMY (where this category sits in the hierarchy):');
  if (hasSuper) lines.push(`  - Super categories (breadcrumbs): ${ctx.super_categories!.join(' › ')}`);
  if (hasSub) lines.push(`  - Sub categories (specializations): ${ctx.sub_categories!.join(', ')}`);
  if (hasAdj) lines.push(`  - Adjacent categories (siblings): ${ctx.adjacent_categories!.join(', ')}`);
  return lines;
}

function formatCityProfileBlock(ctx: LocationIntelligence): string[] {
  const lines: string[] = [];
  if (!ctx.city_profile) return lines;
  const p = ctx.city_profile;
  lines.push('', 'CITY PROFILE (the market these businesses operate in):');
  if (p.metro_description) lines.push(`  - Metro description: ${p.metro_description}`);
  if (p.major_industries && p.major_industries.length > 0) lines.push(`  - Major industries: ${p.major_industries.join(', ')}`);
  if (p.growth_trajectory) lines.push(`  - Growth trajectory: ${p.growth_trajectory}`);
  if (p.demographic_character) lines.push(`  - Demographic character: ${p.demographic_character}`);
  if (p.market_character) lines.push(`  - Market character: ${p.market_character}`);
  return lines;
}

function formatCategorySignalsBlock(ctx: CategoryIntelligence): string[] {
  const lines: string[] = [];
  if (!ctx.category_signals || ctx.category_signals.length === 0) return lines;
  lines.push('', 'CATEGORY SIGNALS (what strong looks like in this category):');
  for (const s of ctx.category_signals) {
    lines.push(`  - ${s}`);
  }
  return lines;
}

function formatMarketDensityBlock(ctx: CategoryIntelligence): string[] {
  const lines: string[] = [];
  if (!ctx.market_density) return lines;
  lines.push('', 'MARKET DENSITY (expectation setting):');
  lines.push(`  ${ctx.market_density}`);
  return lines;
}

function formatMarketGapsBlock(ctx: LocationIntelligence): string[] {
  const lines: string[] = [];
  if (!ctx.market_gaps || ctx.market_gaps.length === 0) return lines;
  lines.push('', 'MARKET GAPS (where demand is unmet in this city):');
  for (const gap of ctx.market_gaps) {
    lines.push(`  - ${gap.category}: ${gap.signal}${gap.area ? ` (${gap.area})` : ''}`);
  }
  return lines;
}

function formatProspectSignalsBlock(ctx: CategoryIntelligence): string[] {
  const lines: string[] = [];
  if (!ctx.prospect_signals || ctx.prospect_signals.length === 0) return lines;
  lines.push('', 'PROSPECT SIGNALS (what to look for when prospecting):');
  for (const s of ctx.prospect_signals) {
    lines.push(`  - ${s}`);
  }
  return lines;
}

function formatMetroDynamicsBlock(ctx: LocationIntelligence): string[] {
  const lines: string[] = [];
  if (!ctx.metro_dynamics || ctx.metro_dynamics.length === 0) return lines;
  lines.push('', 'METRO DYNAMICS (nearby market context):');
  for (const m of ctx.metro_dynamics) {
    lines.push(`  - ${m.city}${m.state ? `, ${m.state}` : ''} (${m.relationship}): ${m.character}${m.business_scene ? ` — ${m.business_scene}` : ''}${m.notes ? ` — ${m.notes}` : ''}`);
  }
  return lines;
}

// ─── Establishment binding ────────────────────────────────────────────────

/**
 * Format market intelligence for a gold-standard establishment scan.
 *
 * The establishment scan finds best-in-class businesses for a category.
 * It needs:
 *   - category_profile (WHAT to look for)
 *   - city_profile (WHERE/HOW to look)
 *   - category_signals (HOW to evaluate candidates)
 *   - market_density (expectation setting)
 *
 * It does NOT need market_gaps or prospect_signals — those are for discovery.
 */
export function formatEstablishmentMarketContext(
  marketCtx: MarketContext,
  category: string,
  city: string,
  state: string,
): string {
  const { category: catCtx, location: locCtx } = marketCtx;
  const hasCat = loader.hasCategoryIntelligence(catCtx);
  const hasLoc = loader.hasLocationIntelligence(locCtx);
  if (!hasCat && !hasLoc) return '';

  const lines: string[] = [
    '=== MARKET CONTEXT (from prior enrichment runs) ===',
    '',
    'This scan benefits from market intelligence produced by prior PG enrichment runs:',
    '- Location enrichment (Stage 1): established the city\'s market character',
    '- Category enrichment (Stage 2): established the category\'s business model',
    '',
    'Use this intelligence to guide your candidate discovery and evaluation.',
  ];

  // Category intelligence
  const catLines: string[] = [];
  if (catCtx.category_summary) {
    catLines.push('', 'CATEGORY SUMMARY (what this category looks like in this market):');
    catLines.push(`  ${catCtx.category_summary}`);
  }
  catLines.push(...formatCategoryProfileBlock(catCtx));
  catLines.push(...formatCategoryTaxonomyBlock(catCtx));
  catLines.push(...formatCategorySignalsBlock(catCtx));
  catLines.push(...formatMarketDensityBlock(catCtx));

  if (catLines.length > 0) {
    lines.push('', '--- CATEGORY INTELLIGENCE ---');
    lines.push(...catLines);
    lines.push('', 'Use the category profile to recognize qualifying businesses — a business');
    lines.push('that matches the profile is more likely to be a strong gold-standard candidate.');
    lines.push('Use the category taxonomy to understand where this category sits in the hierarchy');
    lines.push('— super categories show the broader market, sub categories show specializations');
    lines.push('a candidate may focus on, and adjacent categories help you distinguish this');
    lines.push('category from siblings (a business matching an adjacent category is NOT a');
    lines.push('candidate for THIS category).');
    lines.push('Use category signals to evaluate candidates — a candidate meeting more signals');
    lines.push('is a stronger candidate. Use market density to calibrate expectations — in a');
    lines.push('sparse market, your candidate pool will be small; that is expected.');
  } else {
    lines.push('', '--- CATEGORY INTELLIGENCE: not available ---');
    lines.push('Category enrichment has not run for this market yet. Proceed with general');
    lines.push('category knowledge for candidate discovery and evaluation.');
  }

  // Location intelligence
  const locLines: string[] = [];
  if (locCtx.market_summary) {
    locLines.push('', 'CITY MARKET SUMMARY:');
    locLines.push(`  ${locCtx.market_summary}`);
  }
  locLines.push(...formatCityProfileBlock(locCtx));
  if (locCtx.notable_areas && locCtx.notable_areas.length > 0) {
    locLines.push('', 'NOTABLE AREAS:');
    locLines.push(`  ${locCtx.notable_areas.join(', ')}`);
  }

  if (locLines.length > 0) {
    lines.push('', '--- LOCATION INTELLIGENCE ---');
    lines.push(...locLines);
    lines.push('', 'Use the city profile to understand WHERE these businesses concentrate and');
    lines.push('WHAT the market looks like. A city with large immigrant communities will have');
    lines.push('stronger ethnic grocery candidates; a logistics hub will have more');
    lines.push('distribution-oriented businesses. Let the city\'s character guide your search.');
  } else {
    lines.push('', '--- LOCATION INTELLIGENCE: not available ---');
    lines.push('Location enrichment has not run for this market yet. Proceed with general');
    lines.push('knowledge of the city for candidate discovery.');
  }

  lines.push('', 'If any blocks above are missing, proceed with your existing instructions —');
  lines.push('the intelligence is additive, not blocking. Note the absence in scan_metadata.');

  return lines.join('\n');
}

// ─── Category identification binding ─────────────────────────────────────

/**
 * Format location intelligence for a business category identification scan.
 *
 * The category identification scan takes a business name + location (NO
 * category) and determines which niche category the business belongs to.
 * Category intelligence is unavailable (the category is what we're finding),
 * so this formatter emits ONLY the location block. The location profile
 * informs the population test the analyst applies to every candidate shelf:
 *   - city_profile tells the analyst WHAT the market looks like (a city with
 *     large immigrant communities points toward ethnic-grocery candidates;
 *     a logistics hub points toward distribution businesses)
 *   - market_gaps tell the analyst WHERE demand is unmet — a business sitting
 *     in a gap area is a strong signal for which shelf it fills
 *   - top_categories / secondary_categories are shelves already known active
 *     in this market — direct candidate matches
 *   - metro_dynamics give nearby-market context for the population test
 *
 * Unlike the enrichment path (which shares only the structural city_profile
 * subset to avoid sentiment bleed into public copy), category identification
 * is an internal categorization analysis of a specific named business at a
 * specific location, so the FULL location intelligence is appropriate.
 */
export function formatCategoryIdentificationMarketContext(
  locCtx: LocationIntelligence,
  city: string,
  state: string,
): string {
  const hasLoc = loader.hasLocationIntelligence(locCtx);
  if (!hasLoc) return '';

  const lines: string[] = [
    '=== MARKET CONTEXT (from prior location enrichment) ===',
    '',
    `Location: ${city}, ${state}`,
    '',
    'This categorization benefits from location intelligence produced by a prior',
    'location enrichment run for this market. The category is unknown (that is',
    'what you are determining), so only the location profile is provided — no',
    'category intelligence. Use the location profile to inform the population',
    'test you apply to every candidate shelf: a label should naturally host',
    'multiple businesses in THIS market, and the city\'s character tells you',
    'which shelves plausibly hold a population here.',
  ];

  const locLines: string[] = [];
  if (locCtx.market_summary) {
    locLines.push('', 'CITY MARKET SUMMARY:');
    locLines.push(`  ${locCtx.market_summary}`);
  }
  locLines.push(...formatCityProfileBlock(locCtx));
  if (locCtx.top_categories && locCtx.top_categories.length > 0) {
    locLines.push('', 'TOP CATEGORIES (shelves already active in this market):');
    locLines.push(`  ${locCtx.top_categories.join(', ')}`);
  }
  if (locCtx.secondary_categories && locCtx.secondary_categories.length > 0) {
    locLines.push('', 'SECONDARY CATEGORIES (additional active shelves):');
    locLines.push(`  ${locCtx.secondary_categories.join(', ')}`);
  }
  if (locCtx.notable_areas && locCtx.notable_areas.length > 0) {
    locLines.push('', 'NOTABLE AREAS:');
    locLines.push(`  ${locCtx.notable_areas.join(', ')}`);
  }
  locLines.push(...formatMarketGapsBlock(locCtx));
  locLines.push(...formatMetroDynamicsBlock(locCtx));

  if (locLines.length > 0) {
    lines.push('', '--- LOCATION INTELLIGENCE ---');
    lines.push(...locLines);
    lines.push('', 'Use the city profile to understand the market the business operates in.');
    lines.push('A city with large immigrant communities makes ethnic-grocery candidates more');
    lines.push('plausible; a logistics hub makes distribution-oriented candidates more');
    lines.push('plausible. Let the city\'s character guide which shelves you consider.');
    lines.push('Use market gaps as a signal — a business sitting in a gap area may be');
    lines.push('filling unmet demand, which supports the shelf it fills.');
    lines.push('Use top/secondary categories as direct candidate matches — if the business');
    lines.push('plausibly fits a shelf already active in this market, that shelf passes the');
    lines.push('population test by construction.');
    lines.push('Use metro dynamics for the population test when the local population would');
    lines.push('be thin — a nearby complementary market can host peer businesses.');
  } else {
    lines.push('', '--- LOCATION INTELLIGENCE: not available ---');
    lines.push('Location enrichment has not run for this market yet. Proceed with general');
    lines.push('knowledge of the city for categorization.');
  }

  lines.push('', 'If any blocks above are missing, proceed with your existing instructions —');
  lines.push('the intelligence is additive, not blocking. Note the absence in scan_metadata.');

  return lines.join('\n');
}

// ─── Known-category vocabulary binding ──────────────────────────────────

/**
 * Format the operator-selectable category union for a category identification
 * scan — the same two lists DirectoryCategorySelectorAdapter merges:
 *   1. directoryLabels    — platform_categories (is_active), the ~414
 *      directory shelf labels
 *   2. registeredLabels   — mkt_service_categories_list (is_active) labels
 *      registered by operators, prior scans, and service packages (not all
 *      are directory shelves — the copy calls them labels, never categories)
 *
 * The two sections partition the union: a registered label matching a
 * directory name (case-insensitive, trimmed) is excluded — it is already
 * covered by KNOWN CATEGORIES. Directory casing wins on overlap.
 *
 * Returns '' when both lists are empty — the template's KNOWN CATEGORIES
 * paragraph then falls back to general-knowledge matching.
 *
 * Spec: docs/LocalBiz/CATEGORY_IDENTIFICATION_VOCAB_INJECTION_SPEC.md §4.2
 */

/**
 * Dedupe each vocabulary list (case-insensitive, first casing wins, sorted)
 * and partition the union: a registered label matching a directory name is
 * excluded — it is already covered by the directory section. Directory
 * casing wins on overlap.
 */
function partitionCategoryVocabulary(
  directoryLabels: string[],
  registeredLabels: string[],
): { directory: string[]; registered: string[] } {
  const dedupe = (labels: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of labels) {
      const label = raw.trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
    return out.sort((a, b) => a.localeCompare(b));
  };

  const directory = dedupe(directoryLabels);
  const directoryKeys = new Set(directory.map((l) => l.toLowerCase()));
  const registered = dedupe(registeredLabels).filter((l) => !directoryKeys.has(l.toLowerCase()));
  return { directory, registered };
}
export function formatKnownCategoryVocabulary(
  directoryLabels: string[],
  registeredLabels: string[],
): string {
  const { directory, registered } = partitionCategoryVocabulary(directoryLabels, registeredLabels);
  if (directory.length === 0 && registered.length === 0) return '';

  const lines: string[] = [
    '=== KNOWN CATEGORY VOCABULARY (platform directory shelves) ===',
    '',
    `The platform maintains a directory vocabulary of ${directory.length} category labels. These are`,
    'the shelves that already exist as public directory pages and that operators can',
    'select on every category-consuming surface.',
    '',
    'Judge `is_known_category` against THIS list — not against the market shelves in',
    'the MARKET CONTEXT block (when that block is present). The two are different:',
    '',
    '  - MARKET CONTEXT top/secondary categories = shelves observed to be active in',
    '    this city by a prior enrichment run. Use them for the population test.',
    '  - KNOWN CATEGORY VOCABULARY = the platform\'s registered directory labels.',
    '    Use this list to set `is_known_category`.',
    '',
    'If a candidate label appears in either list below, set is_known_category = true;',
    'otherwise set it to false so the operator is prompted to register it.',
    '',
    'PRIMARY vs SECONDARY:',
    '  - primary_category is the business\'s canonical shelf. Prefer a listed label',
    '    whenever one fits — if your best-fit label is a close variant of a listed',
    '    label (singular vs plural, word order, "Shop" vs "Store"), use the listed',
    '    label. Propose a new primary label only when no listed label fits.',
    '  - Secondary candidates have more flexibility: freely propose adjacent',
    '    shelves, broader parent (super) categories, and narrower niche (sub)',
    '    categories the business legitimately belongs on — including labels not',
    '    in this list. Near-duplicate spellings of a listed shelf should still',
    '    resolve to the listed label.',
  ];

  if (directory.length > 0) {
    lines.push('', `KNOWN CATEGORIES (${directory.length}):`);
    lines.push(`  ${directory.join(', ')}`);
  }

  if (registered.length > 0) {
    lines.push('', `REGISTERED LABELS (${registered.length}) — operator- and analyst-added, not all are directory shelves:`);
    lines.push(`  ${registered.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Format the platform category vocabulary for directory ENRICHMENT prompts
 * (category, category-set, and location packets).
 *
 * Same union as formatKnownCategoryVocabulary, different framing: the
 * packet's related-category fields render as chips on the public page that
 * resolve to a live shelf by exact label match (apps/web
 * resolveShelfForLabel). An invented near-variant silently degrades to a
 * plain-text chip, so the analyst is told to prefer listed labels.
 * sub_categories stay free-form — they are specializations within the
 * category, not platform shelves.
 *
 * Returns '' when both lists are empty (per-source degraded vocabulary).
 */
export function formatEnrichmentCategoryVocabulary(
  directoryLabels: string[],
  registeredLabels: string[],
): string {
  const { directory, registered } = partitionCategoryVocabulary(directoryLabels, registeredLabels);
  if (directory.length === 0 && registered.length === 0) return '';

  const lines: string[] = [
    '=== PLATFORM CATEGORY VOCABULARY (canonical shelf labels) ===',
    '',
    `The platform maintains a directory vocabulary of ${directory.length} canonical`,
    'category labels — the shelves that exist as public directory pages. Every',
    'related-category field you emit renders as a chip that hot-links to a shelf',
    'ONLY when the name matches a shelf label exactly (trimmed, case-insensitive).',
    'An invented or near-miss name renders as dead plain text — alignment with',
    'this list is what makes the link seamless. Category names also feed',
    'downstream matching (prospect queues, audit context), where canonical',
    'labels join cleanly and invented ones drift.',
    '',
    'DIRECTIVE — emit names verbatim from the KNOWN CATEGORIES list below for:',
    '  category packets: secondary_categories, adjacent_categories,',
    '    super_categories',
    '  location packets: secondary_categories, top_categories,',
    '    context.market_gaps[].category, area_breakdown[].strong_categories',
    '',
    'super_categories are PLATFORM parents, not external taxonomy levels — pick',
    'the listed shelf a shopper would drill up to (a specialty grocery rolls',
    'up to the listed grocery shelf). Never emit generic industry buckets like',
    '"Retail", "Food Retail", or "Consumer Services" that are not listed',
    'shelves — they render inert and waste the slot.',
    '',
    'If your best-fit name is a close variant of a listed label (singular vs',
    'plural, word order, "Shop" vs "Store"), emit the listed label. Emit an',
    'unlisted name only when no listed shelf genuinely fits.',
    '',
    'sub_categories are exempt — they are specializations within this category,',
    'not platform shelves; keep them descriptive and free-form.',
  ];

  if (directory.length > 0) {
    lines.push('', `KNOWN CATEGORIES (${directory.length}):`);
    lines.push(`  ${directory.join(', ')}`);
  }

  if (registered.length > 0) {
    lines.push('', `REGISTERED LABELS (${registered.length}) — operator- and analyst-added, not all are directory shelves:`);
    lines.push(`  ${registered.join(', ')}`);
  }

  return lines.join('\n');
}

// ─── Discovery binding ──────────────────────────────────────────────────

/**
 * Format market intelligence for an emerging/competitive discovery scan.
 *
 * Discovery prospects businesses in a category + city. It needs:
 *   - category_profile (WHAT to look for)
 *   - city_profile (WHERE to look)
 *   - market_gaps (WHERE demand is unmet)
 *   - prospect_signals (WHAT to look for when prospecting)
 *   - category_signals (HOW to evaluate discovered candidates)
 *   - market_density (expectation setting)
 *   - metro_dynamics (nearby market context)
 */
export function formatDiscoveryMarketContext(
  marketCtx: MarketContext,
  category: string,
  city: string,
  state: string,
  focus: 'emerging' | 'competitive' | 'gold_standards' | 'bronze_standards',
): string {
  const { category: catCtx, location: locCtx } = marketCtx;
  const hasCat = loader.hasCategoryIntelligence(catCtx);
  const hasLoc = loader.hasLocationIntelligence(locCtx);
  if (!hasCat && !hasLoc) return '';
  const isNational = (city ?? '').trim().toLowerCase() === '__all__';

  const lines: string[] = [
    '=== MARKET CONTEXT (from prior enrichment runs) ===',
    '',
    isNational
      ? 'This national discovery benefits from market intelligence produced by prior national enrichment runs:'
      : 'This discovery benefits from market intelligence produced by prior PG enrichment runs:',
    isNational
      ? '- National location enrichment: measured platform coverage across states'
      : '- Location enrichment (Stage 1): established the city\'s market character,',
    isNational
      ? '  and markets, plus national demand gaps and state-level dynamics'
      : '  identified demand gaps, and mapped metro dynamics',
    isNational
      ? '- National category enrichment: established the category\'s business model,'
      : '- Category enrichment (Stage 2): established the category\'s business model,',
    '  identified what strong looks like, and produced prospecting signals',
    '',
    'Use this intelligence to target your discovery. The intelligence tells you',
    isNational
      ? 'WHAT to look for (category profile), WHERE to look (national coverage + market gaps),'
      : 'WHAT to look for (category profile), WHERE to look (city profile + market gaps),',
    'and HOW to evaluate what you find (category signals).',
  ];

  // Category intelligence
  const catLines: string[] = [];
  if (catCtx.category_summary) {
    catLines.push('', 'CATEGORY SUMMARY (what this category looks like in this market):');
    catLines.push(`  ${catCtx.category_summary}`);
  }
  catLines.push(...formatCategoryProfileBlock(catCtx));
  catLines.push(...formatCategoryTaxonomyBlock(catCtx));
  catLines.push(...formatCategorySignalsBlock(catCtx));
  catLines.push(...formatMarketDensityBlock(catCtx));
  catLines.push(...formatProspectSignalsBlock(catCtx));

  if (catLines.length > 0) {
    lines.push('', '--- CATEGORY INTELLIGENCE ---');
    lines.push(...catLines);
    lines.push('', 'Use the category profile to recognize qualifying businesses. Businesses');
    lines.push('matching this profile are your primary targets. Businesses that partially');
    lines.push('match may be conversion opportunities (e.g., an international grocery that');
    lines.push('could reposition as African grocery).');
    lines.push('Use the category taxonomy to target your discovery — super categories show');
    lines.push('the broader market the category lives in, sub categories show specializations');
    lines.push('to prospect (businesses in a sub-category may be convertible to this category),');
    lines.push('and adjacent categories help you avoid false positives (businesses matching an');
    lines.push('adjacent category are siblings, not prospects for THIS category).');
    lines.push('Use category signals to evaluate discovered candidates — a candidate that');
    lines.push('meets more signals is a stronger prospect.');
    lines.push('Use prospect signals to identify prospects — a business matching these');
    lines.push('signals is a strong prospect even if it doesn\'t explicitly identify as');
    lines.push('this category.');
    lines.push('Use market density to calibrate expectations — in a sparse market, you\'ll');
    lines.push('find fewer candidates; that is expected, not a failure.');
  } else {
    lines.push('', '--- CATEGORY INTELLIGENCE: not available ---');
    lines.push('Category enrichment has not run for this market yet. Proceed with general');
    lines.push('category knowledge for prospect discovery.');
  }

  // Location intelligence — for national ('__all__') scans this is the
  // national location row: measured coverage + national gaps/dynamics instead
  // of a single city's profile.
  const locLines: string[] = [];
  const nationalCoverage = locCtx.national_coverage;
  if (isNational && nationalCoverage && (nationalCoverage.totalListings ?? 0) > 0) {
    locLines.push('', 'NATIONAL COVERAGE (measured platform coverage):');
    locLines.push(`  ${nationalCoverage.totalListings} listings across ${nationalCoverage.totalCities ?? 0} markets in ${nationalCoverage.totalStates ?? 0} states`);
    if (Array.isArray(nationalCoverage.states) && nationalCoverage.states.length > 0) {
      locLines.push(`  States: ${nationalCoverage.states.slice(0, 15).map((s) => `${s.state} (${s.listingCount} listings / ${s.cityCount} markets)`).join('; ')}`);
    }
    if (Array.isArray(nationalCoverage.topCities) && nationalCoverage.topCities.length > 0) {
      locLines.push(`  Largest markets: ${nationalCoverage.topCities.slice(0, 10).map((c) => `${c.city}, ${c.state}`).join('; ')}`);
    }
  }
  if (locCtx.market_summary) {
    locLines.push('', isNational ? 'NATIONAL MARKET SUMMARY:' : 'CITY MARKET SUMMARY:');
    locLines.push(`  ${locCtx.market_summary}`);
  }
  if (!isNational) {
    locLines.push(...formatCityProfileBlock(locCtx));
    if (locCtx.notable_areas && locCtx.notable_areas.length > 0) {
      locLines.push('', 'NOTABLE AREAS:');
      locLines.push(`  ${locCtx.notable_areas.join(', ')}`);
    }
  }
  locLines.push(...formatMarketGapsBlock(locCtx));
  locLines.push(...formatMetroDynamicsBlock(locCtx));

  if (locLines.length > 0) {
    lines.push('', isNational ? '--- NATIONAL LOCATION INTELLIGENCE ---' : '--- LOCATION INTELLIGENCE ---');
    lines.push(...locLines);
    if (isNational) {
      lines.push('', 'Use national coverage to prioritize WHERE you sweep first — markets');
      lines.push('with thin or absent coverage are the frontier; dense markets are where');
      lines.push('established candidates concentrate.');
      lines.push('Use national market gaps to target regions where the category is');
      lines.push('under-served — businesses filling those gaps are high-value prospects.');
    } else {
      lines.push('', 'Use the city profile to understand the market. Let the city\'s character');
      lines.push('guide WHERE you search.');
      lines.push('Use market gaps to target your discovery — if the category you\'re');
      lines.push('discovering has a gap in a specific area, prioritize that area.');
      lines.push('Businesses in gap areas are high-value prospects — they fill unmet demand.');
      lines.push('Use metro dynamics for expansion context — if nearby cities have');
      lines.push('complementary characteristics, businesses there may be expansion prospects.');
    }
  } else {
    lines.push('', isNational ? '--- NATIONAL LOCATION INTELLIGENCE: not available ---' : '--- LOCATION INTELLIGENCE: not available ---');
    lines.push(isNational
      ? 'National location enrichment has not run yet. Distribute the sweep across diverse markets using general knowledge.'
      : 'Location enrichment has not run for this market yet. Proceed with general');
    if (!isNational) lines.push('knowledge of the city for prospect discovery.');
  }

  // Focus-specific framing
  const focusLines: string[] = [];
  if (focus === 'emerging') {
    focusLines.push('For EMERGING discovery, prioritize businesses that DON\'T appear in the');
    focusLines.push('category profile\'s online_presence_pattern — businesses with thin online');
    focusLines.push('presence are the emerging targets this intelligence helps you find.');
    focusLines.push('Prioritize market gap areas — emerging businesses often fill unmet demand.');
  } else if (focus === 'competitive') {
    focusLines.push('For COMPETITIVE discovery, prioritize businesses that DO match the');
    focusLines.push('category profile and meet the most category_signals — these are the');
    focusLines.push('established competitors. Use market_density to understand how many to expect.');
  } else if (focus === 'gold_standards') {
    focusLines.push('For GOLD STANDARD discovery, the established gold-standard profile is your');
    focusLines.push('benchmark — evaluate candidates against it. Use category_signals as a');
    focusLines.push('supporting checklist and market_density to calibrate how many strong');
    focusLines.push('candidates to expect in this market.');
  }
  if (focusLines.length > 0) {
    lines.push('', '--- FOCUS GUIDANCE ---');
    lines.push(...focusLines);
  }

  lines.push('', 'If any blocks above are missing, proceed with your existing instructions —');
  lines.push('the intelligence is additive, not blocking. Note the absence in');
  lines.push('scan_metadata or discovery_metadata.');

  return lines.join('\n');
}
