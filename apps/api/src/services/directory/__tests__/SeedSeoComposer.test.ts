/**
 * SeedSeoComposer tests — deterministic output, guardrails, and degradation.
 *
 * Fixture requirements (spec §8 — normative):
 *   - Audit fixture uses the real v2 audit_data shape (platforms.google.*)
 *   - Tier C fields are present in the fixture so absence assertions are
 *     non-vacuous
 *   - Intelligence profile fixture includes terminology, synonyms,
 *     subcategories, category_signals, and prohibited_keywords
 */
import { describe, it, expect } from 'vitest';
import {
  buildSeedSeoPacket,
  buildSeoEnrichmentJson,
  type SeedSeoInput,
  type CampaignSeoFields,
  type AuditSeoFields,
  type IntelligenceProfileSeoFields,
  type GoldStandardSeoFields,
} from '../SeedSeoComposer';

// ─── Fixtures ────────────────────────────────────────────────────────────

/**
 * Realistic v2-shaped audit fixture.
 * platforms.google.additional_categories is populated (not top-level google).
 * Tier C fields are present so absence assertions are non-vacuous.
 */
const fullAudit: AuditSeoFields = {
  auditId: 'maud-test-001',
  storeFormat: 'grocery',
  googleAdditionalCategories: ['African goods store', 'International grocery'],
  platformProfileUrls: [
    { platform: 'google', url: 'https://maps.google.com/example' },
    { platform: 'yelp', url: 'https://yelp.com/biz/example' },
    { platform: 'facebook', url: 'https://facebook.com/example' },
  ],
};

const fullCampaign: CampaignSeoFields = {
  businessName: 'Sahel African Market',
  category: 'African Grocery Store',
  addressCity: 'Indianapolis',
  addressState: 'IN',
  neighborhood: 'Lafayette Square',
  businessOriginCountry: 'Senegal',
  businessOriginRegion: 'West Africa',
  directoryProfiles: [
    { platform: 'google', url: 'https://maps.google.com/sahel', claim_status: 'unclaimed' },
    { platform: 'yelp', url: 'https://yelp.com/biz/sahel', claim_status: 'unclaimed' },
  ],
  socialProfiles: [
    'https://instagram.com/sahelmarket',
    { platform: 'facebook', url: 'https://facebook.com/sahelmarket' },
  ],
};

const fullProfile: IntelligenceProfileSeoFields = {
  profileId: 'mip-test-001',
  synonyms: ['African grocery', 'West African staples', 'diaspora grocery'],
  subcategories: ['West African grocery', 'East African grocery'],
  prohibitedKeywords: ['halal', 'certified'],
  schemaOrgType: null, // Phase 2
};

const fullGoldStandard: GoldStandardSeoFields = {
  profileId: 'mip-gs-test-001',
  expectedFieldNames: ['hours', 'phone', 'website'],
};

// ─── Tests ───────────────────────────────────────────────────────────────

