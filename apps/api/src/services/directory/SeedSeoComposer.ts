/**
 * SeedSeoComposer — pure, deterministic SEO packet composer for directory
 * presence seeds.
 *
 * No LLM, no network, no Prisma. Input is explicit fields only (never the
 * raw audit_data blob) so Tier C leakage requires a deliberate type violation.
 * The composer's output is written into the listing's description/keywords/
 * same_as columns and the seed's seo_enrichment JSON at seed time.
 *
 * Guardrails (spec §4.4):
 *   1. No Tier C fields in any output (enforced by input type boundary).
 *   2. No claims from category vocabulary — keywords are verbatim from
 *      profile fields only; the composer never generates new keyword strings.
 *   3. No gold-standard language or exemplar leakage.
 *   4. Mechanical prohibited-keyword filtering (case-insensitive exact match).
 *   5. Disclosure sentence retained in description for all contexts.
 *   6. Provenance per projected field (caller writes rows).
 *   7. Identity + NAP guards unchanged (caller enforces).
 *   8. One-way projection (campaign → seed only).
 */

// ─── Types ───────────────────────────────────────────────────────────────

/**
 * Subset of the campaign row needed by the composer.
 * The caller extracts these from the full Prisma row.
 */
export interface CampaignSeoFields {
  businessName: string;
  category: string;
  addressCity?: string | null;
  addressState?: string | null;
  neighborhood?: string | null;
  businessOriginCountry?: string | null;
  businessOriginRegion?: string | null;
  /** Array of { platform, url, claim_status } — only url is used */
  directoryProfiles?: Array<{ platform?: string; url?: string; claim_status?: string }> | null;
  /** Array of profile URLs or { platform, url } objects */
  socialProfiles?: Array<string | { platform?: string; url?: string }> | null;
}

/**
 * Subset of the audit_data JSON needed by the composer.
 * The caller extracts these from the raw audit_data blob — the composer
 * never receives the blob itself, preventing Tier C leakage.
 */
export interface AuditSeoFields {
  auditId: string;
  /** matched_business.store_format from audit_metadata */
  storeFormat?: string | null;
  /** platforms.google.additional_categories (fixed §2.5 bug) */
  googleAdditionalCategories?: string[] | null;
  /** Profile URLs from platforms.{google,yelp,facebook,bbb}.profile_url */
  platformProfileUrls?: Array<{ platform: string; url: string }> | null;
}

/**
 * Subset of the intelligence profile configuration needed by the composer.
 * Resolved via IntelligenceProfileService.resolve() with an explicit
 * non-gold_standards focus.
 */
export interface IntelligenceProfileSeoFields {
  profileId: string;
  synonyms?: string[];
  subcategories?: string[];
  /** Phase 2 structured denylist — empty/absent filters nothing in v1 */
  prohibitedKeywords?: string[];
  /** Phase 2 operator-set schema.org type — null in v1 */
  schemaOrgType?: string | null;
}

/**
 * Subset of the gold standard profile needed by the composer.
 * Only expected_fields field-name vocabulary is used (Tier B).
 */
export interface GoldStandardSeoFields {
  profileId: string;
  /** Field names from expected_fields — keyword hints only */
  expectedFieldNames?: string[];
}

export interface SeedSeoInput {
  campaign: CampaignSeoFields;
  audit: AuditSeoFields | null;
  intelligenceProfile: IntelligenceProfileSeoFields | null;
  goldStandard: GoldStandardSeoFields | null;
}

export interface SeedSeoPacket {
  metaTitle: string;
  description: string;
  keywords: string[];
  secondaryCategories: string[];
  sameAs: string[];
  schemaTypeHint: string | null;
  inputs: {
    auditId: string | null;
    intelligenceProfileId: string | null;
    goldStandardProfileId: string | null;
  };
  composerVersion: number;
}

// ─── Constants ───────────────────────────────────────────────────────────

const COMPOSER_VERSION = 1;
const META_TITLE_MAX = 70;
const DESCRIPTION_MAX = 300;
const KEYWORDS_MAX = 15;
const SECONDARY_CATEGORIES_MAX = 6;

