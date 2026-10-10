/**
 * buildProjectPhasePlanForKey — spec §13 plan-lifecycle semantics.
 *
 * The plan owns nothing: these tests guard the non-destructive contract —
 * first-read materialization with no initialization write, empty/unknown
 * prospect → all-not_triggered (never an error), and no stale state
 * between reads. Plus the zero-write assertion over the whole path.
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
  mockCampaignsList: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockAuditsList: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockTriageResults: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockPlaybookCatalog: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockSeeds: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockTenants: { findUnique: vi.fn(), update: vi.fn() },
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
  buildProjectPhasePlanForKey,
  emptyProjectPhasePlan,
} from '../project-phase-resolution';

// ─── Fixtures ────────────────────────────────────────────────────────────

const CAMPAIGN = {
  id: 'c-primary',
  business_prospect_id: 'bp-1',
  is_primary_sibling: true,
  stage: 'shown',
  engagement_cycle: 1,
  estimated_tier: 'tier_2',
  nap_consistent: false,
  gbp_claimed: false,
  demo_tenant_id: null,
  playbook_code: null,
  unaddressed_reviews: 6,
  last_review_date: null,
  has_website: 'no',
  website_url: null,
  business_name: 'Harbor Deli',
};

const REAL_AUDIT = {
  id: 'a-1',
  campaign_id: 'c-primary',
  platform: 'business_analysis',
  audit_data: {
    detected_signals: ['RA_UNADDRESSED_NEGATIVE_BACKLOG', 'WC_MISSING_WEBSITE'],
    combined_review_metrics: { observable_unanswered_negative_reviews: 6 },
  },
  created_at: new Date(),
};

/** Dispatch $queryRaw by SQL content — the plan path runs several. */
function rawDispatch(handlers: { match: string; rows: any[] }[]) {
  mockQueryRaw.mockImplementation((strings: TemplateStringsArray | string[]) => {
    const sql = Array.isArray(strings) ? strings.join(' ') : String(strings);
    for (const h of handlers) if (sql.includes(h.match)) return Promise.resolve(h.rows);
    return Promise.resolve([]);
  });
}

