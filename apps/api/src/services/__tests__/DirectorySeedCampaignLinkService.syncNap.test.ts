/**
 * syncFromCampaign / buildDiff — name, address, and hours projections.
 *
 * The campaign is the operator-validated identity record (Verify Record /
 * resolveCampaignVerification writes business_name, address_line1/2,
 * address_city/state/zip, business_hours). These projections carry the
 * verified values onto the seed listing — including the sibling surfaces
 * (tenants.name, tenant_business_profiles_list, name_variants, and
 * business_hours_list) the listing alone doesn't cover.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockExecuteRawUnsafe,
  mockFindProvenance,
  mockFindAudits,
  mockHoursUpsert,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockFindProvenance: vi.fn(),
  mockFindAudits: vi.fn(),
  mockHoursUpsert: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    $executeRawUnsafe: mockExecuteRawUnsafe,
    directory_field_provenance: { findMany: mockFindProvenance },
    mkt_audits_list: { findMany: mockFindAudits },
    business_hours_list: { upsert: mockHoursUpsert },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: vi.fn(),
}));

vi.mock('../../utils/business-hours-utils', () => ({
  updateBusinessProfileHours: vi.fn(),
}));

import DirectorySeedCampaignLinkService from '../DirectorySeedCampaignLinkService';

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

const SYNC_ROW = {
  tenant_id: 'ten-1',
  listing_id: 'list-1',
  keywords: [],
  business_name: 'Old Name',
  camp_phone: '555-000-1111',
  camp_website: null,
  camp_business_name: 'Verified Name LLC',
  camp_address_line1: '2605 Independence Ave',
  camp_address_line2: null,
  camp_address_zip: '64124',
  camp_hours: {
    monday: { open: '09:00', close: '17:00', closed: false },
    sunday: { open: null, close: null, closed: true },
    timezone: 'America/Chicago',
  },
  camp_category: 'Grocery Store',
  camp_secondary_categories: [],
  camp_neighborhood: null,
  camp_city: 'Kansas City',
  camp_state: 'MO',
  intelligence_focus: null,
  business_origin_country: null,
  business_origin_region: null,
  directory_profiles: null,
  camp_notes: null,
};

const DIFF_ROW = {
  phone: '555-000-1111',
  website: null,
  primary_category: 'Grocery Store',
  secondary_categories: [],
  description: null,
  keywords: [],
  seed_business_name: 'Old Name',
  seed_address: '100 Old St',
  seed_city: 'Kansas City',
  seed_state: 'MO',
  seed_zip: '64101',
  seed_hours: null,
  ...Object.fromEntries(
    Object.entries(SYNC_ROW).filter(([k]) => k.startsWith('camp_') || k.startsWith('business_origin') || k === 'directory_profiles'),
  ),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(1);
  mockExecuteRawUnsafe.mockResolvedValue(1);
  mockFindProvenance.mockResolvedValue([]);
  mockFindAudits.mockResolvedValue([]);
  mockHoursUpsert.mockResolvedValue({});
});

describe('buildDiff — name/address/hours', () => {
  it('flags verified campaign name, address, and hours as changed', async () => {
    mockQueryRaw.mockResolvedValue([DIFF_ROW]);

    const diff = await DirectorySeedCampaignLinkService.buildDiff('seed-1', 'camp-1');
    const byField = Object.fromEntries(diff.map((d) => [d.field, d]));

    expect(byField.name.campaignValue).toBe('Verified Name LLC');
    expect(byField.name.seedValue).toBe('Old Name');
    expect(byField.name.changed).toBe(true);

    expect(byField.address.campaignValue).toContain('2605 Independence Ave');
    expect(byField.address.campaignValue).toContain('64124');
    expect(byField.address.changed).toBe(true);

    expect(byField.hours.campaignValue).toContain('Mon 09:00–17:00');
    expect(byField.hours.campaignValue).toContain('Sun closed');
    expect(byField.hours.seedValue).toBeNull();
    expect(byField.hours.changed).toBe(true);
  });

  it('marks fields unchanged when campaign values match the seed', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        ...DIFF_ROW,
        seed_business_name: 'Verified Name LLC',
        seed_address: '2605 Independence Ave',
        seed_zip: '64124',
        seed_hours: DIFF_ROW.camp_hours,
      },
    ]);

    const diff = await DirectorySeedCampaignLinkService.buildDiff('seed-1', 'camp-1');
    const byField = Object.fromEntries(diff.map((d) => [d.field, d]));

    expect(byField.name.changed).toBe(false);
    expect(byField.address.changed).toBe(false);
    expect(byField.hours.changed).toBe(false);
  });
});

describe('syncFromCampaign — name/address/hours projection', () => {
  it('projects all three fields and mirrors the sibling surfaces', async () => {
    mockQueryRaw.mockResolvedValue([SYNC_ROW]);

    const res = await DirectorySeedCampaignLinkService.syncFromCampaign(
      'seed-1',
      'camp-1',
      ['name', 'address', 'hours'],
    );

    expect(res.projected).toEqual(['name', 'address', 'hours']);
    expect(res.skipped).toEqual([]);

    // Listing UPDATE carries every projected column.
    const listingUpdate = mockExecuteRawUnsafe.mock.calls.find((c) =>
      sqlText(c[0]).includes('UPDATE directory_listings_list'),
    );
    expect(listingUpdate).toBeTruthy();
    const listingSql = sqlText(listingUpdate![0]);
    expect(listingSql).toContain('business_name = $');
    expect(listingSql).toContain('address = $');
    expect(listingSql).toContain('city = $');
    expect(listingSql).toContain('state = $');
    expect(listingSql).toContain('zip_code = $');
    expect(listingSql).toContain('business_hours = $');
    expect(listingSql).toContain('::jsonb');
    expect(listingUpdate!.slice(1)).toContain('Verified Name LLC');
    expect(listingUpdate!.slice(1)).toContain('2605 Independence Ave');

    // Name mirrors: tenants + business profile + name_variants prepend.
    const rawSql = mockExecuteRaw.mock.calls.map((c) => sqlText(c[0]));
    expect(rawSql.some((q) => q.includes('UPDATE tenants SET name'))).toBe(true);
    expect(rawSql.some((q) => q.includes('array_prepend') && q.includes('name_variants'))).toBe(true);
    expect(
      rawSql.some(
        (q) => q.includes('UPDATE tenant_business_profiles_list') && q.includes('business_name'),
      ),
    ).toBe(true);
    const profileUpdate = mockExecuteRawUnsafe.mock.calls.find((c) =>
      sqlText(c[0]).includes('UPDATE tenant_business_profiles_list'),
    );
    expect(profileUpdate).toBeTruthy();
    expect(sqlText(profileUpdate![0])).toContain('address_line1 = $');

    // Address mirror: seed city/state.
    expect(
      rawSql.some(
        (q) => q.includes('UPDATE directory_presence_seeds') && q.includes('COALESCE'),
      ),
    ).toBe(true);

    // Hours mirror: canonical business_hours_list upsert.
    expect(mockHoursUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: 'ten-1' },
        create: expect.objectContaining({
          timezone: 'America/Chicago',
          periods: [{ day: 'MONDAY', open: '09:00', close: '17:00' }],
        }),
      }),
    );

    // Provenance rows for each projected field.
    const provInserts = mockExecuteRaw.mock.calls.filter((c) =>
      sqlText(c[0]).includes('INSERT INTO directory_field_provenance'),
    );
    expect(provInserts).toHaveLength(3);
  });

  it('skips fields the campaign has no value for', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        ...SYNC_ROW,
        camp_business_name: null,
        camp_address_line1: null,
        camp_address_zip: null,
        camp_city: null,
        camp_state: null,
        camp_hours: null,
      },
    ]);

    const res = await DirectorySeedCampaignLinkService.syncFromCampaign(
      'seed-1',
      'camp-1',
      ['name', 'address', 'hours'],
    );

    expect(res.projected).toEqual([]);
    expect(res.skipped).toEqual(['name', 'address', 'hours']);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    expect(mockHoursUpsert).not.toHaveBeenCalled();
  });
});
