/**
 * Unit tests for ProspectAttributionService (migration 317 —
 * mkt_discovery_attributions child rows).
 *
 *   1. Pure merge helpers — union-by-key on signals / provenance /
 *      bronze_attribution / competitive_weaknesses; basis fill (never
 *      overwrite), insertion-order preservation.
 *   2. mergeDiscoveryContexts — scalar precedence (first non-null wins),
 *      array unions, empty-merge → null (validateDiscoveryContext rule).
 *   3. recordAttribution — create on first sight, merge into the existing
 *      row when the same source scan re-attributes the same target.
 *   4. resolveForCampaign — merges own snapshot + sibling contexts +
 *      canonical child rows; null → empty render preserved.
 *   5. propagateFromScanAudit — matches candidates to existing queue rows /
 *      business campaigns by name+city; skips unmatched candidates.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAttributions,
  mockCampaigns,
  mockQueue,
  mockAudits,
} = vi.hoisted(() => ({
  mockAttributions: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mockCampaigns: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  mockQueue: {
    findMany: vi.fn(),
  },
  mockAudits: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_discovery_attributions: mockAttributions,
    mkt_campaigns_list: mockCampaigns,
    mkt_prospect_queue: mockQueue,
    mkt_audits_list: mockAudits,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateDiscoveryAttributionId: () => 'dattr-test001',
}));

import {
  ProspectAttributionService,
  unionSignals,
  unionProvenance,
  unionBronze,
  unionWeaknesses,
  mergeDiscoveryContexts,
} from '../ProspectAttributionService';

const service = ProspectAttributionService.getInstance();

const emergingCtx = {
  focus: 'emerging' as const,
  discovered_at: '2026-09-11T00:00:00Z',
  business_seek_priority: 'high' as const,
  category_fit: 'verified' as const,
  identity_confidence: 'high' as const,
  location_status: 'inside_city',
  source_category: 'African Grocery Store',
  discovery_signals: ['INT_COMMUNITY_DIRECTORY'],
  discovery_provenance: [
    { source: 'Community Directory', role: 'primary', evidence_types: ['listing'] },
  ],
};

const competitiveCtx = {
  focus: 'competitive' as const,
  discovered_at: '2026-09-30T00:00:00Z',
  discovery_signals: ['INT_POSSIBLE_CATEGORY_MISALIGNMENT'],
  bronze_attribution: [
    { reason_key: 'thin_web_presence', basis: 'found via customs records' },
  ],
  competitive_weaknesses: [
    { weakness_key: 'nap_drift', basis: 'address differs across directories' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAttributions.findMany.mockResolvedValue([]);
  mockAttributions.findFirst.mockResolvedValue(null);
  mockAttributions.create.mockImplementation(async ({ data }: any) => ({ id: data.id, ...data }));
  mockAttributions.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
  mockCampaigns.findMany.mockResolvedValue([]);
  mockQueue.findMany.mockResolvedValue([]);
  mockAudits.findUnique.mockResolvedValue(null);
});

// ─── Union helpers ──────────────────────────────────────────────────────

describe('union helpers', () => {
  it('unionSignals dedupes and preserves insertion order', () => {
    expect(unionSignals(['INT_A', 'INT_B'], ['INT_B', 'INT_C']))
      .toEqual(['INT_A', 'INT_B', 'INT_C']);
  });

  it('unionProvenance dedupes on source+role+url', () => {
    const a = [{ source: 'Dir A', role: 'primary', url: 'https://a' }];
    const b = [
      { source: 'Dir A', role: 'primary', url: 'https://a' },   // dupe
      { source: 'Dir B', role: 'secondary', url: 'https://b' }, // new
    ];
    expect(unionProvenance(a, b)).toHaveLength(2);
  });

  it('unionBronze dedupes on reason_key and fills a missing basis only', () => {
    const a = [{ reason_key: 'thin_web', basis: null }];
    const merged = unionBronze(a, [
      { reason_key: 'thin_web', basis: 'customs records' },
      { reason_key: 'no_gbp', basis: 'no profile found' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].basis).toBe('customs records');
    // An existing basis is never overwritten
    const again = unionBronze(merged, [{ reason_key: 'thin_web', basis: 'different' }]);
    expect(again[0].basis).toBe('customs records');
  });

  it('unionWeaknesses dedupes on weakness_key', () => {
    const merged = unionWeaknesses(
      [{ weakness_key: 'nap_drift' }],
      [{ weakness_key: 'nap_drift' }, { weakness_key: 'category_drift' }],
    );
    expect(merged.map((w) => w.weakness_key)).toEqual(['nap_drift', 'category_drift']);
  });
});

// ─── mergeDiscoveryContexts ─────────────────────────────────────────────

describe('mergeDiscoveryContexts', () => {
  it('returns null for empty merge (same rule as validateDiscoveryContext)', () => {
    expect(mergeDiscoveryContexts([null, {}, undefined])).toBeNull();
    expect(mergeDiscoveryContexts([])).toBeNull();
  });

  it('first non-null scalar wins; arrays union across lanes', () => {
    const merged = mergeDiscoveryContexts([emergingCtx, competitiveCtx]);
    expect(merged).not.toBeNull();
    expect(merged!.focus).toBe('emerging'); // first non-null wins
    expect(merged!.discovery_signals).toEqual([
      'INT_COMMUNITY_DIRECTORY',
      'INT_POSSIBLE_CATEGORY_MISALIGNMENT',
    ]);
    expect(merged!.bronze_attribution).toEqual([
      { reason_key: 'thin_web_presence', basis: 'found via customs records' },
    ]);
    expect(merged!.competitive_weaknesses).toEqual([
      { weakness_key: 'nap_drift', basis: 'address differs across directories' },
    ]);
    expect(merged!.business_seek_priority).toBe('high');
  });
});

// ─── recordAttribution ──────────────────────────────────────────────────

describe('recordAttribution', () => {
  it('returns null for an empty/malformed context — never writes', async () => {
    const id = await service.recordAttribution({
      campaignId: 'mcamp-1',
      context: {},
    });
    expect(id).toBeNull();
    expect(mockAttributions.create).not.toHaveBeenCalled();
  });

  it('returns null when no target key is supplied', async () => {
    const id = await service.recordAttribution({
      sourceCampaignId: 'mcamp-scan',
      context: emergingCtx,
    });
    expect(id).toBeNull();
  });

  it('creates a row keyed on campaign + source scan', async () => {
    const id = await service.recordAttribution({
      campaignId: 'mcamp-biz',
      businessProspectId: 'bp-1',
      sourceCampaignId: 'mcamp-scan',
      sourceAuditId: 'maud-1',
      context: emergingCtx,
    });
    expect(id).toBe('dattr-test001');
    const data = mockAttributions.create.mock.calls[0][0].data;
    expect(data.campaign_id).toBe('mcamp-biz');
    expect(data.business_prospect_id).toBe('bp-1');
    expect(data.source_campaign_id).toBe('mcamp-scan');
    expect(data.focus).toBe('emerging');
    expect(data.bronze_attribution).toEqual([]);
  });

  it('merges into the existing row when the same scan re-attributes the target', async () => {
    mockAttributions.findFirst.mockResolvedValue({
      id: 'dattr-existing',
      campaign_id: 'mcamp-biz',
      source_campaign_id: 'mcamp-scan',
      bronze_attribution: [{ reason_key: 'thin_web', basis: null }],
      competitive_weaknesses: [],
      discovery_signals: ['INT_A'],
      discovery_provenance: [],
      business_seek_priority: 'medium',
      created_at: new Date('2026-09-01'),
    });
    const id = await service.recordAttribution({
      campaignId: 'mcamp-biz',
      sourceCampaignId: 'mcamp-scan',
      context: {
        discovery_signals: ['INT_A', 'INT_B'],
        bronze_attribution: [{ reason_key: 'thin_web', basis: 'new basis' }],
      } as any,
    });
    expect(id).toBe('dattr-existing');
    expect(mockAttributions.create).not.toHaveBeenCalled();
    const upd = mockAttributions.update.mock.calls[0][0].data;
    expect(upd.discovery_signals).toEqual(['INT_A', 'INT_B']);
    expect(upd.bronze_attribution[0].basis).toBe('new basis'); // fill, not overwrite
  });
});

// ─── resolveForCampaign ─────────────────────────────────────────────────

describe('resolveForCampaign', () => {
  it('merges sibling context + child rows even when the campaign context is null', async () => {
    const campaign = {
      id: 'mcamp-sibling',
      business_prospect_id: 'bp-1',
      discovery_context: null,
    };
    mockCampaigns.findMany.mockResolvedValue([
      { discovery_context: emergingCtx },
    ]);
    mockQueue.findMany.mockResolvedValue([]);
    mockAttributions.findMany.mockResolvedValue([{
      focus: 'competitive',
      discovered_at: new Date('2026-09-30T00:00:00Z'),
      bronze_attribution: [{ reason_key: 'thin_web', basis: 'customs' }],
      competitive_weaknesses: [{ weakness_key: 'nap_drift', basis: null }],
      discovery_signals: [],
      discovery_provenance: [],
    }]);

    const resolved = await service.resolveForCampaign(campaign);
    expect(resolved).not.toBeNull();
    expect(resolved!.focus).toBe('emerging');
    expect(resolved!.bronze_attribution).toEqual([{ reason_key: 'thin_web', basis: 'customs' }]);
    expect(resolved!.competitive_weaknesses).toEqual([{ weakness_key: 'nap_drift', basis: null }]);
  });

  it('returns null when nothing exists — legacy empty render preserved', async () => {
    const resolved = await service.resolveForCampaign({
      id: 'mcamp-plain',
      business_prospect_id: null,
      discovery_context: null,
    });
    expect(resolved).toBeNull();
  });

  it('falls back to the snapshot when the DB read throws', async () => {
    mockQueue.findMany.mockRejectedValue(new Error('db down'));
    const resolved = await service.resolveForCampaign({
      id: 'mcamp-1',
      business_prospect_id: 'bp-1',
      discovery_context: emergingCtx,
    });
    expect(resolved!.focus).toBe('emerging');
  });
});

// ─── propagateFromScanAudit ─────────────────────────────────────────────

describe('propagateFromScanAudit', () => {
  const scanCampaign = {
    id: 'mcamp-le9',
    category: 'African Grocery Store',
    city: 'Indianapolis',
    state: 'IN',
    intelligence_focus: 'competitive',
  };

  const parsedJson = {
    qualifying_businesses: [{
      business_name: 'Arsema G Food Mart LLC',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      bronze_attribution: [{ reason_key: 'thin_web', basis: 'customs records' }],
      competitive_weaknesses: [{ weakness_key: 'nap_drift' }],
      discovery_signals: ['INT_POSSIBLE_CATEGORY_MISALIGNMENT'],
      discovery_provenance: [{ source: 'Yelp', role: 'primary' }],
      category_fit: 'verified',
      identity_confidence: 'high',
    }],
    discovered_businesses: [],
  };

  it('propagates to matching business campaigns + queue rows by name+city', async () => {
    mockCampaigns.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === 'mcamp-le9' ? scanCampaign
      : where.id === 'mcamp-biz' ? { business_prospect_id: 'bp-1' }
      : null);
    mockCampaigns.findMany.mockResolvedValue([
      { id: 'mcamp-biz', business_prospect_id: 'bp-1' },
    ]);
    mockQueue.findMany.mockResolvedValue([
      { id: 'pque-1', processed_campaign_id: 'mcamp-biz' },
    ]);

    const out = await service.propagateFromScanAudit({
      scanCampaignId: 'mcamp-le9',
      auditId: 'maud-9',
      executionId: 'exec-9',
      parsedJson,
    });

    expect(out.campaigns).toBe(1);
    expect(out.queueEntries).toBe(1);
    // Two recordAttribution writes → two creates
    expect(mockAttributions.create).toHaveBeenCalledTimes(2);
    const campaignRow = mockAttributions.create.mock.calls[0][0].data;
    expect(campaignRow.campaign_id).toBe('mcamp-biz');
    expect(campaignRow.business_prospect_id).toBe('bp-1');
    expect(campaignRow.source_audit_id).toBe('maud-9');
    expect(campaignRow.focus).toBe('competitive');
    const queueRow = mockAttributions.create.mock.calls[1][0].data;
    expect(queueRow.queue_entry_id).toBe('pque-1');
    expect(queueRow.campaign_id).toBe('mcamp-biz'); // resolved via processed_campaign_id
  });

  it('skips candidates with no matching target — audit remains the record', async () => {
    mockCampaigns.findUnique.mockResolvedValue(scanCampaign);
    mockCampaigns.findMany.mockResolvedValue([]);
    mockQueue.findMany.mockResolvedValue([]);

    const out = await service.propagateFromScanAudit({
      scanCampaignId: 'mcamp-le9',
      parsedJson,
    });
    expect(out.campaigns).toBe(0);
    expect(out.queueEntries).toBe(0);
    expect(mockAttributions.create).not.toHaveBeenCalled();
  });

  it('skips candidates whose context validates to empty', async () => {
    mockCampaigns.findUnique.mockResolvedValue(scanCampaign);
    const out = await service.propagateFromScanAudit({
      scanCampaignId: 'mcamp-le9',
      parsedJson: {
        qualifying_businesses: [{ business_name: 'No Data LLC', city: 'Indianapolis' }],
        discovered_businesses: [],
      },
    });
    expect(out.campaigns + out.queueEntries).toBe(0);
    expect(mockCampaigns.findMany).not.toHaveBeenCalled();
  });
});