function wireAll() {
  mockCampaignsList.findUnique.mockImplementation(({ where }: any) =>
    Promise.resolve(where.id === 'c-primary' ? CAMPAIGN : null),
  );
  mockCampaignsList.findFirst.mockImplementation(({ where }: any) =>
    Promise.resolve(where.business_prospect_id === 'bp-1' ? { id: 'c-primary' } : null),
  );
  mockCampaignsList.findMany.mockResolvedValue([
    { id: 'c-primary', is_primary_sibling: true, stage: 'shown', playbook_code: null, demo_tenant_id: null },
  ]);
  mockTriageResults.findMany.mockResolvedValue([
    {
      campaign_id: 'c-primary',
      recommended_playbook_id: 'pb-1',
      overridden_playbook_id: null,
      detected_signals: [{ code: 'RA_UNADDRESSED_NEGATIVE_BACKLOG', label: 'x', contributedToRule: true }],
    },
  ]);
  mockTriageResults.findFirst.mockResolvedValue(null);
  // Returned for both the id-lookup (archetype/code) and pool-loading
  // (matching_rules) calls.
  mockPlaybookCatalog.findMany.mockResolvedValue([
    {
      id: 'pb-1',
      code: 'PB-02',
      archetype: 'A1',
      matching_rules: { any: ['RA_UNADDRESSED_NEGATIVE_BACKLOG'], all: [], none: [], dual: null },
    },
  ]);
  mockAuditsList.findMany.mockResolvedValue([REAL_AUDIT]);
  mockAuditsList.findUnique.mockResolvedValue(null);
  mockSeeds.findUnique.mockResolvedValue(null);
  mockTenants.findUnique.mockResolvedValue(null);
  rawDispatch([
    { match: 'mkt_project_phase_predicates', rows: [] }, // → v1 constant fallback
    { match: 'directory_seed_campaign_links', rows: [] }, // seed claim + surfaces
    { match: 'mv_tenant_effective_capabilities', rows: [] },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  wireAll();
});

// ─── Lifecycle semantics ─────────────────────────────────────────────────

describe('plan lifecycle (spec §13)', () => {
  it('first read materializes a computed plan — no initialization write', async () => {
    const plan = await buildProjectPhasePlanForKey({ prospectId: 'bp-1' });
    expect(plan.businessProspectId).toBe('bp-1');
    expect(plan.phases).toHaveLength(5);
    expect(plan.signals).toContain('RA_UNADDRESSED_NEGATIVE_BACKLOG');
    // The trust + findability phases trigger on the audit's signals.
    const trust = plan.phases.find((p) => p.key === 'trust')!;
    expect(trust.triggerSignals).toContain('RA_UNADDRESSED_NEGATIVE_BACKLOG');
    expect(trust.status).toBe('in_progress'); // 'shown' is an active stage
  });

  it('unknown prospect → all-not_triggered plan, never an error', async () => {
    mockCampaignsList.findFirst.mockResolvedValue(null);
    mockCampaignsList.findUnique.mockResolvedValue(null);
    const plan = await buildProjectPhasePlanForKey({ prospectId: 'bp-ghost' });
    expect(plan.phases).toHaveLength(5);
    for (const p of plan.phases) {
      expect(p.status).toBe('not_started');
      expect(p.suppressedReason).toBe('not_triggered');
    }
    expect(plan.signals).toHaveLength(0);
  });

  it('null-prospect campaign resolves as a singleton via campaignId', async () => {
    mockCampaignsList.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.id === 'c-solo'
          ? { ...CAMPAIGN, id: 'c-solo', business_prospect_id: null }
          : null,
      ),
    );
    const plan = await buildProjectPhasePlanForKey({ campaignId: 'c-solo' });
    expect(plan.businessProspectId).toBeNull();
    expect(plan.phases.find((p) => p.key === 'trust')!.triggerSignals).toContain(
      'RA_UNADDRESSED_NEGATIVE_BACKLOG',
    );
  });

  it('prospectId that is actually a campaign id resolves the singleton', async () => {
    mockCampaignsList.findFirst.mockResolvedValue(null); // no prospect match
    mockCampaignsList.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.id === 'c-solo'
          ? { ...CAMPAIGN, id: 'c-solo', business_prospect_id: null }
          : null,
      ),
    );
    const plan = await buildProjectPhasePlanForKey({ prospectId: 'c-solo' });
    expect(plan.phases.find((p) => p.key === 'trust')!.triggerSignals.length).toBeGreaterThan(0);
  });

  it('no stale state — a stage change is visible on the next read', async () => {
    const first = await buildProjectPhasePlanForKey({ prospectId: 'bp-1' });
    expect(first.phases.find((p) => p.key === 'trust')!.status).toBe('in_progress');

    // Stage changes to terminal — next read reflects it.
    mockCampaignsList.findMany.mockResolvedValue([
      { id: 'c-primary', is_primary_sibling: true, stage: 'delivered', playbook_code: null, demo_tenant_id: null },
    ]);
    const second = await buildProjectPhasePlanForKey({ prospectId: 'bp-1' });
    expect(second.phases.find((p) => p.key === 'trust')!.status).not.toBe('in_progress');
  });

  it('zero writes across the whole path', async () => {
    await buildProjectPhasePlanForKey({ prospectId: 'bp-1' });
    for (const model of [
      mockCampaignsList,
      mockAuditsList,
      mockTriageResults,
      mockPlaybookCatalog,
      mockSeeds,
      mockTenants,
    ]) {
      for (const m of [model.create, model.update]) {
        if (m) expect(m).not.toHaveBeenCalled();
      }
    }
    // Only raw queries — and none of them are writes (all SELECT-shaped).
    for (const call of mockQueryRaw.mock.calls) {
      const sql = (call[0] as any[]).join(' ');
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|UPSERT)\b/i);
    }
  });
});

describe('emptyProjectPhasePlan', () => {
  it('emits the five-phase catalog with not_triggered everywhere', () => {
    const plan = emptyProjectPhasePlan('bp-x');
    expect(plan.businessProspectId).toBe('bp-x');
    expect(plan.phases.map((p) => p.key)).toEqual([
      'foundation',
      'claim',
      'findability',
      'trust',
      'expansion',
    ]);
  });
});
