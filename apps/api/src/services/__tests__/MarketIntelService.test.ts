/**
 * MarketIntelService tests — Phase 0.
 * docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md (§8.4, §8.5.4)
 *
 * Covers:
 * - Slug→audit resolution chain (§8.4): full chain resolves; missing
 *   listing / seed / campaign link / audit each return null (not throw).
 * - Fallback derivation (§8.5.4): market_opportunities drives count when
 *   present; gap_analysis.gaps fallback when structured array absent;
 *   signal_checklist absent → readSignalChecklist returns null (card
 *   `available: false`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockListing, mockSeed, mockCampaignLink, mockAudit } = vi.hoisted(() => ({
  mockListing: vi.fn(),
  mockSeed: vi.fn(),
  mockCampaignLink: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    directory_listings_list: { findFirst: mockListing },
    directory_presence_seeds: { findUnique: mockSeed },
    directory_seed_campaign_links: { findFirst: mockCampaignLink },
    mkt_audits_list: { findFirst: mockAudit },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockLoadMarketContext } = vi.hoisted(() => ({
  mockLoadMarketContext: vi.fn(),
}));

vi.mock('../intelligence/MarketContextLoader', () => ({
  MarketContextLoader: {
    getInstance: () => ({ loadMarketContext: mockLoadMarketContext }),
  },
}));

import { MarketIntelService } from '../MarketIntelService';

const service = MarketIntelService.getInstance();

beforeEach(() => {
  mockListing.mockReset();
  mockSeed.mockReset();
  mockCampaignLink.mockReset();
  mockAudit.mockReset();
  mockLoadMarketContext.mockReset();
  mockLoadMarketContext.mockResolvedValue({ category: {}, location: {} });
});

// ─── Slug → audit resolution (§8.4) ──────────────────────────────────────

describe('resolveSeedAuditBySlug (§8.4)', () => {
  it('resolves the full chain to the latest business_analysis audit', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'African Grocery Store' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'African Grocery Store', city: 'Indianapolis', state: 'IN' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    const later = new Date('2026-09-10');
    const earlier = new Date('2026-09-01');
    mockAudit.mockResolvedValue({
      id: 'audit-2',
      campaign_id: 'camp-1',
      audit_data: { summary: 'latest' },
      created_at: later,
    });

    const result = await service.resolveSeedAuditBySlug('african-grocery-indianapolis');

    expect(result).not.toBeNull();
    expect(result!.auditId).toBe('audit-2');
    expect(result!.campaignId).toBe('camp-1');
    expect(result!.seedId).toBe('seed-1');
    expect(result!.listingId).toBe('listing-1');
    expect(result!.businessName).toBe('African Grocery Store');
    expect(result!.category).toBe('African Grocery Store');
    expect(result!.city).toBe('Indianapolis');
    expect(result!.state).toBe('IN');
    expect(result!.auditData).toEqual({ summary: 'latest' });
    expect(result!.createdAt).toEqual(later);

    // Audit query must filter by business_analysis platform + order by recency.
    expect(mockAudit).toHaveBeenCalledWith({
      where: { campaign_id: 'camp-1', platform: 'business_analysis' },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        campaign_id: true,
        audit_data: true,
        created_at: true,
      },
    });
  });

  it('returns null when the listing is missing (slug not found)', async () => {
    mockListing.mockResolvedValue(null);

    const result = await service.resolveSeedAuditBySlug('no-such-slug');

    expect(result).toBeNull();
    // Chain short-circuits — no further queries.
    expect(mockSeed).not.toHaveBeenCalled();
    expect(mockCampaignLink).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('returns null when the seed is missing (listing has no presence seed)', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test' });
    mockSeed.mockResolvedValue(null);

    const result = await service.resolveSeedAuditBySlug('some-slug');

    expect(result).toBeNull();
    expect(mockCampaignLink).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('returns null when no campaign link exists for the seed', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue(null);

    const result = await service.resolveSeedAuditBySlug('some-slug');

    expect(result).toBeNull();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('returns null when no business_analysis audit exists for the campaign', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue(null);

    const result = await service.resolveSeedAuditBySlug('some-slug');

    expect(result).toBeNull();
  });

  it('returns null for an empty slug (no query issued)', async () => {
    const result = await service.resolveSeedAuditBySlug('');

    expect(result).toBeNull();
    expect(mockListing).not.toHaveBeenCalled();
  });

  it('prefers a primary campaign link over a secondary one', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-primary' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-primary',
      audit_data: null,
      created_at: new Date('2026-09-01'),
    });

    await service.resolveSeedAuditBySlug('some-slug');

    // Link query orders by link_role asc so 'primary' sorts before 'secondary'.
    expect(mockCampaignLink).toHaveBeenCalledWith({
      where: { seed_id: 'seed-1' },
      orderBy: [{ link_role: 'asc' }],
      select: { campaign_id: true },
    });
  });
});

// ─── Fallback derivation (§8.5.4) ────────────────────────────────────────

describe('deriveOpportunityCount (§8.5.4 fallback)', () => {
  it('uses market_opportunities.length when the structured array is present', () => {
    const auditData = {
      market_opportunities: [
        { title: 'No website', impact: 'HIGH' },
        { title: 'Limited hours', impact: 'MEDIUM' },
        { title: 'South side demand', impact: 'HIGH' },
      ],
    };

    const result = service.deriveOpportunityCount(auditData);

    expect(result).toEqual({ count: 3, fromStructured: true });
  });

  it('falls back to gap_analysis.gaps.length when market_opportunities is absent', () => {
    const auditData = {
      gap_analysis: {
        gaps: [
          { field: 'website_present', severity: 'non_negotiable' },
          { field: 'hours_present', severity: 'recommended' },
        ],
      },
    };

    const result = service.deriveOpportunityCount(auditData);

    expect(result).toEqual({ count: 2, fromStructured: false });
  });

  it('returns 0 when neither market_opportunities nor gap_analysis is present', () => {
    const auditData = { summary: 'no opportunities or gaps' };

    const result = service.deriveOpportunityCount(auditData);

    expect(result).toEqual({ count: 0, fromStructured: false });
  });

  it('returns 0 when auditData is null', () => {
    const result = service.deriveOpportunityCount(null);

    expect(result).toEqual({ count: 0, fromStructured: false });
  });

  it('prefers market_opportunities even when gap_analysis also exists', () => {
    const auditData = {
      market_opportunities: [{ title: 'A', impact: 'HIGH' }],
      gap_analysis: { gaps: [{ field: 'x' }, { field: 'y' }, { field: 'z' }] },
    };

    const result = service.deriveOpportunityCount(auditData);

    expect(result).toEqual({ count: 1, fromStructured: true });
  });

  it('treats a non-array market_opportunities as absent and falls back', () => {
    const auditData = {
      market_opportunities: 'not-an-array',
      gap_analysis: { gaps: [{ field: 'x' }] },
    };

    const result = service.deriveOpportunityCount(auditData);

    expect(result).toEqual({ count: 1, fromStructured: false });
  });
});

// ─── Signal checklist reader (§8.5.4 — card availability) ─────────────────

describe('readSignalChecklist (§8.5.4 card availability)', () => {
  it('returns the checklist array when present', () => {
    const auditData = {
      signal_checklist: [
        { signal: 'Published hours', met: true, evidence: 'GBP hours current' },
        { signal: 'No website', met: false, evidence: null },
      ],
    };

    const result = service.readSignalChecklist(auditData);

    expect(result).toEqual([
      { signal: 'Published hours', met: true, evidence: 'GBP hours current' },
      { signal: 'No website', met: false, evidence: null },
    ]);
  });

  it('returns null when signal_checklist is absent (card renders available: false)', () => {
    const auditData = { summary: 'no checklist' };

    const result = service.readSignalChecklist(auditData);

    expect(result).toBeNull();
  });

  it('returns null when auditData is null', () => {
    const result = service.readSignalChecklist(null);

    expect(result).toBeNull();
  });

  it('returns null when signal_checklist is not an array', () => {
    const auditData = { signal_checklist: 'not-an-array' };

    const result = service.readSignalChecklist(auditData);

    expect(result).toBeNull();
  });
});

// ─── getTeaserSummary (§4.1) ──────────────────────────────────────────────

describe('getTeaserSummary (§4.1)', () => {
  it('returns hasAudit:false when the resolution chain breaks', async () => {
    mockListing.mockResolvedValue(null);

    const result = await service.getTeaserSummary('no-such-slug');

    expect(result.hasAudit).toBe(false);
    expect(result.businessName).toBeNull();
    expect(result.cards.growthOpportunities.available).toBe(false);
    expect(result.cards.howItStacksUp.available).toBe(false);
    expect(result.cards.fullReport.available).toBe(false);
    // Claim card always available.
    expect(result.cards.claimBusiness.available).toBe(true);
  });

  it('returns the full teaser payload when audit + structured fields exist', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'African Grocery Store' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'African Grocery Store', city: 'Indianapolis', state: 'IN' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-1',
      audit_data: {
        market_opportunities: [
          { title: 'No website', impact: 'HIGH' },
          { title: 'Limited hours', impact: 'MEDIUM' },
          { title: 'South side demand', impact: 'HIGH' },
        ],
        signal_checklist: [
          { signal: 'Published hours', met: true, evidence: 'GBP hours current' },
          { signal: 'Clear category positioning', met: true, evidence: null },
          { signal: 'Community presence', met: true, evidence: null },
          { signal: 'NAP consistency', met: true, evidence: null },
          { signal: 'No website', met: false, evidence: null },
          { signal: 'Below review volume', met: false, evidence: null },
        ],
      },
      created_at: new Date('2026-09-10'),
    });

    const result = await service.getTeaserSummary('african-grocery-indianapolis');

    expect(result.businessSlug).toBe('african-grocery-indianapolis');
    expect(result.businessName).toBe('African Grocery Store');
    expect(result.hasAudit).toBe(true);
    expect(result.cards.growthOpportunities).toEqual({
      available: true,
      teaser: '3 actionable gaps identified',
      count: 3,
    });
    expect(result.cards.howItStacksUp).toEqual({
      available: true,
      teaser: 'Meets 4 of 6 category signals',
    });
    expect(result.cards.fullReport.available).toBe(true);
    expect(result.cards.claimBusiness.available).toBe(true);
  });

  it('uses gap_analysis fallback when market_opportunities is absent', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test Biz' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-1',
      audit_data: {
        gap_analysis: { gaps: [{ field: 'website_present', severity: 'non_negotiable' }] },
      },
      created_at: new Date('2026-09-01'),
    });

    const result = await service.getTeaserSummary('some-slug');

    expect(result.cards.growthOpportunities).toEqual({
      available: true,
      teaser: '1 actionable gap identified',
      count: 1,
    });
  });

  it('renders howItStacksUp available:false when signal_checklist is absent', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test Biz' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-1',
      audit_data: { summary: 'no checklist, no opportunities' },
      created_at: new Date('2026-09-01'),
    });

    const result = await service.getTeaserSummary('some-slug');

    expect(result.cards.howItStacksUp.available).toBe(false);
    expect(result.cards.howItStacksUp.teaser).toBe('Category signal evaluation pending');
    // Growth opportunities also unavailable (count 0).
    expect(result.cards.growthOpportunities.available).toBe(false);
    expect(result.cards.growthOpportunities.teaser).toBe('0 actionable gaps identified');
  });

  it('loads market context via MarketContextLoader with seed category/city/state', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test Biz' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'African Grocery Store', city: 'Indianapolis', state: 'IN' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-1',
      audit_data: { market_opportunities: [{ title: 'A', impact: 'HIGH' }] },
      created_at: new Date('2026-09-01'),
    });

    await service.getTeaserSummary('some-slug');

    expect(mockLoadMarketContext).toHaveBeenCalledWith('African Grocery Store', 'Indianapolis', 'IN');
  });
});

// ─── getPartialContent (§4.2) ────────────────────────────────────────────

describe('getPartialContent (§4.2)', () => {
  it('returns hasAudit:false when the resolution chain breaks', async () => {
    mockListing.mockResolvedValue(null);

    const result = await service.getPartialContent('no-such-slug', 'cust-1');

    expect(result.hasAudit).toBe(false);
    expect(result.growthOpportunities.available).toBe(false);
    expect(result.growthOpportunities.items).toEqual([]);
    expect(result.howItStacksUp.available).toBe(false);
    expect(result.howItStacksUp.signals).toEqual([]);
  });

  it('returns top 2 opportunities unlocked, rest locked', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-1',
      audit_data: {
        market_opportunities: [
          { title: 'No website', impact: 'HIGH' },
          { title: 'Limited hours', impact: 'MEDIUM' },
          { title: 'South side demand', impact: 'HIGH' },
        ],
      },
      created_at: new Date('2026-09-01'),
    });

    const result = await service.getPartialContent('some-slug', 'cust-1');

    expect(result.hasAudit).toBe(true);
    expect(result.growthOpportunities.available).toBe(true);
    expect(result.growthOpportunities.items).toHaveLength(3);
    expect(result.growthOpportunities.items[0]).toEqual({ title: 'No website', impact: 'HIGH', locked: false });
    expect(result.growthOpportunities.items[1]).toEqual({ title: 'Limited hours', impact: 'MEDIUM', locked: false });
    expect(result.growthOpportunities.items[2]).toEqual({ title: 'South side demand', impact: 'HIGH', locked: true });
    expect(result.growthOpportunities.lockedCount).toBe(1);
  });

  it('falls back to gap_analysis.gaps when market_opportunities is absent', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-1',
      audit_data: {
        gap_analysis: {
          gaps: [
            { field: 'website_present', severity: 'non_negotiable' },
            { field: 'hours_coverage', severity: 'recommended' },
          ],
        },
      },
      created_at: new Date('2026-09-01'),
    });

    const result = await service.getPartialContent('some-slug', 'cust-1');

    expect(result.growthOpportunities.available).toBe(true);
    expect(result.growthOpportunities.items).toHaveLength(2);
    expect(result.growthOpportunities.items[0]).toEqual({ title: 'website_present', impact: 'HIGH', locked: false });
    expect(result.growthOpportunities.items[1]).toEqual({ title: 'hours_coverage', impact: 'MEDIUM', locked: false });
    expect(result.growthOpportunities.lockedCount).toBe(0);
  });

  it('returns full signal checklist for howItStacksUp', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-1',
      audit_data: {
        signal_checklist: [
          { signal: 'Published hours', met: true, evidence: null },
          { signal: 'No website', met: false, evidence: null },
        ],
      },
      created_at: new Date('2026-09-01'),
    });

    const result = await service.getPartialContent('some-slug', 'cust-1');

    expect(result.howItStacksUp.available).toBe(true);
    expect(result.howItStacksUp.signals).toEqual([
      { signal: 'Published hours', met: true },
      { signal: 'No website', met: false },
    ]);
  });

  it('renders howItStacksUp available:false when signal_checklist is absent', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-1',
      audit_data: { summary: 'no checklist' },
      created_at: new Date('2026-09-01'),
    });

    const result = await service.getPartialContent('some-slug', 'cust-1');

    expect(result.howItStacksUp.available).toBe(false);
    expect(result.howItStacksUp.signals).toEqual([]);
  });

  it('renders growthOpportunities available:false when no opportunities and no gaps', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1', business_name: 'Test' });
    mockSeed.mockResolvedValue({ id: 'seed-1', category: 'Cat', city: 'City', state: 'ST' });
    mockCampaignLink.mockResolvedValue({ campaign_id: 'camp-1' });
    mockAudit.mockResolvedValue({
      id: 'audit-1',
      campaign_id: 'camp-1',
      audit_data: { summary: 'nothing' },
      created_at: new Date('2026-09-01'),
    });

    const result = await service.getPartialContent('some-slug', 'cust-1');

    expect(result.growthOpportunities.available).toBe(false);
    expect(result.growthOpportunities.items).toEqual([]);
    expect(result.growthOpportunities.lockedCount).toBe(0);
  });
});