/**
 * Curated word-boundary → schema.org type table.
 * Applied to campaign.category + store_format via contains-word matching.
 * Fixes the broken mapCategoryToSchemaType fallback which only matches
 * single-word lowercase keys (spec §4.3, finding B2).
 */
const SCHEMA_TYPE_TABLE: Array<{ words: string[]; type: string }> = [
  { words: ['grocery'], type: 'GroceryStore' },
  { words: ['bakery'], type: 'Bakery' },
  { words: ['butcher', 'butcher shop', 'meat'], type: 'ButcherShop' },
  { words: ['restaurant'], type: 'Restaurant' },
  { words: ['cafe', 'coffee'], type: 'CafeOrCoffeeShop' },
  { words: ['bar', 'pub'], type: 'BarOrPub' },
  { words: ['salon'], type: 'BeautySalon' },
  { words: ['spa'], type: 'DaySpa' },
  { words: ['pharmacy'], type: 'Pharmacy' },
  { words: ['clothing', 'apparel'], type: 'ClothingStore' },
  { words: ['electronics'], type: 'ElectronicsStore' },
  { words: ['furniture'], type: 'FurnitureStore' },
  { words: ['hardware'], type: 'HardwareStore' },
  { words: ['gym', 'fitness'], type: 'ExerciseGym' },
  { words: ['hotel', 'motel'], type: 'Hotel' },
  { words: ['store', 'retail', 'shop', 'market'], type: 'Store' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

function truncateAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace <= 0) return truncated.slice(0, max - 1).trimEnd() + '…';
  return truncated.slice(0, lastSpace).trimEnd() + '…';
}

function dedupeLowercase(arr: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of arr) {
    const lower = item.toLowerCase().trim();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }
  return result;
}

function isHttpOrHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if a text contains a word (word-boundary match, case-insensitive).
 * "African Grocery Store" contains "grocery" → true.
 * "African Grocery Store" contains "store" → true.
 */
