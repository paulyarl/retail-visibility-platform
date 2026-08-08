/**
 * GalleryMultiService — multi-gallery data assembly tests
 *
 * Tests:
 *   - assembleMultiGallery: assembles data from eligible siblings
 *   - Filters siblings at preview_built/shown only
 *   - Excludes paid/delivered siblings (via stage filter)
 *   - Includes archetype-aware defaults per sibling
 *   - Primary sibling is first in the list
 *   - Returns null when no eligible siblings
 *   - checkEligibility: gates on stage + screenshots
 *
 * Spec: docs/LocalBiz/marketing_ops_multi_archetype_campaign_sprint_plan.md
 * Sprint 2 — S2.12.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockFilesList,
} = vi.hoisted(() => ({
  mockCampaignsList: { findMany: vi.fn() },
  mockFilesList: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_files_list: mockFilesList,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock resolveCampaignArchetype — returns A3 by default
vi.mock('../OutreachOpenerService', () => ({
  resolveCampaignArchetype: vi.fn().mockResolvedValue({
    archetype: 'A3',
    source: 'triage',
    reason: 'triage-accepted: A3',
  }),
}));

// Mock GalleryArchetypeDefaults — pure function, no need to mock
// Mock supabase storage — return null signed URLs (no Supabase in test env)
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: new Error('no supabase') }),
      }),
    },
  }),
}));

vi.mock('../../storage-config', () => ({
  StorageBuckets: { DISPUTES: { name: 'disputes' } },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    supabaseUrl: null,
    supabaseServiceRoleKey: null,
  },
}));

import { GalleryMultiService } from '../marketing/GalleryMultiService';

// ─── Fixtures ────────────────────────────────────────────────────────────

const makeCampaign = (overrides: any = {}) => ({
  id: 'mkt-001',
  business_prospect_id: 'bp-test001',
  scope: 'business',
  business_name: 'Test Biz',
  stage: 'preview_built',
  is_primary_sibling: true,
  estimated_fee_cents: 19900,
  created_at: new Date('2025-01-01'),
  ...overrides,
});

const makeScreenshot = (id: string) => ({
  id,
  file_name: `screenshot-${id}.png`,
  storage_path: `screenshots/${id}.png`,
  mime_type: 'image/png',
  file_size: 102400,
  uploaded_at: new Date('2025-01-02'),
});

// ─── assembleMultiGallery ────────────────────────────────────────────────

describe('assembleMultiGallery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assembles multi-gallery data from eligible siblings', async () => {
    const sibling1 = makeCampaign({ id: 'mkt-001', is_primary_sibling: true });
    const sibling2 = makeCampaign({ id: 'mkt-002', is_primary_sibling: false, stage: 'shown' });
    mockCampaignsList.findMany.mockResolvedValue([sibling1, sibling2]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    expect(result!.prospectId).toBe('bp-test001');
    expect(result!.businessName).toBe('Test Biz');
    expect(result!.siblings.length).toBe(2);
    expect(result!.payUrl).toBe('/marketing/pay?prospect=bp-test001');
  });

  it('filters siblings at preview_built/shown only', async () => {
    const eligible = makeCampaign({ id: 'mkt-001', stage: 'preview_built' });
    const ineligible = makeCampaign({ id: 'mkt-002', stage: 'delivered', is_primary_sibling: false });
    mockCampaignsList.findMany.mockResolvedValue([eligible, ineligible]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    expect(result!.siblings.length).toBe(1);
    expect(result!.siblings[0].campaignId).toBe('mkt-001');
  });

  it('excludes siblings without screenshots', async () => {
    const withScreenshots = makeCampaign({ id: 'mkt-001' });
    const withoutScreenshots = makeCampaign({ id: 'mkt-002', is_primary_sibling: false });
    mockCampaignsList.findMany.mockResolvedValue([withScreenshots, withoutScreenshots]);
    mockFilesList.findMany
      .mockResolvedValueOnce([makeScreenshot('s1')]) // for mkt-001
      .mockResolvedValueOnce([]); // for mkt-002

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    expect(result!.siblings.length).toBe(1);
    expect(result!.siblings[0].campaignId).toBe('mkt-001');
  });

  it('primary sibling is first in the list', async () => {
    const nonPrimary = makeCampaign({ id: 'mkt-001', is_primary_sibling: false, created_at: new Date('2025-01-01') });
    const primary = makeCampaign({ id: 'mkt-002', is_primary_sibling: true, created_at: new Date('2025-01-02') });
    mockCampaignsList.findMany.mockResolvedValue([nonPrimary, primary]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    expect(result!.siblings[0].campaignId).toBe('mkt-002'); // primary first
    expect(result!.siblings[0].isPrimarySibling).toBe(true);
  });

  it('includes archetype-aware defaults per sibling', async () => {
    mockCampaignsList.findMany.mockResolvedValue([makeCampaign()]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    const section = result!.siblings[0];
    expect(section.archetype).toBe('A3');
    expect(section.galleryTitle).toBe('Listing Accuracy Diagnostic');
    expect(section.gallerySubtitle).toBe('Your business info is inconsistent across platforms.');
    expect(section.ctaLabel).toBe('Fix My Listings');
    expect(section.frictionSummary.pain).toBe('nap_inconsistency');
  });

  it('returns null when no siblings exist', async () => {
    mockCampaignsList.findMany.mockResolvedValue([]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-empty');

    expect(result).toBeNull();
  });

  it('returns null when no siblings are at eligible stages', async () => {
    mockCampaignsList.findMany.mockResolvedValue([
      makeCampaign({ stage: 'delivered' }),
      makeCampaign({ id: 'mkt-002', stage: 'lost', is_primary_sibling: false }),
    ]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).toBeNull();
  });

  it('returns null when all siblings lack screenshots', async () => {
    mockCampaignsList.findMany.mockResolvedValue([makeCampaign()]);
    mockFilesList.findMany.mockResolvedValue([]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).toBeNull();
  });
});

// ─── checkEligibility ────────────────────────────────────────────────────

describe('checkEligibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns eligible=true when at least 1 sibling has screenshots at preview_built/shown', async () => {
    mockCampaignsList.findMany.mockResolvedValue([
      makeCampaign({ id: 'mkt-001', stage: 'preview_built' }),
    ]);
    mockFilesList.count.mockResolvedValue(3);

    const result = await GalleryMultiService.getInstance().checkEligibility('bp-test001');

    expect(result.eligible).toBe(true);
    expect(result.siblingCount).toBe(1);
    expect(result.eligibleCount).toBe(1);
  });

  it('returns eligible=false when siblings exist but none at eligible stage', async () => {
    mockCampaignsList.findMany.mockResolvedValue([
      makeCampaign({ id: 'mkt-001', stage: 'delivered' }),
    ]);

    const result = await GalleryMultiService.getInstance().checkEligibility('bp-test001');

    expect(result.eligible).toBe(false);
    expect(result.siblingCount).toBe(1);
    expect(result.eligibleCount).toBe(0);
  });

  it('returns eligible=false when siblings at eligible stage but no screenshots', async () => {
    mockCampaignsList.findMany.mockResolvedValue([
      makeCampaign({ id: 'mkt-001', stage: 'preview_built' }),
    ]);
    mockFilesList.count.mockResolvedValue(0);

    const result = await GalleryMultiService.getInstance().checkEligibility('bp-test001');

    expect(result.eligible).toBe(false);
    expect(result.eligibleCount).toBe(0);
  });

  it('returns eligible=false when no siblings exist', async () => {
    mockCampaignsList.findMany.mockResolvedValue([]);

    const result = await GalleryMultiService.getInstance().checkEligibility('bp-empty');

    expect(result.eligible).toBe(false);
    expect(result.siblingCount).toBe(0);
  });
});

// ─── Completed siblings (badge of honor — §8.3, §8.4) ────────────────────

describe('assembleMultiGallery — completed siblings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes completed siblings (paid/delivered) in completedSiblings', async () => {
    const active = makeCampaign({ id: 'mkt-001', stage: 'preview_built', is_primary_sibling: true });
    const completed = makeCampaign({
      id: 'mkt-002',
      stage: 'delivered',
      is_primary_sibling: false,
      date_delivered: new Date('2025-01-15'),
      date_paid: new Date('2025-01-10'),
      engagement_cycle: 1,
    });
    mockCampaignsList.findMany.mockResolvedValue([active, completed]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    expect(result!.siblings.length).toBe(1); // active only
    expect(result!.completedSiblings.length).toBe(1);
    expect(result!.completedSiblings[0].campaignId).toBe('mkt-002');
    expect(result!.completedSiblings[0].stage).toBe('delivered');
    expect(result!.completedSiblings[0].archetype).toBe('A3');
    expect(result!.completedSiblings[0].galleryTitle).toBe('Listing Accuracy Diagnostic');
  });

  it('does not include completed siblings in the active siblings list', async () => {
    const active = makeCampaign({ id: 'mkt-001', stage: 'shown' });
    const completed = makeCampaign({ id: 'mkt-002', stage: 'paid', is_primary_sibling: false });
    mockCampaignsList.findMany.mockResolvedValue([active, completed]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    expect(result!.siblings.length).toBe(1);
    expect(result!.siblings[0].campaignId).toBe('mkt-001');
    expect(result!.completedSiblings.length).toBe(1);
    expect(result!.completedSiblings[0].campaignId).toBe('mkt-002');
  });

  it('sorts completed siblings by datePaid desc (most recent first)', async () => {
    const active = makeCampaign({ id: 'mkt-001', stage: 'preview_built' });
    const older = makeCampaign({
      id: 'mkt-002',
      stage: 'delivered',
      is_primary_sibling: false,
      date_paid: new Date('2025-01-01'),
    });
    const newer = makeCampaign({
      id: 'mkt-003',
      stage: 'delivered',
      is_primary_sibling: false,
      date_paid: new Date('2025-02-01'),
    });
    mockCampaignsList.findMany.mockResolvedValue([active, older, newer]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    expect(result!.completedSiblings.length).toBe(2);
    expect(result!.completedSiblings[0].campaignId).toBe('mkt-003'); // newer first
    expect(result!.completedSiblings[1].campaignId).toBe('mkt-002');
  });

  it('returns empty completedSiblings when no siblings are converted', async () => {
    mockCampaignsList.findMany.mockResolvedValue([makeCampaign({ stage: 'preview_built' })]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    expect(result!.completedSiblings).toEqual([]);
  });

  it('still returns null if no active siblings exist even with completed siblings', async () => {
    const completed = makeCampaign({ id: 'mkt-002', stage: 'delivered', is_primary_sibling: false });
    mockCampaignsList.findMany.mockResolvedValue([completed]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).toBeNull(); // no active siblings → nothing to show in gallery
  });

  it('includes retainer_won siblings in completedSiblings', async () => {
    const active = makeCampaign({ id: 'mkt-001', stage: 'shown' });
    const retainerWon = makeCampaign({
      id: 'mkt-002',
      stage: 'retainer_won',
      is_primary_sibling: false,
      date_paid: new Date('2025-01-10'),
    });
    mockCampaignsList.findMany.mockResolvedValue([active, retainerWon]);
    mockFilesList.findMany.mockResolvedValue([makeScreenshot('s1')]);

    const result = await GalleryMultiService.getInstance().assembleMultiGallery('bp-test001');

    expect(result).not.toBeNull();
    expect(result!.completedSiblings.length).toBe(1);
    expect(result!.completedSiblings[0].stage).toBe('retainer_won');
  });
});
