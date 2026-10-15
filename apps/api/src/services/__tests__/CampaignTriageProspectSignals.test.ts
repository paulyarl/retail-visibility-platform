/**
 * CampaignTriageService — prospect-scoped signal evidence for alternatives
 *
 * An audit describes the BUSINESS, not the campaign row it was filed under.
 * Siblings share one business_prospect_id, so triage alternatives must be
 * matched against the prospect's best audit across the sibling group —
 * not the decided campaign's stored detected_signals (which are decision-time
 * evidence and go stale: a sibling's stored set is whatever the source
 * campaign saw at creation time, before later audits land).
 *
 * Reproduces the mcamp-uvcasj3e / mcamp-t4jj2t82 case: the primary was
 * re-evaluated against a fresh business_analysis audit that emitted only
 * repair-side signals, while the PB-08 sibling's stored snapshot still carried
 * RA_LOW_REVIEW_VOLUME — so the sibling kept offering PB-05 (dual match) from
 * evidence that no longer existed. After the fix, the sibling's alternatives
 * come from the group audit → no review-side signal → PB-05 is absent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockTriageResults,
  mockAudits,
  mockListActivePlaybooks,
  mockListSignals,
  mockResolveSignalWeights,
} = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  mockTriageResults: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  mockAudits: { findMany: vi.fn(), findUnique: vi.fn() },
  mockListActivePlaybooks: vi.fn(),
  mockListSignals: vi.fn(),
  mockResolveSignalWeights: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_campaign_triage_results: mockTriageResults,
    mkt_audits_list: mockAudits,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignTriageId: () => 'mct-test-001',
}));

vi.mock('../MarketingPlaybookCatalogService', () => ({
  default: {
    listActivePlaybooksOrdered: mockListActivePlaybooks,
    getPlaybookByCode: vi.fn(),
  },
}));

vi.mock('../MarketingSignalRegistryService', () => ({
  default: {
    listSignals: mockListSignals,
  },
}));

vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => ({
      resolveSignalWeightMapForCampaign: mockResolveSignalWeights,
    }),
  },
}));

import CampaignTriageService from '../CampaignTriageService';

// ─── Fixtures ────────────────────────────────────────────────────────────

// PlaybookCatalogRow shape (what listActivePlaybooksOrdered returns — the
// service maps DB rows to camelCase before the engine sees them).
const pbRow = (over: Record<string, any>) => ({
  id: `pbk-${over.code.toLowerCase()}`,
  name: 'Playbook',
  category: 'profile_repair',
  archetypeLabel: '',
  description: null,
  fitdOfferTitle: 'FITD',
  fitdDefaultFeeCents: 0,
  retainerPitchTitle: 'Retainer',
  retainerFeeCents: 0,
  openerPromptTemplateId: null,
  previewDeliverableType: null,
  isActive: true,
  ...over,
});

const PB05 = pbRow({
  code: 'PB-05',
  archetype: 'A5',
  priorityRank: 2,
  matchingRules: {
    any: [],
    all: [],
    none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
    dual: {
      groupA: ['CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT'],
      groupB: ['RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME'],
    },
    confidence: 0.9,
  },
});

const PB09 = pbRow({
  code: 'PB-09',
  archetype: 'A8',
  priorityRank: 3,
  matchingRules: {
    any: ['DS_MISSING_PROFILE', 'DS_DUPLICATE_LISTING'],
    all: [],
    none: [],
    dual: null,
    confidence: 0.88,
  },
});

const PB01 = pbRow({
  code: 'PB-01',
  archetype: 'A3',
  priorityRank: 4,
  matchingRules: {
    any: ['CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT'],
    all: [],
    none: [],
    dual: null,
    confidence: 0.85,
  },
});

const PB08 = pbRow({
  code: 'PB-08',
  archetype: 'A7',
  priorityRank: 8,
  matchingRules: {
    any: ['WC_BUILDER_SUBDOMAIN'],
    all: [],
    none: [],
    dual: null,
    confidence: 0.88,
  },
});

// The sibling's frozen, pre-audit signal snapshot — a PB-05 dual match
// (repair codes + RA_LOW_REVIEW_VOLUME).
const STALE_STORED_SIGNALS = [
  'RA_LOW_REVIEW_VOLUME',
  'WC_BUILDER_SUBDOMAIN',
  'CP_NAP_ADDRESS_DRIFT',
  'CP_NAP_PHONE_DRIFT',
].map((code) => ({ code, label: code, contributedToRule: true }));

// The primary's fresh audit (10/15) — repair-side signals only, no groupB.
const PROSPECT_AUDIT_SIGNALS = [
  'DS_DUPLICATE_LISTING',
  'DS_MISSING_PROFILE',
  'CP_NAP_NAME_DRIFT',
  'WC_BUILDER_SUBDOMAIN',
];

const siblingCampaign = {
  id: 'mcamp-sib',
  scope: 'business',
  business_prospect_id: 'bp-1',
  last_review_date: null,
  unaddressed_reviews: 0,
  nap_consistent: null,
  has_website: 'yes',
  website_url: 'https://example.com',
  gbp_claimed: null,
};

// DB-shaped playbook row for the stored triage result's include relation.
const pb08DbRow = {
  id: 'pbk-pb08',
  code: 'PB-08',
  name: 'Website Acquisition & Build',
  category: 'profile_repair',
  archetype: 'A7',
  archetype_label: 'A7_WEBSITE_GAP',
  description: null,
  matching_rules: PB08.matchingRules,
  priority_rank: 8,
  fitd_offer_title: 'FITD',
  fitd_default_fee_cents: 49900,
  retainer_pitch_title: 'Retainer',
  retainer_fee_cents: 9900,
  opener_prompt_template_id: null,
  preview_deliverable_type: null,
  is_active: true,
};

const decidedTriageRow = {
  id: 'mct-sib-001',
  campaign_id: 'mcamp-sib',
  recommended_playbook_id: 'pbk-pb08',
  confidence_score: 0.88,
  triage_reasoning: 'Sibling campaign created from multi-archetype triage alternative (PB-08).',
  detected_signals: STALE_STORED_SIGNALS,
  is_operator_accepted: true,
  overridden_playbook_id: null,
  source_audit_id: null,
  evaluated_at: new Date(),
  playbook: pb08DbRow,
  overridden_playbook: null,
};

const groupAudit = {
  id: 'maud-pri-001',
  campaign_id: 'mcamp-pri',
  platform: 'business_analysis',
  created_at: new Date(),
  audit_data: {
    audit_metadata: {},
    detected_signals: PROSPECT_AUDIT_SIGNALS,
  },
};

function mockHappyPath() {
  // findUnique is called twice: assertBusinessScope (select: scope) then the
  // full campaign load inside loadSignalsAndPlaybooks.
  mockCampaignsList.findUnique.mockImplementation(({ select }: any) => {
    if (select && Object.keys(select).length === 1 && select.scope) {
      return Promise.resolve({ scope: 'business' });
    }
    return Promise.resolve(siblingCampaign);
  });
  mockCampaignsList.findMany.mockResolvedValue([
    { id: 'mcamp-sib' },
    { id: 'mcamp-pri' },
  ]);
  mockTriageResults.findUnique.mockResolvedValue(decidedTriageRow);
  mockResolveSignalWeights.mockResolvedValue(undefined);
  mockListSignals.mockResolvedValue([]);
  mockListActivePlaybooks.mockResolvedValue([PB05, PB09, PB01, PB08]);
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('evaluateAllForCampaign — prospect-scoped alternatives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads audits across the whole sibling group, not just this campaign', async () => {
    mockHappyPath();
    mockAudits.findMany.mockResolvedValue([groupAudit]);

    await CampaignTriageService.evaluateAllForCampaign({ campaignId: 'mcamp-sib' });

    expect(mockAudits.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaign_id: { in: ['mcamp-sib', 'mcamp-pri'] } },
      }),
    );
  });

  it('matches alternatives against the group audit, not the sibling\'s stale stored signals', async () => {
    mockHappyPath();
    mockAudits.findMany.mockResolvedValue([groupAudit]);

    const result = await CampaignTriageService.evaluateAllForCampaign({ campaignId: 'mcamp-sib' });

    // Winner stays the stored (decided) PB-08 — the GET never resets a decision.
    expect(result.winner.recommendedPlaybook.code).toBe('PB-08');

    const codes = result.alternatives.map((a: any) => a.playbookCode);
    // The stale stored set contained RA_LOW_REVIEW_VOLUME (PB-05 groupB) — but
    // the group audit did not, so PB-05 must NOT be offered from dead evidence.
    expect(codes).not.toContain('PB-05');
    // Audit signals match PB-09 + PB-01 (winner PB-08 filtered out).
    expect(codes).toContain('PB-09');
    expect(codes).toContain('PB-01');
  });

  it('falls back to stored detected_signals when extraction yields nothing', async () => {
    mockHappyPath();
    // No audit anywhere in the group; sibling campaign fields are benign
    // (owned domain, has_website=yes, nap_consistent null) → extraction = [].
    mockAudits.findMany.mockResolvedValue([]);

    const result = await CampaignTriageService.evaluateAllForCampaign({ campaignId: 'mcamp-sib' });

    const codes = result.alternatives.map((a: any) => a.playbookCode);
    // Stored set was the only evidence — the panel keeps its suggestions
    // rather than blanking out (PB-05 dual still matches it).
    expect(codes).toContain('PB-05');
  });

  it('scopes audits to the single campaign when there is no prospect group', async () => {
    mockCampaignsList.findUnique.mockImplementation(({ select }: any) => {
      if (select && Object.keys(select).length === 1 && select.scope) {
        return Promise.resolve({ scope: 'business' });
      }
      return Promise.resolve({ ...siblingCampaign, business_prospect_id: null });
    });
    mockTriageResults.findUnique.mockResolvedValue(decidedTriageRow);
    mockAudits.findMany.mockResolvedValue([]);
    mockResolveSignalWeights.mockResolvedValue(undefined);
    mockListSignals.mockResolvedValue([]);
    mockListActivePlaybooks.mockResolvedValue([PB05, PB09, PB01, PB08]);

    await CampaignTriageService.evaluateAllForCampaign({ campaignId: 'mcamp-sib' });

    expect(mockCampaignsList.findMany).not.toHaveBeenCalled();
    expect(mockAudits.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaign_id: { in: ['mcamp-sib'] } },
      }),
    );
  });
});