function containsWord(text: string, word: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
  return pattern.test(text);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Field compositions ──────────────────────────────────────────────────

function composeMetaTitle(campaign: CampaignSeoFields, categoryLabel: string): string {
  const parts: string[] = [campaign.businessName];

  if (categoryLabel && categoryLabel !== 'Unknown') {
    parts.push(categoryLabel);
  }

  if (campaign.addressCity && campaign.addressState) {
    parts.push(`in ${campaign.addressCity}, ${campaign.addressState}`);
  } else if (campaign.addressCity) {
    parts.push(`in ${campaign.addressCity}`);
  }

  const title = parts.join(' — ');
  const truncated = truncateAtWordBoundary(title, META_TITLE_MAX);

  // Fallback to today's format when data is too thin
  if (!campaign.addressCity && !categoryLabel) {
    return `${campaign.businessName} - VisibleShelf Place`;
  }

  return truncated;
}

function composeDescription(
  campaign: CampaignSeoFields,
  categoryLabel: string,
): string {
  const cityClause = campaign.addressCity
    ? ` in ${campaign.addressCity}${campaign.neighborhood ? `, ${campaign.neighborhood}` : ''}`
    : '';
  const stateClause = campaign.addressState ? `, ${campaign.addressState}` : '';

  const template = `${campaign.businessName} is a ${categoryLabel}${cityClause}${stateClause}. Listed on VisibleShelf from public information (address, phone). Claim this listing to verify and update details.`;

  return truncateAtWordBoundary(template, DESCRIPTION_MAX);
}

function composeKeywords(
  campaign: CampaignSeoFields,
  audit: AuditSeoFields | null,
  profile: IntelligenceProfileSeoFields | null,
  goldStandard: GoldStandardSeoFields | null,
  prohibitedKeywords: Set<string>,
): string[] {
  const ordered: string[] = [];

  // 1. campaign.category (plain term)
  if (campaign.category) ordered.push(campaign.category);

  // 2. store_format (plain term, Tier B)
  if (audit?.storeFormat && audit.storeFormat !== 'unknown') {
    ordered.push(audit.storeFormat);
  }

  // 3. city, state (plain terms), neighborhood (key:value)
  if (campaign.addressCity) ordered.push(campaign.addressCity);
  if (campaign.addressState) ordered.push(campaign.addressState);
  if (campaign.neighborhood) ordered.push(`neighborhood:${campaign.neighborhood}`);

  // 4. audit additional_categories (plain terms)
  if (audit?.googleAdditionalCategories) {
    for (const cat of audit.googleAdditionalCategories) {
      ordered.push(cat);
    }
  }

  // 5. intelligence profile synonyms + subcategories (plain terms, category-level)
  if (profile?.synonyms) {
    for (const syn of profile.synonyms) {
      ordered.push(syn);
    }
  }
  if (profile?.subcategories) {
    for (const sub of profile.subcategories) {
      ordered.push(sub);
    }
  }

  // 6. origin_country:{x} / origin_region:{x} (key:value, existing sync format)
  if (campaign.businessOriginCountry) {
    ordered.push(`origin_country:${campaign.businessOriginCountry}`);
  }
  if (campaign.businessOriginRegion) {
    ordered.push(`origin_region:${campaign.businessOriginRegion}`);
  }

  // Gold standard expected_field names as keyword hints (Tier B, lowest priority)
  if (goldStandard?.expectedFieldNames) {
    for (const field of goldStandard.expectedFieldNames) {
      ordered.push(field);
    }
  }

  // Dedupe + lowercase + cap
  const deduped = dedupeLowercase(ordered);

  // Filter prohibited keywords (case-insensitive exact match)
  const filtered = deduped.filter((kw) => {
    // Check both the full keyword and the term part of key:value keywords
    const term = kw.includes(':') ? kw.split(':').slice(1).join(':') : kw;
    return !prohibitedKeywords.has(kw) && !prohibitedKeywords.has(term);
  });

  return filtered.slice(0, KEYWORDS_MAX);
}

function composeSecondaryCategories(
  campaign: CampaignSeoFields,
  audit: AuditSeoFields | null,
  profile: IntelligenceProfileSeoFields | null,
): string[] {
  const all: string[] = [];

  if (audit?.googleAdditionalCategories) {
    for (const cat of audit.googleAdditionalCategories) {
      all.push(cat);
    }
  }

  if (profile?.subcategories) {
    for (const sub of profile.subcategories) {
      all.push(sub);
    }
  }

  const primaryLower = campaign.category?.toLowerCase().trim();
  const deduped = dedupeLowercase(all).filter(
    (cat) => cat !== primaryLower,
  );

  return deduped.slice(0, SECONDARY_CATEGORIES_MAX);
}

function composeSameAs(
  campaign: CampaignSeoFields,
  audit: AuditSeoFields | null,
): string[] {
  const urls: string[] = [];

  // Campaign directory_profiles[] — only url, claim_status stays internal
  if (campaign.directoryProfiles) {
    for (const prof of campaign.directoryProfiles) {
      if (prof.url && isHttpOrHttps(prof.url)) {
        urls.push(prof.url);
      }
    }
  }

  // Campaign social_profiles — handle both string and object forms
  if (campaign.socialProfiles) {
    for (const social of campaign.socialProfiles) {
      const url = typeof social === 'string' ? social : social?.url;
      if (url && isHttpOrHttps(url)) {
        urls.push(url);
      }
    }
  }

  // Audit platforms.*.profile_url
  if (audit?.platformProfileUrls) {
    for (const { url } of audit.platformProfileUrls) {
      if (isHttpOrHttps(url)) {
        urls.push(url);
      }
    }
  }

  // Dedupe (case-sensitive URL dedup — URLs are case-significant in path)
  return [...new Set(urls)];
}

function composeSchemaTypeHint(
  campaign: CampaignSeoFields,
  audit: AuditSeoFields | null,
  profile: IntelligenceProfileSeoFields | null,
): string | null {
  // 1. Profile schema_org_type wins (Phase 2)
  if (profile?.schemaOrgType) {
    return profile.schemaOrgType;
  }

  // 2. Composer-side word-boundary inference table
  const searchText = [campaign.category, audit?.storeFormat]
    .filter(Boolean)
    .join(' ');

  if (searchText) {
    for (const entry of SCHEMA_TYPE_TABLE) {
      for (const word of entry.words) {
        if (containsWord(searchText, word)) {
          return entry.type;
        }
      }
    }
  }

  // 3. null → JSON-LD emits LocalBusiness (today's behavior)
  return null;
}

function resolveCategoryLabel(
  campaign: CampaignSeoFields,
  audit: AuditSeoFields | null,
): string {
  // Prefer the human-readable campaign category (e.g. "African Grocery Store")
  // over the machine store_format slug (e.g. "grocery_plus_prepared_foods").
  // store_format is only used as a last-resort fallback when category is empty,
  // and is humanized (underscores → spaces) so it never appears as a raw slug.
  const category = campaign.category?.trim();
  if (category) return category;

  if (audit?.storeFormat && audit.storeFormat !== 'unknown') {
    return audit.storeFormat.replace(/_/g, ' ');
  }
  return '';
}

// ─── Main export ─────────────────────────────────────────────────────────

/**
 * Build a deterministic SEO packet from explicit campaign + audit + profile
 * fields. No LLM, no network, no Prisma.
 *
 * Degrades gracefully: when audit or profile is null, the packet is built
 * from Tier A campaign facts only.
 */
export function buildSeedSeoPacket(input: SeedSeoInput): SeedSeoPacket {
  const { campaign, audit, intelligenceProfile, goldStandard } = input;

  // Build prohibited keywords set (case-insensitive exact match)
  const prohibitedKeywords = new Set<string>();
  if (intelligenceProfile?.prohibitedKeywords) {
    for (const kw of intelligenceProfile.prohibitedKeywords) {
      prohibitedKeywords.add(kw.toLowerCase().trim());
    }
  }

  const categoryLabel = resolveCategoryLabel(campaign, audit);

  const metaTitle = composeMetaTitle(campaign, categoryLabel);
  const description = composeDescription(campaign, categoryLabel);
  const keywords = composeKeywords(
    campaign,
    audit,
    intelligenceProfile,
    goldStandard,
    prohibitedKeywords,
  );
  const secondaryCategories = composeSecondaryCategories(
    campaign,
    audit,
    intelligenceProfile,
  );
  const sameAs = composeSameAs(campaign, audit);
  const schemaTypeHint = composeSchemaTypeHint(
    campaign,
    audit,
    intelligenceProfile,
  );

  return {
    metaTitle,
    description,
    keywords,
    secondaryCategories,
    sameAs,
    schemaTypeHint,
    inputs: {
      auditId: audit?.auditId ?? null,
      intelligenceProfileId: intelligenceProfile?.profileId ?? null,
      goldStandardProfileId: goldStandard?.profileId ?? null,
    },
    composerVersion: COMPOSER_VERSION,
  };
}

/**
 * Build the seo_enrichment JSON blob for storage on the seed row.
 * Includes the meta_title, schema_type_hint, composer inputs, and timestamp.
 */
export function buildSeoEnrichmentJson(packet: SeedSeoPacket): {
  composer_version: number;
  meta_title: string;
  schema_type_hint: string | null;
  inputs: {
    audit_id: string | null;
    intelligence_profile_id: string | null;
    gold_standard_profile_id: string | null;
  };
  generated_at: string;
} {
  return {
    composer_version: packet.composerVersion,
    meta_title: packet.metaTitle,
    schema_type_hint: packet.schemaTypeHint,
    inputs: {
      audit_id: packet.inputs.auditId,
      intelligence_profile_id: packet.inputs.intelligenceProfileId,
      gold_standard_profile_id: packet.inputs.goldStandardProfileId,
    },
    generated_at: new Date().toISOString(),
  };
}
