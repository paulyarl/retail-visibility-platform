import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for MarketingHotProspectService.syncFromAudit contact-field sync.
 *
 * Covers the audit → campaign contact sync spec:
 *  - business_name, phone, website_url, address synced from nap_consistency
 *    (canonical_*) with fallback to platforms.google.displayed_* and
 *    audit_metadata.matched_business.*
 *  - Overwrite-if-verified: audit-derived values overwrite existing campaign
 *    values only when data_quality.verified_fields mentions the field;
 *    otherwise fill-null only.
 *  - Address is parsed from the single-line canonical string into structured
 *    address_line1/city/state/zip/country via the address-parser middleware.
 */

const {
  mockAuditsList,
  mockCampaignsList,
} = vi.hoisted(() => ({
  mockAuditsList: { findUnique: vi.fn() },
  mockCampaignsList: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_audits_list: mockAuditsList,
    mkt_campaigns_list: mockCampaignsList,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    marketingOpsHotProspectSkipMismatchedIdentity: true,
    marketingOpsHotProspectConfidenceThreshold: 'medium',
    marketingOpsHotProspectThreshold: 7,
  },
}));

vi.mock('../CampaignTriageService', () => ({
  default: { evaluateTriageForCampaign: vi.fn() },
}));

import { MarketingHotProspectService } from '../MarketingHotProspectService';

// ─── Helpers ─────────────────────────────────────────────────────────────

const AUDIT_ID = 'maud-9vlyc4cp';
const CAMPAIGN_ID = 'mcamp-v2wx8aps';

/** Build a business_analysis audit_data payload (the example shape). */
function buildAuditData(overrides: any = {}): any {
  return {
    audit_metadata: {
      identity_status: 'confirmed',
      matched_business: {
        business_name: 'YB Enterprise African Market',
        category: 'African Grocery Store',
        phone: '(317) 734-3827',
        address: '711 E Thompson Rd, Indianapolis, IN 46227',
        website: null,
      },
      requested_business: {
        business_name: 'YB Enterprise African Market',
        category: 'African Grocery Store',
        city: 'Indianapolis',
        state: 'Indiana',
      },
    },
    platforms: {
      google: {
        rating: 4.8,
        total_reviews: 9,
        data_status: 'partial',
        profile_status: 'unable_to_verify',
        displayed_name: 'YB Enterprise African Market',
        displayed_phone: '(317) 734-3827',
        displayed_address: '711 E Thompson Rd, Indianapolis, IN 46227',
        displayed_website: null,
        primary_category: 'Grocery store',
      },
      bbb: { data_status: 'unavailable' },
      yelp: { data_status: 'unavailable' },
      facebook: { data_status: 'unavailable' },
    },
    website: { url: null, status: 'none_found', mobile_friendly: 'unable_to_verify' },
    nap_consistency: {
      overall_status: 'major_inconsistencies',
      canonical_name: 'YB Enterprise African Market',
      canonical_phone: '(317) 734-3827',
      canonical_address: '711 E Thompson Rd, Indianapolis, IN 46227',
    },
    digital_opportunity_score: { score: 3, classification: 'low' },
    recommended_tier: 'tier_3',
    estimated_monthly_service_fee: { minimum: 300, maximum: 750, currency: 'USD' },
    data_quality: {
      confidence: 'medium',
      verified_fields: [
        'Business name',
        'Indianapolis physical location',
        '711 E Thompson Rd address',
        'Current 4.8 public rating',
        'Canonical phone support for (317) 734-3827',
      ],
      unavailable_fields: ['Official website usability metrics'],
    },
    ...overrides,
  };
}

/** Build a campaign row as stored in the DB. */
function buildCampaign(overrides: any = {}): any {
  return {
    id: CAMPAIGN_ID,
    business_name: 'YB Enterprise African Market',
    phone: null,
    email: null,
    website_url: null,
    has_website: 'none',
    address_line1: null,
    address_line2: null,
    address_city: 'Indianapolis',
    address_state: 'IN',
    address_zip: null,
    address_country: 'US',
    pain_score: null,
    estimated_tier: null,
    estimated_fee_cents: 0,
    gbp_claimed: null,
    nap_consistent: null,
    unaddressed_reviews: 0,
    is_hot_prospect: false,
    ...overrides,
  };
}

/** Build the audit row with included campaign, as returned by findUnique. */
function buildAuditRow(auditData: any, campaign: any): any {
  return {
    id: AUDIT_ID,
    campaign_id: CAMPAIGN_ID,
    platform: 'business_analysis',
    audit_data: auditData,
    mkt_campaigns_list: campaign,
  };
}

