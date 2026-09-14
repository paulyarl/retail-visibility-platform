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
  catLines.push(...formatCategorySignalsBlock(catCtx));
  catLines.push(...formatMarketDensityBlock(catCtx));

  if (catLines.length > 0) {
    lines.push('', '--- CATEGORY INTELLIGENCE ---');
    lines.push(...catLines);
    lines.push('', 'Use the category profile to recognize qualifying businesses — a business');
    lines.push('that matches the profile is more likely to be a strong gold-standard candidate.');
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
  focus: 'emerging' | 'competitive' | 'gold_standards',
): string {
  const { category: catCtx, location: locCtx } = marketCtx;
  const hasCat = loader.hasCategoryIntelligence(catCtx);
  const hasLoc = loader.hasLocationIntelligence(locCtx);
  if (!hasCat && !hasLoc) return '';

  const lines: string[] = [
    '=== MARKET CONTEXT (from prior enrichment runs) ===',
    '',
    'This discovery benefits from market intelligence produced by prior PG enrichment runs:',
    '- Location enrichment (Stage 1): established the city\'s market character,',
    '  identified demand gaps, and mapped metro dynamics',
    '- Category enrichment (Stage 2): established the category\'s business model,',
    '  identified what strong looks like, and produced prospecting signals',
    '',
    'Use this intelligence to target your discovery. The intelligence tells you',
    'WHAT to look for (category profile), WHERE to look (city profile + market gaps),',
    'and HOW to evaluate what you find (category signals).',
  ];

  // Category intelligence
  const catLines: string[] = [];
  if (catCtx.category_summary) {
    catLines.push('', 'CATEGORY SUMMARY (what this category looks like in this market):');
    catLines.push(`  ${catCtx.category_summary}`);
  }
  catLines.push(...formatCategoryProfileBlock(catCtx));
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
  locLines.push(...formatMarketGapsBlock(locCtx));
  locLines.push(...formatMetroDynamicsBlock(locCtx));

  if (locLines.length > 0) {
    lines.push('', '--- LOCATION INTELLIGENCE ---');
    lines.push(...locLines);
    lines.push('', 'Use the city profile to understand the market. Let the city\'s character');
    lines.push('guide WHERE you search.');
    lines.push('Use market gaps to target your discovery — if the category you\'re');
    lines.push('discovering has a gap in a specific area, prioritize that area.');
    lines.push('Businesses in gap areas are high-value prospects — they fill unmet demand.');
    lines.push('Use metro dynamics for expansion context — if nearby cities have');
    lines.push('complementary characteristics, businesses there may be expansion prospects.');
  } else {
    lines.push('', '--- LOCATION INTELLIGENCE: not available ---');
    lines.push('Location enrichment has not run for this market yet. Proceed with general');
    lines.push('knowledge of the city for prospect discovery.');
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
