/**
 * project-phase-resolution — the read-only I/O layer feeding
 * selectProjectPhases (spec §12, sprint 4.2/4.4/4.6).
 *
 * Covers: full/partial/snapshot/none lane matrices, OX_* stripping,
 * operator-input (RA_BBB_*) full-provenance union, INT discovery map
 * extraction, read-only claim resolution (no token minting, no short-code
 * backfill, no seed creation, suppressed seeds ignored), playbook pools,
 * and capability anchor order.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockAuditsList,
  mockTriageResults,
  mockPlaybookCatalog,
  mockSeeds,
  mockTenants,
  mockQueryRaw,
  mockRefreshFidelity,
} = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), findMany: vi.fn() },
  mockAuditsList: { findMany: vi.fn(), findUnique: vi.fn() },
  mockTriageResults: { findMany: vi.fn(), findFirst: vi.fn() },
  mockPlaybookCatalog: { findMany: vi.fn() },
  mockSeeds: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockTenants: { findUnique: vi.fn() },
  mockQueryRaw: vi.fn(),
  mockRefreshFidelity: vi.fn(),
}));

vi.mock('../../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_audits_list: mockAuditsList,
    mkt_campaign_triage_results: mockTriageResults,
    mkt_playbook_catalog: mockPlaybookCatalog,
    directory_presence_seeds: mockSeeds,
    tenants: mockTenants,
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../seed-fidelity', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../seed-fidelity')>();
  return { ...mod, refreshSeedFidelityIfStale: mockRefreshFidelity };
});

import {
  resolvePlanSiblings,
  resolveProspectSignals,
  resolvePlanSeedClaim,
  resolvePlanCapabilities,
  loadPlaybookSignalPools,
  loadPredicates,
} from '../project-phase-resolution';
import { PROJECT_PHASE_PREDICATES_V1 } from '../../../lib/project-phase-predicates';

// ─── Fixtures ────────────────────────────────────────────────────────────

const STUB_AUDIT = {
  id: 'a-stub',
  campaign_id: 'c-primary',
  platform: 'business_analysis',
  audit_data: {
    audit_metadata: { source: 'discovery_scan' },
    detected_signals: ['WC_MISSING_WEBSITE', 'OX_OPENER_SENT', 'INT_LOW_VISIBILITY'],
    discovery_signal_map: [
      { code: 'WC_MISSING_WEBSITE', via: 'int_signal', ref: 'INT_LOW_VISIBILITY', basis: null },
      { code: 'WC_MISSING_WEBSITE', via: 'field', ref: 'website', basis: null },
    ],
  },
  created_at: new Date('2026-01-01'),
};

const REAL_AUDIT = {
  id: 'a-real',
  campaign_id: 'c-primary',
  platform: 'business_analysis',
  audit_data: {
    detected_signals: ['RA_UNADDRESSED_NEGATIVE_BACKLOG', 'DS_CLAIMED_STATUS', 'OX_PITCH_ASSEMBLED'],
    nap_consistency: { overall_status: 'major_inconsistencies' },
  },
  created_at: new Date('2026-02-01'),
};

const CAMPAIGN = {
  id: 'c-primary',
  business_prospect_id: 'bp-1',
  is_primary_sibling: true,
  stage: 'shown',
  engagement_cycle: 2,
  estimated_tier: 'tier_2',
  nap_consistent: false,
  gbp_claimed: false,
  demo_tenant_id: 'tenant-demo-1',
  playbook_code: null,
  unaddressed_reviews: 4,
  last_review_date: null,
  has_website: 'no',
  website_url: null,
};

function mockBundleSignals(input: {
  audits?: any[];
  triage?: any[];
  campaign?: any;
}) {
  mockCampaignsList.findUnique.mockResolvedValue(input.campaign ?? CAMPAIGN);
  mockAuditsList.findMany.mockResolvedValue(input.audits ?? []);
  mockTriageResults.findMany.mockResolvedValue(input.triage ?? []);
  mockTriageResults.findFirst.mockResolvedValue(null);
  mockAuditsList.findUnique.mockResolvedValue(null);
}

const BUNDLE = {
  businessProspectId: 'bp-1',
  primaryCampaignId: 'c-primary',
  engagementCycle: 2,
  estimatedTier: 'tier_2',
  napConsistent: false,
  gbpClaimed: false,
  demoTenantId: 'tenant-demo-1',
  siblings: [
    {
      campaignId: 'c-primary',
      isPrimary: true,
      playbookCode: 'PB-03',
      archetype: 'A1',
      stage: 'shown',
      detectedSignals: ['RA_UNADDRESSED_NEGATIVE_BACKLOG'] as any[],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSeeds.findUnique.mockResolvedValue(null);
});

// ─── resolveProspectSignals ──────────────────────────────────────────────

describe('resolveProspectSignals', () => {
  it('full lane — latest REAL audit drives extraction, OX_* stripped', async () => {
    mockBundleSignals({ audits: [STUB_AUDIT, REAL_AUDIT] });
    const res = await resolveProspectSignals(BUNDLE);
    expect(res.lane).toBe('full');
    expect(res.sourceAuditId).toBe('a-real');
    // detected_signals on a real audit are model-emitted → authoritative.
    expect(res.signals).toContain('RA_UNADDRESSED_NEGATIVE_BACKLOG');
    expect(res.signals).not.toContain('OX_PITCH_ASSEMBLED');
    expect(res.signalLanes['RA_UNADDRESSED_NEGATIVE_BACKLOG']).toBe('full');
    expect(res.audit?.nap_consistency?.overall_status).toBe('major_inconsistencies');
  });

  it('partial lane — stub audit detected_signals, all tagged partial', async () => {
    mockBundleSignals({ audits: [STUB_AUDIT] });
    const res = await resolveProspectSignals(BUNDLE);
    expect(res.lane).toBe('partial');
    expect(res.sourceAuditId).toBe('a-stub');
    expect(res.signals).toContain('WC_MISSING_WEBSITE');
    expect(res.signals).not.toContain('OX_OPENER_SENT');
    expect(res.signalLanes['WC_MISSING_WEBSITE']).toBe('partial');
    // INT codes from the discovery map feed discoverySignals, never signals.
    expect(res.discoverySignals).toContain('INT_LOW_VISIBILITY');
    expect(res.signals).not.toContain('INT_LOW_VISIBILITY' as any);
  });

  it('stub shadows nothing — a newer stub does not replace a real audit', async () => {
    const newerStub = { ...STUB_AUDIT, id: 'a-stub-newer', created_at: new Date('2026-03-01') };
    mockBundleSignals({ audits: [newerStub, REAL_AUDIT] });
    const res = await resolveProspectSignals(BUNDLE);
    expect(res.lane).toBe('full');
    expect(res.sourceAuditId).toBe('a-real');
  });

  it('snapshot fallback — persisted triage signals, lane inherited from audit', async () => {
    mockBundleSignals({ audits: [] });
    mockTriageResults.findFirst.mockResolvedValue({
      detected_signals: [{ code: 'DS_CLAIMED_STATUS', label: 'x', contributedToRule: true }],
      source_audit_id: 'a-src',
    });
    mockAuditsList.findUnique.mockResolvedValue({
      platform: 'business_analysis',
      audit_data: { audit_metadata: { source: 'manual_queue' } },
    });
    const res = await resolveProspectSignals(BUNDLE);
    expect(res.lane).toBe('partial'); // producing audit was a stub
    expect(res.signals).toContain('DS_CLAIMED_STATUS');
    expect(res.signalLanes['DS_CLAIMED_STATUS']).toBe('partial');
  });

  it('none lane — no audits, no persisted snapshot', async () => {
    mockBundleSignals({ audits: [] });
    const res = await resolveProspectSignals(BUNDLE);
    expect(res.lane).toBe('none');
    expect(res.signals).toHaveLength(0);
    expect(res.sourceAuditId).toBeNull();
  });

  it('operator-input BBB codes union in every lane with full provenance', async () => {
    mockBundleSignals({
      audits: [STUB_AUDIT],
      triage: [
        {
          detected_signals: [
            { code: 'RA_BBB_GRADE_SUPPRESSION', label: 'x', contributedToRule: true },
          ],
        },
      ],
    });
    const res = await resolveProspectSignals(BUNDLE);
    expect(res.lane).toBe('partial');
    expect(res.signals).toContain('RA_BBB_GRADE_SUPPRESSION');
    expect(res.signalLanes['RA_BBB_GRADE_SUPPRESSION']).toBe('full');
  });
});

// ─── resolvePlanSiblings ─────────────────────────────────────────────────

describe('resolvePlanSiblings', () => {
  it('resolves sibling set + accepted playbook (override wins)', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(CAMPAIGN);
    mockCampaignsList.findMany.mockResolvedValue([
      { id: 'c-primary', is_primary_sibling: true, stage: 'shown', playbook_code: null },
      { id: 'c-sib', is_primary_sibling: false, stage: 'paid', playbook_code: 'PB-08' },
    ]);
    mockTriageResults.findMany.mockResolvedValue([
      {
        campaign_id: 'c-primary',
        recommended_playbook_id: 'pb-a',
        overridden_playbook_id: 'pb-b',
        detected_signals: [{ code: 'RA_BBB_GRADE_SUPPRESSION' }],
      },
    ]);
    mockPlaybookCatalog.findMany.mockResolvedValue([
      { id: 'pb-b', code: 'PB-02', archetype: 'A1' },
    ]);
    const bundle = await resolvePlanSiblings('c-primary');
    expect(bundle?.siblings).toHaveLength(2);
    const primary = bundle!.siblings.find((s) => s.isPrimary)!;
    expect(primary.playbookCode).toBe('PB-02'); // override, not campaign col
    expect(primary.archetype).toBe('A1');
    expect(primary.detectedSignals).toContain('RA_BBB_GRADE_SUPPRESSION');
    expect(bundle?.estimatedTier).toBe('tier_2');
    expect(bundle?.engagementCycle).toBe(2);
  });
});

// ─── resolvePlanSeedClaim — READ-ONLY ────────────────────────────────────

describe('resolvePlanSeedClaim', () => {
  const seedRow = {
    seed_id: 'seed-1',
    status: 'published',
    tenant_id: 't-seed',
    slug: 'harbor-deli',
    short_code: 'abc123',
    seed_fidelity: 'aligned',
    seed_fidelity_audit_id: 'a-real',
    claim_token: 'tok-1',
  };

  it('prefers the existing /c/{short_code} URL over a token', async () => {
    mockQueryRaw.mockResolvedValueOnce([seedRow]);
    const res = await resolvePlanSeedClaim('c-primary');
    expect(res?.claimUrl).toBe('/c/abc123');
    expect(res?.placeUrl).toBe('/place/harbor-deli');
    expect(res?.status).toBe('published');
  });

  it('falls back to an active claim token, then the place URL', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...seedRow, short_code: null }]);
    const res = await resolvePlanSeedClaim('c-primary');
    expect(res?.claimUrl).toBe('/claim/tok-1');
  });

  it('no short code + no token → claimUrl null (placeUrl only)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...seedRow, short_code: null, claim_token: null }]);
    const res = await resolvePlanSeedClaim('c-primary');
    expect(res?.claimUrl).toBeNull();
    expect(res?.placeUrl).toBe('/place/harbor-deli');
  });

  it('misaligned seed never exposes a claim URL', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...seedRow, seed_fidelity: 'misaligned' }]);
    mockSeeds.findUnique.mockResolvedValue({ seed_fidelity: 'misaligned' });
    const res = await resolvePlanSeedClaim('c-primary');
    expect(res?.fidelity).toBe('misaligned');
    expect(res?.claimUrl).toBeNull();
  });

  it('suppressed seeds are excluded by the query (no live wedge)', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    const res = await resolvePlanSeedClaim('c-primary');
    expect(res).toBeNull();
    const sql = mockQueryRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain("IS DISTINCT FROM 'suppressed'");
  });

  it('never mints tokens, never writes — single read + fidelity refresh only', async () => {
    mockQueryRaw.mockResolvedValueOnce([seedRow]);
    await resolvePlanSeedClaim('c-primary');
    expect(mockSeeds.create).not.toHaveBeenCalled();
    expect(mockSeeds.update).not.toHaveBeenCalled();
    // Lazy fidelity refresh is the one allowed verdict write (spec D5).
    expect(mockRefreshFidelity).toHaveBeenCalledWith('seed-1');
  });
});

// ─── Capability resolution ───────────────────────────────────────────────

describe('resolvePlanCapabilities', () => {
  it('no anchor tenant → platform defaults (domain always off)', async () => {
    const caps = await resolvePlanCapabilities({});
    expect(caps).toEqual({
      storefrontEnabled: true,
      subdomainEnabled: true,
      qrPrintEnabled: true,
      domainEnabled: false,
    });
  });

  it('anchor tenant: subdomain on assignment, storefront/QR from effective caps', async () => {
    mockTenants.findUnique.mockResolvedValue({ subdomain: 'harbor-deli' });
    mockQueryRaw.mockResolvedValueOnce([
      { feature_key: 'storefront_gallery_enabled' },
      { feature_key: 'storefront_opt_qr_enabled' },
    ]);
    const caps = await resolvePlanCapabilities({ demoTenantId: 'tenant-demo-1' });
    expect(caps.subdomainEnabled).toBe(true);
    expect(caps.storefrontEnabled).toBe(true);
    expect(caps.qrPrintEnabled).toBe(true);
    expect(caps.domainEnabled).toBe(false);
  });

  it('anchor tenant without a subdomain → subdomainEnabled false', async () => {
    mockTenants.findUnique.mockResolvedValue({ subdomain: null });
    mockQueryRaw.mockResolvedValueOnce([]);
    const caps = await resolvePlanCapabilities({ demoTenantId: 'tenant-demo-1' });
    expect(caps.subdomainEnabled).toBe(false);
    expect(caps.storefrontEnabled).toBe(false);
  });

  it('wedge tenant wins over the demo tenant as the anchor', async () => {
    mockTenants.findUnique.mockResolvedValue({ subdomain: 'wedge' });
    mockQueryRaw.mockResolvedValueOnce([]);
    await resolvePlanCapabilities({ wedgeTenantId: 't-seed', demoTenantId: 'tenant-demo-1' });
    expect(mockTenants.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't-seed' } }),
    );
  });
});

// ─── Playbook pools + predicates ─────────────────────────────────────────

describe('loadPlaybookSignalPools', () => {
  it('unions any+all+dual codes, excludes the none clause', async () => {
    mockPlaybookCatalog.findMany.mockResolvedValue([
      {
        code: 'PB-01',
        matching_rules: {
          any: ['RA_UNADDRESSED_NEGATIVE_BACKLOG'],
          all: ['RA_REVIEW_DROUGHT'],
          none: ['OX_OPENER_SENT'],
          dual: { groupA: ['DS_CLAIMED_STATUS'], groupB: ['WC_MISSING_WEBSITE'] },
        },
      },
    ]);
    const pools = await loadPlaybookSignalPools(['PB-01']);
    expect(pools['PB-01']).toEqual(
      expect.arrayContaining([
        'RA_UNADDRESSED_NEGATIVE_BACKLOG',
        'RA_REVIEW_DROUGHT',
        'DS_CLAIMED_STATUS',
        'WC_MISSING_WEBSITE',
      ]),
    );
    expect(pools['PB-01']).not.toContain('OX_OPENER_SENT');
  });
});

describe('loadPredicates', () => {
  it('falls back to the v1 constant when no rows exist for the seed version', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    const rows = await loadPredicates(1);
    expect(rows).toBe(PROJECT_PHASE_PREDICATES_V1);
  });

  it('returns empty for an unknown version with no rows', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    const rows = await loadPredicates(99);
    expect(rows).toEqual([]);
  });
});
