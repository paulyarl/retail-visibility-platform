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

import { MarketIntelService } from '../MarketIntelService';

const service = MarketIntelService.getInstance();

beforeEach(() => {
  mockListing.mockReset();
  mockSeed.mockReset();
  mockCampaignLink.mockReset();
  mockAudit.mockReset();
});

// ─── Slug → audit resolution (§8.4) ──────────────────────────────────────

describe('resolveSeedAuditBySlug (§8.4)', () => {
  it('resolves the full chain to the latest business_analysis audit', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ id: 'seed-1' });
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
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue(null);

    const result = await service.resolveSeedAuditBySlug('some-slug');

    expect(result).toBeNull();
    expect(mockCampaignLink).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('returns null when no campaign link exists for the seed', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ id: 'seed-1' });
    mockCampaignLink.mockResolvedValue(null);

    const result = await service.resolveSeedAuditBySlug('some-slug');

    expect(result).toBeNull();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('returns null when no business_analysis audit exists for the campaign', async () => {
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ id: 'seed-1' });
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
    mockListing.mockResolvedValue({ id: 'listing-1' });
    mockSeed.mockResolvedValue({ id: 'seed-1' });
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