/**
 * Wire up the mocks for a single syncFromAudit call.
 * - audits.findUnique returns the audit row (with included campaign)
 * - campaigns.findUnique returns the post-sync campaign (reflecting the update)
 * - campaigns.update returns the merged row and records the data written
 */
function wireMocks(auditData: any, initialCampaign: any) {
  const updates: any[] = [];
  mockAuditsList.findUnique.mockResolvedValue(buildAuditRow(auditData, initialCampaign));

  // campaigns.findUnique is called after syncCampaignFields and after
  // syncContactFields. We return a row that reflects whatever the latest
  // update wrote, so the report-tracking logic sees the changes.
  let currentCampaign = { ...initialCampaign };
  mockCampaignsList.findUnique.mockImplementation(({ select }: any) => {
    const row: any = {};
    if (select) {
      for (const k of Object.keys(select)) row[k] = currentCampaign[k];
    } else {
      Object.assign(row, currentCampaign);
    }
    return Promise.resolve(row);
  });

  mockCampaignsList.update.mockImplementation(({ where, data }: any) => {
    currentCampaign = { ...currentCampaign, ...data };
    updates.push({ where, data });
    return Promise.resolve(currentCampaign);
  });

  return { updates, currentCampaignRef: () => currentCampaign };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('MarketingHotProspectService.syncFromAudit — contact sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fills null contact fields from canonical NAP when verified', async () => {
    const auditData = buildAuditData();
    // business_name intentionally different from the audit's canonical_name
    // so the verified-overwrite path produces a detectable change.
    const initial = buildCampaign({ business_name: 'YB Enterprise' });
    const { updates } = wireMocks(auditData, initial);

    const report = await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    // One update for syncCampaignFields (pain_score/tier/etc.) + one for
    // syncContactFields. Find the contact update.
    const contactUpdate = updates.find((u) => u.data.phone || u.data.address_line1);
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate.data.business_name).toBe('YB Enterprise African Market');
    expect(contactUpdate.data.phone).toBe('(317) 734-3827');
    expect(contactUpdate.data.address_line1).toBe('711 E Thompson Rd');
    expect(contactUpdate.data.address_city).toBe('Indianapolis');
    expect(contactUpdate.data.address_state).toBe('IN');
    expect(contactUpdate.data.address_zip).toBe('46227');
    expect(contactUpdate.data.address_country).toBe('US');
    // website is null in audit → not synced
    expect(contactUpdate.data.website_url).toBeUndefined();

    expect(report.contactsSynced).toContain('business_name');
    expect(report.contactsSynced).toContain('phone');
    expect(report.contactsSynced).toContain('address');
  });

  it('overwrites existing phone when audit marks phone as verified', async () => {
    const auditData = buildAuditData();
    const initial = buildCampaign({ phone: '(317) 809-8321' }); // conflicting MapQuest phone
    const { updates } = wireMocks(auditData, initial);

    await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    const contactUpdate = updates.find((u) => Object.prototype.hasOwnProperty.call(u.data, 'phone'));
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate.data.phone).toBe('(317) 734-3827'); // canonical overwrites
  });

  it('does NOT overwrite existing phone when audit lacks phone in verified_fields', async () => {
    const auditData = buildAuditData({
      data_quality: {
        confidence: 'medium',
        verified_fields: ['Business name', '711 E Thompson Rd address'], // no phone
        unavailable_fields: [],
      },
    });
    const initial = buildCampaign({ phone: '(317) 809-8321' });
    const { updates } = wireMocks(auditData, initial);

    await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    const contactUpdate = updates.find((u) => Object.prototype.hasOwnProperty.call(u.data, 'phone'));
    expect(contactUpdate).toBeUndefined(); // phone not written at all
  });

  it('does NOT overwrite existing address when audit lacks address in verified_fields', async () => {
    const auditData = buildAuditData({
      data_quality: {
        confidence: 'medium',
        verified_fields: ['Business name', 'Canonical phone support for (317) 734-3827'],
        unavailable_fields: [],
      },
    });
    const initial = buildCampaign({ address_line1: '711 E Thompson Rd C' });
    const { updates } = wireMocks(auditData, initial);

    await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    const contactUpdate = updates.find((u) => Object.prototype.hasOwnProperty.call(u.data, 'address_line1'));
    expect(contactUpdate).toBeUndefined();
  });

  it('prefers nap_consistency.canonical_phone over platforms.google.displayed_phone', async () => {
    const auditData = buildAuditData({
      nap_consistency: {
        ...buildAuditData().nap_consistency,
        canonical_phone: '(317) 555-0000',
      },
      platforms: {
        ...buildAuditData().platforms,
        google: {
          ...buildAuditData().platforms.google,
          displayed_phone: '(317) 555-1111',
        },
      },
    });
    const initial = buildCampaign();
    const { updates } = wireMocks(auditData, initial);

    await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    const contactUpdate = updates.find((u) => Object.prototype.hasOwnProperty.call(u.data, 'phone'));
    expect(contactUpdate.data.phone).toBe('(317) 555-0000');
  });

  it('falls back to platforms.google.displayed_phone when nap_consistency.canonical_phone is null', async () => {
    const auditData = buildAuditData({
      nap_consistency: {
        overall_status: 'major_inconsistencies',
        canonical_name: 'YB Enterprise African Market',
        canonical_phone: null,
        canonical_address: '711 E Thompson Rd, Indianapolis, IN 46227',
      },
    });
    const initial = buildCampaign();
    const { updates } = wireMocks(auditData, initial);

    await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    const contactUpdate = updates.find((u) => Object.prototype.hasOwnProperty.call(u.data, 'phone'));
    expect(contactUpdate.data.phone).toBe('(317) 734-3827'); // from google.displayed_phone
  });

  it('syncs website_url from website.url when present and verified', async () => {
    const auditData = buildAuditData({
      website: { url: 'https://yb-african-market.com', status: 'working', mobile_friendly: 'yes' },
      data_quality: {
        confidence: 'high',
        verified_fields: ['Business name', 'Official website', 'Canonical phone support for (317) 734-3827'],
        unavailable_fields: [],
      },
    });
    const initial = buildCampaign();
    const { updates } = wireMocks(auditData, initial);

    await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    const contactUpdate = updates.find((u) => Object.prototype.hasOwnProperty.call(u.data, 'website_url'));
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate.data.website_url).toBe('https://yb-african-market.com');
    expect(contactUpdate.data.has_website).toBe('yes');
  });

  it('does not call update when audit has no contact data', async () => {
    const auditData = buildAuditData({
      nap_consistency: { overall_status: 'consistent' },
      platforms: { google: { data_status: 'unavailable' }, bbb: {}, yelp: {}, facebook: {} },
      website: { url: null, status: 'none_found' },
      audit_metadata: {
        identity_status: 'confirmed',
        matched_business: { business_name: null, category: null, phone: null, address: null, website: null },
        requested_business: { business_name: null, category: null },
      },
      data_quality: { confidence: 'low', verified_fields: [], unavailable_fields: [] },
    });
    const initial = buildCampaign({ business_name: 'Some Biz' });
    const { updates } = wireMocks(auditData, initial);

    await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    // syncCampaignFields may still write pain_score/tier, but no contact
    // fields should be present on any update.
    const contactUpdate = updates.find((u) =>
      u.data.phone || u.data.website_url || u.data.address_line1 || u.data.business_name);
    expect(contactUpdate).toBeUndefined();
  });

  it('skips sync entirely when identity_status is mismatched', async () => {
    const auditData = buildAuditData({
      audit_metadata: {
        ...buildAuditData().audit_metadata,
        identity_status: 'mismatched',
      },
    });
    const initial = buildCampaign();
    const { updates } = wireMocks(auditData, initial);

    const report = await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    expect(report.skipped).toBe(true);
    expect(report.skipReason).toMatch(/mismatched/);
    // No campaign updates at all
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('parses a US address string into structured components', async () => {
    const auditData = buildAuditData({
      nap_consistency: {
        overall_status: 'major_inconsistencies',
        canonical_name: 'YB Enterprise African Market',
        canonical_phone: '(317) 734-3827',
        canonical_address: '711 E Thompson Rd, Indianapolis, IN 46227',
      },
    });
    const initial = buildCampaign();
    const { updates } = wireMocks(auditData, initial);

    await MarketingHotProspectService.getInstance().syncFromAudit(AUDIT_ID);

    const contactUpdate = updates.find((u) => u.data.address_line1);
    expect(contactUpdate.data).toMatchObject({
      address_line1: '711 E Thompson Rd',
      address_city: 'Indianapolis',
      address_state: 'IN',
      address_zip: '46227',
      address_country: 'US',
    });
  });
});
