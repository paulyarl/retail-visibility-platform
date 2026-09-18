/**
 * resolveCampaignVerification — the campaign-scoped record verification.
 *
 * Covers:
 *   - verified NAP is written to the CAMPAIGN record (the canonical)
 *   - the capture is recorded as ATTRIBUTED owner evidence (owner_confirmed)
 *   - nothing verified → neither write happens
 *   - missing campaign → throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCampaignsList, mockEvidenceCreate } = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), update: vi.fn() },
  mockEvidenceCreate: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { mkt_campaigns_list: mockCampaignsList },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignId: () => 'mkt-test-001',
  generateStageHistoryId: () => 'msh-test-001',
  generateProspectQueueId: () => 'pque-test-001',
}));

vi.mock('../IdentityEvidenceService', () => ({
  default: { create: mockEvidenceCreate },
}));

vi.mock('../MarketingCategoryToneService', () => ({
  default: { getPresetByCategory: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: { getLabel: vi.fn().mockResolvedValue(null) },
}));

import MarketingCampaignService from '../MarketingCampaignService';

describe('resolveCampaignVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.findUnique.mockResolvedValue({ id: 'camp-1', business_name: 'Old Name' });
    mockCampaignsList.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'camp-1', ...data }));
    mockEvidenceCreate.mockResolvedValue({ id: 'idev-1' });
  });

  it('writes the verified NAP to the campaign and records attributed owner evidence', async () => {
    await MarketingCampaignService.resolveCampaignVerification('camp-1', {
      outcome: 'operational',
      verifiedName: 'Istanbul Super Market',
      verifiedAddress: '745 S Gammon Rd',
      verifiedPhone: '608-555-0100',
      verifiedOwnerName: 'Maria',
      verifiedOwnerPhone: '608-555-0199',
      callNotes: 'Confirmed hours on the call',
    });

    // NAP → the campaign record (the canonical the packet reads).
    const updateArg = mockCampaignsList.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'camp-1' });
    expect(updateArg.data.business_name).toBe('Istanbul Super Market');
    expect(updateArg.data.address_line1).toBe('745 S Gammon Rd');
    expect(updateArg.data.phone).toBe('608-555-0100');

    // Owner evidence — attributed, owner_confirmed, corroborating the NAP fields.
    expect(mockEvidenceCreate).toHaveBeenCalledTimes(1);
    const ev = mockEvidenceCreate.mock.calls[0][0];
    expect(ev.campaignId).toBe('camp-1');
    expect(ev.evidenceState).toBe('owner_confirmed');
    expect(ev.tier).toBe('first_party');
    expect(ev.corroborates).toEqual(['name', 'address', 'phone']);
    expect(ev.ownerName).toBe('Maria');
    expect(ev.ownerPhone).toBe('608-555-0199');
    expect(ev.notes).toContain('operational');
  });

  it('records owner-only evidence when no NAP field was verified', async () => {
    await MarketingCampaignService.resolveCampaignVerification('camp-1', {
      outcome: 'operational',
      verifiedOwnerName: 'Maria',
    });
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
    expect(mockEvidenceCreate).toHaveBeenCalledTimes(1);
    expect(mockEvidenceCreate.mock.calls[0][0].corroborates).toEqual([]);
  });

  it('records the reason on the evidence row when supplied', async () => {
    await MarketingCampaignService.resolveCampaignVerification('camp-1', {
      outcome: 'operational',
      verifiedAddress: '745 S Gammon Rd',
      reason: 'owner corrected the street number on the call',
    });
    expect(mockEvidenceCreate.mock.calls[0][0].notes).toContain('owner corrected the street number');
  });

  it('does neither write when nothing was verified', async () => {
    await MarketingCampaignService.resolveCampaignVerification('camp-1', { outcome: 'unreachable' });
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
    expect(mockEvidenceCreate).not.toHaveBeenCalled();
  });

  it('throws when the campaign does not exist', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(null);
    await expect(
      MarketingCampaignService.resolveCampaignVerification('nope', { outcome: 'operational' }),
    ).rejects.toThrow();
    expect(mockEvidenceCreate).not.toHaveBeenCalled();
  });
});
