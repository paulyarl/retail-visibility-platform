/**
 * Unit tests for BusinessContextService.getLatestAuditData sibling fallback.
 *
 * A non-primary sibling's business_analysis audit lives on the primary
 * sibling (mirrors getCampaign's audit inheritance). When the sibling has
 * no real BA of its own — none, or only a stub placeholder — the read
 * falls through to the primary sibling's latest real BA.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCampaigns, mockAudits } = vi.hoisted(() => ({
  mockCampaigns: { findUnique: vi.fn(), findMany: vi.fn() },
  mockAudits: { findMany: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaigns,
    mkt_audits_list: mockAudits,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import BusinessContextService from '../deliverable/BusinessContextService';

const realBa = {
  id: 'maud-ba',
  platform: 'business_analysis',
  created_at: '2026-10-03T03:22:28.000Z',
  audit_data: { summary: 'verified audit' },
};
const olderRealBa = {
  id: 'maud-ba-older',
  platform: 'business_analysis',
  created_at: '2026-09-01T00:00:00.000Z',
  audit_data: { summary: 'older verified audit' },
};
const stubBa = {
  id: 'maud-stub',
  platform: 'business_analysis',
  created_at: '2026-10-05T00:00:00.000Z',
  audit_data: { audit_metadata: { source: 'queue_promotion' }, detected_signals: [] },
};

const campaign = (audits: any[], overrides: any = {}) => ({
  id: 'mcamp-sibling',
  scope: 'business',
  business_prospect_id: 'bp-1',
  is_primary_sibling: false,
  mkt_audits_list: audits,
  ...overrides,
});

const siblingRows = [
  { id: 'mcamp-primary', is_primary_sibling: true, created_at: new Date('2026-09-01') },
  { id: 'mcamp-sibling', is_primary_sibling: false, created_at: new Date('2026-10-01') },
];

describe('BusinessContextService.getLatestAuditData — sibling fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls through to the primary sibling BA when the sibling has none', async () => {
    mockCampaigns.findUnique.mockResolvedValue(campaign([]));
    mockCampaigns.findMany.mockResolvedValue(siblingRows);
    mockAudits.findMany.mockResolvedValue([realBa]);

    const result = await BusinessContextService.getLatestAuditData('mcamp-sibling');

    expect(result?.auditId).toBe('maud-ba');
    expect(mockAudits.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ campaign_id: 'mcamp-primary' }),
      }),
    );
  });

  it('returns the sibling own BA without consulting siblings', async () => {
    mockCampaigns.findUnique.mockResolvedValue(campaign([realBa]));

    const result = await BusinessContextService.getLatestAuditData('mcamp-sibling');

    expect(result?.auditId).toBe('maud-ba');
    expect(mockCampaigns.findMany).not.toHaveBeenCalled();
  });

  it('a stub BA on the sibling falls through to the primary real BA', async () => {
    mockCampaigns.findUnique.mockResolvedValue(campaign([stubBa]));
    mockCampaigns.findMany.mockResolvedValue(siblingRows);
    mockAudits.findMany.mockResolvedValue([stubBa, olderRealBa]); // desc: stub is newer

    const result = await BusinessContextService.getLatestAuditData('mcamp-sibling');

    expect(result?.auditId).toBe('maud-ba-older');
  });

  it('returns null for a standalone campaign with no audits', async () => {
    mockCampaigns.findUnique.mockResolvedValue(
      campaign([], { business_prospect_id: null }),
    );

    const result = await BusinessContextService.getLatestAuditData('mcamp-sibling');

    expect(result).toBeNull();
    expect(mockCampaigns.findMany).not.toHaveBeenCalled();
  });
});