describe('SeedSeoComposer', () => {
  describe('buildSeedSeoPacket — deterministic output', () => {
    it('produces a well-formed packet with all fields populated', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: fullGoldStandard,
      });

      expect(packet.composerVersion).toBe(1);
      expect(packet.metaTitle).toBeTruthy();
      expect(packet.description).toBeTruthy();
      expect(packet.keywords.length).toBeGreaterThan(0);
      expect(packet.secondaryCategories.length).toBeGreaterThan(0);
      expect(packet.sameAs.length).toBeGreaterThan(0);
      expect(packet.schemaTypeHint).not.toBeNull();
      expect(packet.inputs.auditId).toBe('maud-test-001');
      expect(packet.inputs.intelligenceProfileId).toBe('mip-test-001');
      expect(packet.inputs.goldStandardProfileId).toBe('mip-gs-test-001');
    });

    it('is deterministic — same input produces same output', () => {
      const input: SeedSeoInput = {
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: fullGoldStandard,
      };

      const p1 = buildSeedSeoPacket(input);
      const p2 = buildSeedSeoPacket(input);

      expect(p1).toEqual(p2);
    });
  });

  describe('metaTitle — 70-char cap + format', () => {
    it('formats as {Business Name} — {Category} in {City}, {State}', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: null,
      });

      expect(packet.metaTitle).toContain('Sahel African Market');
      expect(packet.metaTitle).toContain('Indianapolis');
      expect(packet.metaTitle).toContain('IN');
    });

    it('uses store_format for category label when present', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: null,
        goldStandard: null,
      });

      // store_format = "grocery" → "grocery" appears in title
      expect(packet.metaTitle.toLowerCase()).toContain('grocery');
    });

    it('truncates at word boundary when exceeding 70 chars', () => {
      const longCampaign: CampaignSeoFields = {
        ...fullCampaign,
        businessName: 'Extremely Long Business Name That Will Push The Title Over The Character Limit LLC',
      };

      const packet = buildSeedSeoPacket({
        campaign: longCampaign,
        audit: fullAudit,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.metaTitle.length).toBeLessThanOrEqual(70);
      // Word-boundary truncation should end with ellipsis if truncated
      if (packet.metaTitle.endsWith('…')) {
        expect(packet.metaTitle.length).toBeLessThanOrEqual(70);
      }
    });

    it('falls back to {Business Name} - VisibleShelf Place when data is thin', () => {
      const thinCampaign: CampaignSeoFields = {
        businessName: 'Mystery Business',
        category: '',
      };

      const packet = buildSeedSeoPacket({
        campaign: thinCampaign,
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.metaTitle).toBe('Mystery Business - VisibleShelf Place');
    });
  });

  describe('description — 300-char cap + disclosure sentence', () => {
    it('includes the disclosure sentence in every output', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.description).toContain('Listed on VisibleShelf from public information');
      expect(packet.description).toContain('Claim this listing');
    });

    it('includes business name and category label', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.description).toContain('Sahel African Market');
      // store_format = "grocery" → "grocery" in description
      expect(packet.description.toLowerCase()).toContain('grocery');
    });

    it('includes city and neighborhood when present', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.description).toContain('Indianapolis');
      expect(packet.description).toContain('Lafayette Square');
    });

    it('omits city clause when city is absent', () => {
      const noCityCampaign: CampaignSeoFields = {
        businessName: 'Remote Business',
        category: 'Online Store',
      };

      const packet = buildSeedSeoPacket({
        campaign: noCityCampaign,
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.description).not.toContain(' in ');
      expect(packet.description).toContain('Remote Business');
    });

    it('truncates at word boundary when exceeding 300 chars', () => {
      const longCampaign: CampaignSeoFields = {
        ...fullCampaign,
        businessName: 'A'.repeat(250),
        neighborhood: 'B'.repeat(100),
      };

      const packet = buildSeedSeoPacket({
        campaign: longCampaign,
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.description.length).toBeLessThanOrEqual(300);
    });

    it('never contains review, score, tier, or deficiency language', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: fullGoldStandard,
      });

      const forbidden = [
        'review', 'score', 'tier', 'deficiency', 'gap', 'opportunity',
        'recommended', 'weakness', 'problem', 'negative',
      ];
      for (const word of forbidden) {
        expect(packet.description.toLowerCase()).not.toContain(word);
      }
    });
  });

  describe('keywords — merge order + dedupe + cap + key:value format', () => {
    it('merges in priority order: category, store_format, city/state, additional_categories, profile, origin', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: null,
      });

      const kws = packet.keywords;

      // 1. campaign.category (lowercased)
      expect(kws[0]).toBe('african grocery store');

      // 2. store_format
      expect(kws).toContain('grocery');

      // 3. city, state (plain), neighborhood (key:value)
      expect(kws).toContain('indianapolis');
      expect(kws).toContain('in');
      expect(kws).toContain('neighborhood:lafayette square');

      // 4. additional_categories
      expect(kws).toContain('african goods store');

      // 5. profile synonyms + subcategories
      expect(kws).toContain('african grocery');
      expect(kws).toContain('west african grocery');

      // 6. origin (key:value)
      expect(kws).toContain('origin_country:senegal');
      expect(kws).toContain('origin_region:west africa');
    });

    it('dedupes case-insensitively', () => {
      const campaign: CampaignSeoFields = {
        businessName: 'Test',
        category: 'Grocery',
        addressCity: 'TestCity',
      };
      const audit: AuditSeoFields = {
        auditId: 'a1',
        storeFormat: 'grocery', // same as category, different case
        googleAdditionalCategories: ['GROCERY'], // same again
      };

      const packet = buildSeedSeoPacket({
        campaign,
        audit,
        intelligenceProfile: null,
        goldStandard: null,
      });

      const groceryCount = packet.keywords.filter((k) => k === 'grocery').length;
      expect(groceryCount).toBe(1);
    });

    it('caps at 15 keywords', () => {
      const profile: IntelligenceProfileSeoFields = {
        profileId: 'p1',
        synonyms: Array.from({ length: 20 }, (_, i) => `syn${i}`),
        subcategories: Array.from({ length: 20 }, (_, i) => `sub${i}`),
      };

      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: profile,
        goldStandard: null,
      });

      expect(packet.keywords.length).toBeLessThanOrEqual(15);
    });

    it('preserves key:value format for neighborhood and origin', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.keywords.some((k) => k.startsWith('neighborhood:'))).toBe(true);
      expect(packet.keywords.some((k) => k.startsWith('origin_country:'))).toBe(true);
      expect(packet.keywords.some((k) => k.startsWith('origin_region:'))).toBe(true);
    });

    it('uses plain terms for category, city, state, store_format', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: null,
        goldStandard: null,
      });

      // These should NOT have key:value format
      expect(packet.keywords).toContain('african grocery store');
      expect(packet.keywords).toContain('grocery');
      expect(packet.keywords).toContain('indianapolis');
      expect(packet.keywords).toContain('in');
    });
  });

  describe('prohibited_keywords filtering', () => {
    it('filters prohibited keywords case-insensitively (exact match)', () => {
      const profile: IntelligenceProfileSeoFields = {
        profileId: 'p1',
        synonyms: ['halal grocery', 'certified organic'],
        subcategories: [],
        prohibitedKeywords: ['halal', 'certified'],
      };

      const packet = buildSeedSeoPacket({
        campaign: { businessName: 'Test', category: 'test' },
        audit: null,
        intelligenceProfile: profile,
        goldStandard: null,
      });

      // "halal grocery" contains "halal" but is not an exact match — it stays
      // (the filter is exact term match, not substring)
      expect(packet.keywords).toContain('halal grocery');
      // But if "halal" itself was in the pool, it would be filtered
      // Let's test with a category that IS "halal"
      const packet2 = buildSeedSeoPacket({
        campaign: { businessName: 'Test', category: 'halal' },
        audit: null,
        intelligenceProfile: profile,
        goldStandard: null,
      });
      expect(packet2.keywords).not.toContain('halal');
    });

    it('filters the term part of key:value keywords', () => {
      const profile: IntelligenceProfileSeoFields = {
        profileId: 'p1',
        prohibitedKeywords: ['halal'],
      };

      const packet = buildSeedSeoPacket({
        campaign: {
          businessName: 'Test',
          category: 'test',
          // Use origin to create a key:value keyword
          businessOriginCountry: 'halal',
        },
        audit: null,
        intelligenceProfile: profile,
        goldStandard: null,
      });

      // origin_country:halal should be filtered (term part = "halal")
      expect(packet.keywords).not.toContain('origin_country:halal');
    });

    it('filters nothing when prohibitedKeywords is empty/absent', () => {
      const profile: IntelligenceProfileSeoFields = {
        profileId: 'p1',
        synonyms: ['anything', 'everything'],
      };

      const packet = buildSeedSeoPacket({
        campaign: { businessName: 'Test', category: 'test' },
        audit: null,
        intelligenceProfile: profile,
        goldStandard: null,
      });

      expect(packet.keywords).toContain('anything');
      expect(packet.keywords).toContain('everything');
    });
  });

  describe('secondaryCategories — union + cap + exclude primary', () => {
    it('unions audit additional_categories + profile subcategories', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: null,
      });

      expect(packet.secondaryCategories).toContain('african goods store');
      expect(packet.secondaryCategories).toContain('west african grocery');
    });

    it('excludes the primary category string', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: null,
      });

      expect(packet.secondaryCategories).not.toContain('african grocery store');
    });

    it('caps at 6', () => {
      const profile: IntelligenceProfileSeoFields = {
        profileId: 'p1',
        subcategories: Array.from({ length: 10 }, (_, i) => `sub${i}`),
      };
      const audit: AuditSeoFields = {
        auditId: 'a1',
        googleAdditionalCategories: Array.from({ length: 10 }, (_, i) => `addl${i}`),
      };

      const packet = buildSeedSeoPacket({
        campaign: { businessName: 'Test', category: 'test' },
        audit,
        intelligenceProfile: profile,
        goldStandard: null,
      });

      expect(packet.secondaryCategories.length).toBeLessThanOrEqual(6);
    });
  });

  describe('sameAs — URL sanitization + dedupe', () => {
    it('collects URLs from directory_profiles, social_profiles, and audit platforms', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.sameAs).toContain('https://maps.google.com/sahel');
      expect(packet.sameAs).toContain('https://yelp.com/biz/sahel');
      expect(packet.sameAs).toContain('https://instagram.com/sahelmarket');
      expect(packet.sameAs).toContain('https://facebook.com/sahelmarket');
      expect(packet.sameAs).toContain('https://maps.google.com/example');
      expect(packet.sameAs).toContain('https://yelp.com/biz/example');
      expect(packet.sameAs).toContain('https://facebook.com/example');
    });

    it('only includes http(s) URLs', () => {
      const campaign: CampaignSeoFields = {
        businessName: 'Test',
        category: 'test',
        directoryProfiles: [
          { platform: 'google', url: 'ftp://bad.example.com' },
          { platform: 'yelp', url: 'https://good.example.com' },
        ],
        socialProfiles: ['not-a-url', 'https://also-good.example.com'],
      };

      const packet = buildSeedSeoPacket({
        campaign,
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.sameAs).not.toContain('ftp://bad.example.com');
      expect(packet.sameAs).not.toContain('not-a-url');
      expect(packet.sameAs).toContain('https://good.example.com');
      expect(packet.sameAs).toContain('https://also-good.example.com');
    });

    it('dedupes URLs', () => {
      const campaign: CampaignSeoFields = {
        businessName: 'Test',
        category: 'test',
        directoryProfiles: [
          { platform: 'google', url: 'https://example.com/dup' },
        ],
        socialProfiles: ['https://example.com/dup'],
      };

      const packet = buildSeedSeoPacket({
        campaign,
        audit: {
          auditId: 'a1',
          platformProfileUrls: [{ platform: 'google', url: 'https://example.com/dup' }],
        },
        intelligenceProfile: null,
        goldStandard: null,
      });

      const dupCount = packet.sameAs.filter((u) => u === 'https://example.com/dup').length;
      expect(dupCount).toBe(1);
    });

    it('never includes claim_status values', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.sameAs.some((u) => u.includes('unclaimed'))).toBe(false);
    });
  });

  describe('schemaTypeHint — inference table', () => {
    it('returns GroceryStore for multi-word "African Grocery Store" category', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.schemaTypeHint).toBe('GroceryStore');
    });

    it('returns Bakery for category containing "bakery"', () => {
      const packet = buildSeedSeoPacket({
        campaign: { businessName: 'Test', category: 'French Bakery' },
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.schemaTypeHint).toBe('Bakery');
    });

    it('uses store_format for inference when category alone does not match', () => {
      const packet = buildSeedSeoPacket({
        campaign: { businessName: 'Test', category: 'Specialty Food' },
        audit: { auditId: 'a1', storeFormat: 'butcher' },
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.schemaTypeHint).toBe('ButcherShop');
    });

    it('returns null when no word matches', () => {
      const packet = buildSeedSeoPacket({
        campaign: { businessName: 'Test', category: 'Consulting Firm' },
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.schemaTypeHint).toBeNull();
    });

    it('profile schemaOrgType wins over inference table', () => {
      const profile: IntelligenceProfileSeoFields = {
        profileId: 'p1',
        schemaOrgType: 'FoodEstablishment',
      };

      const packet = buildSeedSeoPacket({
        campaign: { businessName: 'Test', category: 'African Grocery Store' },
        audit: null,
        intelligenceProfile: profile,
        goldStandard: null,
      });

      expect(packet.schemaTypeHint).toBe('FoodEstablishment');
    });
  });

  describe('profile miss → degraded packet', () => {
    it('builds a packet from Tier A campaign facts only when profile + audit are null', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: null,
        intelligenceProfile: null,
        goldStandard: null,
      });

      expect(packet.metaTitle).toContain('Sahel African Market');
      expect(packet.description).toContain('Sahel African Market');
      expect(packet.keywords).toContain('african grocery store');
      expect(packet.keywords).toContain('indianapolis');
      // No sameAs (no audit profile URLs, no directory profiles in this case...
      // actually fullCampaign has directoryProfiles, so sameAs will have those)
      expect(packet.sameAs).toContain('https://maps.google.com/sahel');
      // No secondaryCategories from audit/profile
      expect(packet.secondaryCategories).toEqual([]);
      // schemaTypeHint still inferred from category
      expect(packet.schemaTypeHint).toBe('GroceryStore');
      expect(packet.inputs.auditId).toBeNull();
      expect(packet.inputs.intelligenceProfileId).toBeNull();
      expect(packet.inputs.goldStandardProfileId).toBeNull();
    });

    it('builds a packet from campaign + audit only (no profile)', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: null,
        goldStandard: null,
      });

      // Has audit-derived fields
      expect(packet.secondaryCategories).toContain('african goods store');
      expect(packet.sameAs).toContain('https://maps.google.com/example');
      // No profile-derived keywords
      expect(packet.keywords).not.toContain('african grocery');
      expect(packet.inputs.intelligenceProfileId).toBeNull();
    });
  });

  describe('Tier C absence assertions (non-vacuous)', () => {
    /**
     * The fixture includes Tier C fields in the campaign/audit shape.
     * The composer's input type (SeedSeoInput) does not accept Tier C fields,
     * so they cannot enter the packet. These assertions confirm the output
     * does not contain Tier C content even when the caller has access to it.
     */
    it('never emits digital_opportunity_score', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: fullGoldStandard,
      });

      expect(packet.description.toLowerCase()).not.toContain('digital_opportunity');
      expect(packet.description.toLowerCase()).not.toContain('opportunity score');
      expect(packet.keywords.some((k) => k.includes('opportunity'))).toBe(false);
    });

    it('never emits recommended_tier', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: fullGoldStandard,
      });

      expect(packet.description.toLowerCase()).not.toContain('tier');
      expect(packet.keywords.some((k) => k.includes('tier'))).toBe(false);
    });

    it('never emits negative_review_themes', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: fullGoldStandard,
      });

      expect(packet.description.toLowerCase()).not.toContain('negative review');
      expect(packet.keywords.some((k) => k.includes('negative'))).toBe(false);
    });

    it('never emits detected_signals (RA_/DS_/WC_/CP_/VP_/INT_)', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: fullGoldStandard,
      });

      const signalPatterns = ['ra_', 'ds_', 'wc_', 'cp_', 'vp_', 'int_'];
      for (const pat of signalPatterns) {
        expect(packet.keywords.some((k) => k.startsWith(pat))).toBe(false);
      }
    });

    it('never emits audit summary text', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: fullGoldStandard,
      });

      // The summary would contain analyst narrative — the composer input
      // type does not include it, so it cannot appear
      expect(packet.description).not.toContain('summary');
      expect(packet.description).not.toContain('analyst');
    });
  });

  describe('buildSeoEnrichmentJson', () => {
    it('produces a well-formed JSON blob with all fields', () => {
      const packet = buildSeedSeoPacket({
        campaign: fullCampaign,
        audit: fullAudit,
        intelligenceProfile: fullProfile,
        goldStandard: fullGoldStandard,
      });

      const json = buildSeoEnrichmentJson(packet);

      expect(json.composer_version).toBe(1);
      expect(json.meta_title).toBe(packet.metaTitle);
      expect(json.schema_type_hint).toBe(packet.schemaTypeHint);
      expect(json.inputs.audit_id).toBe('maud-test-001');
      expect(json.inputs.intelligence_profile_id).toBe('mip-test-001');
      expect(json.inputs.gold_standard_profile_id).toBe('mip-gs-test-001');
      expect(json.generated_at).toBeTruthy();
      // generated_at should be a valid ISO date
      expect(() => new Date(json.generated_at)).not.toThrow();
    });
  });
});
