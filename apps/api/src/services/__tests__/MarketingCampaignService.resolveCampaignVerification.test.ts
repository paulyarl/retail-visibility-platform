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

const {
  mockCampaignsList,
  mockEvidenceCreate,
  mockQueryRaw,
  mockExecuteRaw,
  mockExecuteRawUnsafe,
  mockRefreshReport,
} = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), update: vi.fn() },
  mockEvidenceCreate: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockRefreshReport: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignId: () => 'mkt-test-001',
  generateStageHistoryId: () => 'msh-test-001',
  generateProspectQueueId: () => 'pque-test-001',
  generateDirectoryFieldProvenanceId: (tenantId: string) => `dfp-${tenantId}-001`,
}));

vi.mock('../IdentityEvidenceService', () => ({
  default: { create: mockEvidenceCreate },
}));

vi.mock('../intelligence/SeedIntelligenceReportService', () => ({
  SeedIntelligenceReportService: {
    getInstance: () => ({ refreshReport: mockRefreshReport }),
  },
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
    // No linked seed by default — the back-fill is a no-op.
    mockQueryRaw.mockResolvedValue([]);
    mockExecuteRaw.mockResolvedValue(1);
    mockExecuteRawUnsafe.mockResolvedValue(1);
    mockRefreshReport.mockResolvedValue(undefined);
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

  // ── Seed back-fill (the linked seed's NAP ledger mirrors the campaign's
  //    verified facts — same confirmed/corrected split as the anchor path) ──

  const sql = (call: any[]) => (call[0] as readonly string[]).join('');
  const callsInto = (mock: any, table: string) =>
    mock.mock.calls.filter((c: any[]) => sql(c).includes(table));

  it('back-fills an owner_confirmed verification row when the seed value matches', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ seed_id: 'seed-1' }])
      .mockResolvedValueOnce([{ tenant_id: 'ten-1', listing_id: 'lst-1' }])
      .mockResolvedValueOnce([{ field_key: 'phone', value: '608-555-0100' }]);

    await MarketingCampaignService.resolveCampaignVerification('camp-1', {
      outcome: 'operational',
      verifiedPhone: '608-555-0100',
    });

    const inserts = callsInto(mockExecuteRaw, 'directory_seed_nap_verifications');
    expect(inserts).toHaveLength(1);
    expect(sql(inserts[0])).toContain('FALSE'); // owner_corrected = FALSE
    expect(mockExecuteRaw.mock.calls.some((c) => sql(c).includes('nap_verified_at'))).toBe(true);
    const prov = callsInto(mockExecuteRaw, 'directory_field_provenance');
    expect(prov).toHaveLength(1);
    expect(prov[0].some((a: any) => a === 'owner_confirmed')).toBe(true);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled(); // no correction → listing untouched
    expect(mockRefreshReport).toHaveBeenCalledWith('seed-1');
  });

  it('back-fills an owner_corrected row and syncs the public listing when the value differs', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ seed_id: 'seed-1' }])
      .mockResolvedValueOnce([{ tenant_id: 'ten-1', listing_id: 'lst-1' }])
      .mockResolvedValueOnce([{ field_key: 'phone', value: '608-555-0000' }]);

    await MarketingCampaignService.resolveCampaignVerification('camp-1', {
      outcome: 'operational',
      verifiedPhone: '608-555-0100',
    });

    const inserts = callsInto(mockExecuteRaw, 'directory_seed_nap_verifications');
    expect(inserts).toHaveLength(1);
    expect(sql(inserts[0])).toContain('TRUE'); // owner_corrected = TRUE
    expect(mockExecuteRaw.mock.calls.some((c) => sql(c).includes('nap_owner_corrected'))).toBe(true);
    const prov = callsInto(mockExecuteRaw, 'directory_field_provenance');
    expect(prov).toHaveLength(1);
    expect(prov[0].some((a: any) => a === 'owner_corrected')).toBe(true);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    expect(mockExecuteRawUnsafe.mock.calls[0][0]).toContain('directory_listings_list');
    expect(mockExecuteRawUnsafe.mock.calls[0][0]).toContain('phone');
    expect(mockRefreshReport).toHaveBeenCalledWith('seed-1');
  });

  it('writes no seed verification when the call did not connect', async () => {
    await MarketingCampaignService.resolveCampaignVerification('camp-1', {
      outcome: 'unreachable',
      verifiedPhone: '608-555-0100',
    });
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('writes no seed verification on a wrong_business outcome', async () => {
    await MarketingCampaignService.resolveCampaignVerification('camp-1', {
      outcome: 'wrong_business',
      verifiedPhone: '608-555-0100',
    });
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('skips the back-fill when the campaign has no primary seed link', async () => {
    await MarketingCampaignService.resolveCampaignVerification('camp-1', {
      outcome: 'operational',
      verifiedPhone: '608-555-0100',
    });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1); // link lookup only
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockRefreshReport).not.toHaveBeenCalled();
  });

  it('keeps the campaign update and owner evidence when the back-fill fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('db down'));
    await MarketingCampaignService.resolveCampaignVerification('camp-1', {
      outcome: 'operational',
      verifiedPhone: '608-555-0100',
    });
    expect(mockCampaignsList.update).toHaveBeenCalled();
    expect(mockEvidenceCreate).toHaveBeenCalled();
  });
});
