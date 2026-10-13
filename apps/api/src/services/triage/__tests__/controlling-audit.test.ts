/**
 * controlling-audit — the write path behind
 * PUT /prospects/:prospectId/controlling-audit (migration 333).
 *
 * Covers: prospect-group resolution (members, singleton fallbacks),
 * business_analysis-only + in-group membership validation, and the
 * clear-then-set transaction that keeps one pin per prospect.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockCampaignsList, mockAuditsList, mockTransaction } = vi.hoisted(() => ({
  mockCampaignsList: { findMany: vi.fn(), findUnique: vi.fn() },
  mockAuditsList: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  mockTransaction: vi.fn(),
}));

vi.mock('../../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_audits_list: mockAuditsList,
    $transaction: mockTransaction,
  },
  // Writes go through basePrisma (unwrapped client — the retry proxy's
  // plain Promises are rejected by the array form of $transaction).
  basePrisma: {
    mkt_audits_list: mockAuditsList,
    $transaction: mockTransaction,
  },
}));

import { setControllingAuditForProspect } from '../controlling-audit';

const BA_AUDIT = { campaign_id: 'c-a', platform: 'business_analysis' };

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockResolvedValue([]);
  mockCampaignsList.findMany.mockResolvedValue([{ id: 'c-a' }, { id: 'c-b' }]);
  mockAuditsList.findUnique.mockResolvedValue(BA_AUDIT);
});

describe('setControllingAuditForProspect', () => {
  it('pins an in-group business_analysis audit — clear-then-set in one transaction', async () => {
    const res = await setControllingAuditForProspect({ prospectId: 'bp-1', auditId: 'maud-1' });
    expect(res).toEqual({ ok: true, controllingAuditId: 'maud-1' });
    expect(mockAuditsList.updateMany).toHaveBeenCalledWith({
      where: { campaign_id: { in: ['c-a', 'c-b'] } },
      data: { is_controlling: false },
    });
    expect(mockAuditsList.update).toHaveBeenCalledWith({
      where: { id: 'maud-1' },
      data: { is_controlling: true },
    });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // Both writes went through the SAME transaction call.
    expect(mockTransaction.mock.calls[0][0]).toHaveLength(2);
  });

  it('clears the pin when auditId is null — updateMany only', async () => {
    const res = await setControllingAuditForProspect({ prospectId: 'bp-1', auditId: null });
    expect(res).toEqual({ ok: true, controllingAuditId: null });
    expect(mockAuditsList.updateMany).toHaveBeenCalledTimes(1);
    expect(mockAuditsList.update).not.toHaveBeenCalled();
    expect(mockTransaction.mock.calls[0][0]).toHaveLength(1);
    // No audit validation needed on a clear.
    expect(mockAuditsList.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an audit outside the prospect group', async () => {
    mockAuditsList.findUnique.mockResolvedValue({ campaign_id: 'c-other', platform: 'business_analysis' });
    const res = await setControllingAuditForProspect({ prospectId: 'bp-1', auditId: 'maud-x' });
    expect(res).toMatchObject({ ok: false, status: 404, error: 'not_found' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects a non-business_analysis audit', async () => {
    mockAuditsList.findUnique.mockResolvedValue({ campaign_id: 'c-a', platform: 'gold_standard_scan' });
    const res = await setControllingAuditForProspect({ prospectId: 'bp-1', auditId: 'maud-x' });
    expect(res).toMatchObject({ ok: false, status: 400, error: 'invalid_audit' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects a missing audit', async () => {
    mockAuditsList.findUnique.mockResolvedValue(null);
    const res = await setControllingAuditForProspect({ prospectId: 'bp-1', auditId: 'maud-x' });
    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it('404s when the prospect has no campaigns', async () => {
    mockCampaignsList.findMany.mockResolvedValue([]);
    mockCampaignsList.findUnique.mockResolvedValue(null);
    const res = await setControllingAuditForProspect({ prospectId: 'bp-none', auditId: 'maud-1' });
    expect(res).toMatchObject({ ok: false, status: 404 });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('singleton fallback — campaignId query pins within a one-campaign group', async () => {
    mockAuditsList.findUnique.mockResolvedValue({ campaign_id: 'c-solo', platform: 'business_analysis' });
    const res = await setControllingAuditForProspect({
      prospectId: 'ignored',
      campaignId: 'c-solo',
      auditId: 'maud-1',
    });
    expect(res).toEqual({ ok: true, controllingAuditId: 'maud-1' });
    // Membership checked against the singleton only.
    expect(mockAuditsList.updateMany).toHaveBeenCalledWith({
      where: { campaign_id: { in: ['c-solo'] } },
      data: { is_controlling: false },
    });
  });

  it('singleton fallback — prospectId that is itself a campaign id', async () => {
    mockCampaignsList.findMany.mockResolvedValue([]);
    mockCampaignsList.findUnique.mockResolvedValue({ id: 'mcamp-solo' });
    mockAuditsList.findUnique.mockResolvedValue({ campaign_id: 'mcamp-solo', platform: 'business_analysis' });
    const res = await setControllingAuditForProspect({ prospectId: 'mcamp-solo', auditId: 'maud-1' });
    expect(res).toEqual({ ok: true, controllingAuditId: 'maud-1' });
    expect(mockAuditsList.updateMany).toHaveBeenCalledWith({
      where: { campaign_id: { in: ['mcamp-solo'] } },
      data: { is_controlling: false },
    });
  });
});
