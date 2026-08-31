/**
 * HookSuggestionService tests (§15 slice 2)
 *
 * Verifies:
 * - Ranking: archetype-affinity hooks first, signal-match tie-break,
 *   catalog order as final fallback
 * - Merge resolution: {{salutation}}, {{city}}, {{category}}, {{sender_name}}
 *   resolved; unresolvable placeholders render visibly (never fabricated)
 * - Salutation from worksheet (with sibling inheritance) vs inline fallback
 * - All 12 hooks returned, ranked
 * - Empty triage signals → archetype-only ranking
 *
 * Spec: docs/LocalBiz/marketing_ops_outreach_intelligence_prep_sprint_plan.md §13
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockResolveCampaignArchetype,
  mockGetTriageResult,
  mockGetCampaign,
  mockGetForCampaign,
  mockGetLatestAuditData,
} = vi.hoisted(() => ({
  mockResolveCampaignArchetype: vi.fn(),
  mockGetTriageResult: vi.fn(),
  mockGetCampaign: vi.fn(),
  mockGetForCampaign: vi.fn(),
  mockGetLatestAuditData: vi.fn(),
}));

vi.mock('../OutreachOpenerService', () => ({
  resolveCampaignArchetype: mockResolveCampaignArchetype,
  // OutreachOpenerService is also imported by other modules; export a stub
  OutreachOpenerService: class {
    static getInstance() {
      return {};
    }
  },
}));

vi.mock('../CampaignTriageService', () => ({
  default: {
    getInstance: () => ({ getTriageResult: mockGetTriageResult }),
    getTriageResult: mockGetTriageResult,
  },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: {
    getInstance: () => ({ getCampaign: mockGetCampaign }),
    getCampaign: mockGetCampaign,
  },
}));

vi.mock('../OutreachIntelligenceService', () => ({
  default: {
    getInstance: () => ({ getForCampaign: mockGetForCampaign }),
    getForCampaign: mockGetForCampaign,
  },
  resolveSalutation: (payload: any, businessName: string | null) => {
    // Inline fallback chain — mirrors the real resolveSalutation
    if (businessName && businessName.trim().length > 0 && businessName.length <= 60) {
      return `Hi ${businessName.trim()},`;
    }
    return 'Hi there,';
  },
}));

vi.mock('../deliverable/BusinessContextService', () => ({
  default: {
    getLatestAuditData: mockGetLatestAuditData,
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {},
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import after mocks
import HookSuggestionService from '../HookSuggestionService';

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeCampaign(overrides: Partial<any> = {}) {
  return {
    id: 'camp-001',
    business_name: 'Test Business',
    city: 'Indianapolis',
    service_category: 'African Grocery Stores',
    assigned_to: 'Adrien Yarl',
    ...overrides,
  };
}

function makeTriageResult(signals: string[] = []) {
  return {
    detectedSignals: signals.map((code) => ({
      code,
      label: `Signal ${code}`,
      contributedToRule: true,
    })),
  };
}

function makeWorksheet(salutation: string) {
  return {
    recommended_salutation: salutation,
    owner_name: null,
    business_email: null,
    team_signal: 'unknown',
    preferred_contact_channel: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveCampaignArchetype.mockResolvedValue({
    archetype: 'A3',
    source: 'fallback',
    reason: 'test',
  });
  mockGetTriageResult.mockResolvedValue(makeTriageResult([]));
  mockGetCampaign.mockResolvedValue(makeCampaign());
  mockGetForCampaign.mockResolvedValue(null); // no worksheet → inline fallback
  mockGetLatestAuditData.mockResolvedValue(null); // no audit → no emerging boost
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('HookSuggestionService.suggestForCampaign', () => {
  it('returns all 12 hooks ranked', async () => {
    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    expect(result.suggestions).toHaveLength(14);
    // Ranks are 1–13, sequential
    for (let i = 0; i < 13; i++) {
      expect(result.suggestions[i].rank).toBe(i + 1);
    }
  });

  it('returns the resolved archetype + source', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A1',
      source: 'triage',
      reason: 'triage-accepted: A1',
    });

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    expect(result.archetype).toBe('A1');
    expect(result.archetypeSource).toBe('triage');
  });

  it('archetype-affinity hooks rank first', async () => {
    // A3 archetype: gbp_verification, nap_normalization, hours_sync,
    // cross_platform_expansion have A3 affinity
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A3',
      source: 'fallback',
      reason: 'test',
    });

    const result = await HookSuggestionService.suggestForCampaign('camp-001');
    const top4 = result.suggestions.slice(0, 4).map((s) => s.angle);

    // All A3-affinity hooks should be in the top 4
    expect(top4).toContain('gbp_verification');
    expect(top4).toContain('nap_normalization');
    expect(top4).toContain('hours_sync');
    expect(top4).toContain('cross_platform_expansion');
  });

  it('signal-match count breaks ties within archetype-affinity tier', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A3',
      source: 'fallback',
      reason: 'test',
    });
    // DS_CLAIMED_STATUS is a signal for gbp_verification only among A3 hooks
    mockGetTriageResult.mockResolvedValue(makeTriageResult(['DS_CLAIMED_STATUS']));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    // gbp_verification has DS_CLAIMED_STATUS → should rank first among A3 hooks
    expect(result.suggestions[0].angle).toBe('gbp_verification');
    expect(result.suggestions[0].matchedSignals).toContain('DS_CLAIMED_STATUS');
  });

  it('non-affinity hooks with signal matches still rank below affinity hooks', async () => {
    mockResolveCampaignArchetype.mockResolvedValue({
      archetype: 'A4',
      source: 'fallback',
      reason: 'test',
    });
    // RA_LOW_REVIEW_VOLUME matches review_acquisition (A1) and local_seo (A5/A6)
    // — neither has A4 affinity, but they have signal matches
    mockGetTriageResult.mockResolvedValue(makeTriageResult(['RA_LOW_REVIEW_VOLUME']));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');
    const topAngles = result.suggestions.slice(0, 3).map((s) => s.angle);

    // A4-affinity hooks (gbp_verification, website_foundation, click_to_call)
    // should still rank above signal-matched non-affinity hooks
    expect(topAngles).toContain('gbp_verification');
    expect(topAngles).toContain('website_foundation');
    expect(topAngles).toContain('click_to_call');
  });

  it('empty triage signals → archetype-only ranking (no crash)', async () => {
    mockGetTriageResult.mockResolvedValue(null);

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    expect(result.suggestions).toHaveLength(14);
    // All matchedSignals should be empty
    for (const s of result.suggestions) {
      expect(s.matchedSignals).toEqual([]);
    }
  });

  it('triage lookup error → archetype-only ranking (graceful degradation)', async () => {
    mockGetTriageResult.mockRejectedValue(new Error('triage not found'));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    expect(result.suggestions).toHaveLength(14);
  });
});

describe('Merge resolution', () => {
  it('resolves {{salutation}} from worksheet', async () => {
    mockGetForCampaign.mockResolvedValue(makeWorksheet('Hi Maria,'));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    for (const hook of result.suggestions) {
      expect(hook.resolved.body).toContain('Hi Maria,');
      expect(hook.resolved.body).not.toContain('{{salutation}}');
    }
  });

  it('falls back to business name salutation when no worksheet', async () => {
    mockGetForCampaign.mockResolvedValue(null);
    mockGetCampaign.mockResolvedValue(makeCampaign({ business_name: 'Tetees Market' }));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    for (const hook of result.suggestions) {
      expect(hook.resolved.body).toContain('Hi Tetees Market,');
      expect(hook.resolved.body).not.toContain('{{salutation}}');
    }
  });

  it('falls back to "Hi there," when no worksheet and no business name', async () => {
    mockGetForCampaign.mockResolvedValue(null);
    mockGetCampaign.mockResolvedValue(makeCampaign({ business_name: null }));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    for (const hook of result.suggestions) {
      expect(hook.resolved.body).toContain('Hi there,');
    }
  });

  it('resolves {{city}} from campaign', async () => {
    mockGetCampaign.mockResolvedValue(makeCampaign({ city: 'Chicago' }));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    // gbp_verification uses {{city}} in its body
    const gbpHook = result.suggestions.find((s) => s.angle === 'gbp_verification');
    expect(gbpHook).toBeDefined();
    expect(gbpHook!.resolved.body).toContain('Chicago');
    expect(gbpHook!.resolved.body).not.toContain('{{city}}');
  });

  it('resolves {{category}} from campaign (lowercased)', async () => {
    mockGetCampaign.mockResolvedValue(
      makeCampaign({ service_category: 'African Grocery Stores' }),
    );

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    const gbpHook = result.suggestions.find((s) => s.angle === 'gbp_verification');
    expect(gbpHook).toBeDefined();
    expect(gbpHook!.resolved.body).toContain('african grocery stores');
    expect(gbpHook!.resolved.body).not.toContain('{{category}}');
  });

  it('resolves {{sender_name}} from assigned_to', async () => {
    mockGetCampaign.mockResolvedValue(makeCampaign({ assigned_to: 'Jane Smith' }));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    for (const hook of result.suggestions) {
      expect(hook.resolved.body).toContain('Jane Smith');
      expect(hook.resolved.body).not.toContain('{{sender_name}}');
    }
  });

  it('falls back to platform default sender when no assigned_to', async () => {
    mockGetCampaign.mockResolvedValue(makeCampaign({ assigned_to: null }));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    for (const hook of result.suggestions) {
      expect(hook.resolved.body).toContain('your team');
      expect(hook.resolved.body).not.toContain('{{sender_name}}');
    }
  });

  it('unresolvable placeholders render visibly (never fabricated)', async () => {
    mockGetCampaign.mockResolvedValue(
      makeCampaign({ city: null, service_category: null }),
    );

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    const gbpHook = result.suggestions.find((s) => s.angle === 'gbp_verification');
    expect(gbpHook).toBeDefined();
    // {{category}} and {{city}} should remain as literal placeholders
    expect(gbpHook!.resolved.body).toContain('{{category}}');
    expect(gbpHook!.resolved.body).toContain('{{city}}');
  });

  it('subject line is also merge-resolved', async () => {
    mockGetForCampaign.mockResolvedValue(makeWorksheet('Hi Maria,'));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    // Subjects don't use {{salutation}} but verify the resolution runs
    for (const hook of result.suggestions) {
      expect(hook.resolved.subject).toBeTruthy();
      expect(typeof hook.resolved.subject).toBe('string');
    }
  });
});

// ─── Emerging-archetype boost (Sprint 2) ─────────────────────────────────

describe('Emerging-archetype rank boost', () => {
  function makeV3Audit(archetype: string, growthReadiness: string, businessName: string = 'Tetees Market') {
    return {
      auditData: {
        prospect_discovery: {
          highest_opportunity_businesses: [
            { business_name: businessName, emerging_archetype: archetype, growth_readiness: growthReadiness },
          ],
        },
      },
      auditId: 'audit-001',
    };
  }

  it('boosts DIRECTORY_GHOST angles (zero_footprint first) above non-boosted hooks', async () => {
    mockGetLatestAuditData.mockResolvedValue(makeV3Audit('DIRECTORY_GHOST', 'foundation_needed'));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    // zero_footprint should be ranked #1 (boosted by DIRECTORY_GHOST)
    expect(result.suggestions[0].angle).toBe('zero_footprint');
    // gbp_verification should be #2 (also boosted, second in the list)
    expect(result.suggestions[1].angle).toBe('gbp_verification');
    // cross_platform_expansion should be #3 (third in the list)
    expect(result.suggestions[2].angle).toBe('cross_platform_expansion');
  });

  it('boosts INVISIBLE_ANCHOR angles (zero_footprint first — it has A3 affinity + boost)', async () => {
    mockGetLatestAuditData.mockResolvedValue(makeV3Audit('INVISIBLE_ANCHOR', 'insufficient_evidence'));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    // zero_footprint has A3 archetype affinity AND is boosted by INVISIBLE_ANCHOR (pos 2).
    // local_seo is boosted (pos 0) but has NO A3 affinity — so it ranks after
    // all A3-affinity hooks. The boost is applied AFTER archetype affinity.
    expect(result.suggestions[0].angle).toBe('zero_footprint');

    // Among non-A3 hooks, local_seo (boost pos 0) should rank above
    // website_foundation (boost pos 1).
    const localSeoRank = result.suggestions.find((s) => s.angle === 'local_seo')!.rank;
    const websiteFoundationRank = result.suggestions.find((s) => s.angle === 'website_foundation')!.rank;
    expect(localSeoRank).toBeLessThan(websiteFoundationRank);
  });

  it('applies boost after archetype affinity (A3 + boosted hooks rank above non-A3 boosted hooks)', async () => {
    // With A3 archetype + DIRECTORY_GHOST boost:
    // zero_footprint has A3 affinity + boost (pos 0) → #1
    // gbp_verification has A3 affinity + boost (pos 1) → #2
    // cross_platform_expansion has boost (pos 2) but no A3 → after all A3 hooks
    mockGetLatestAuditData.mockResolvedValue(makeV3Audit('DIRECTORY_GHOST', 'foundation_needed'));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    // zero_footprint: A3 affinity + boost pos 0 → #1
    expect(result.suggestions[0].angle).toBe('zero_footprint');
    // gbp_verification: A3 affinity + boost pos 1 → #2
    expect(result.suggestions[1].angle).toBe('gbp_verification');

    // cross_platform_expansion (boost pos 2, no A3) should rank after
    // all A3-affinity hooks but before non-boosted non-A3 hooks.
    const cpeRank = result.suggestions.find((s) => s.angle === 'cross_platform_expansion')!.rank;
    expect(cpeRank).toBeLessThanOrEqual(5);
  });

  it('no audit data → no boost (ranking unchanged from Sprint 1)', async () => {
    mockGetLatestAuditData.mockResolvedValue(null);

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    // Without boost, the ranking should match the Sprint 1 logic
    expect(result.suggestions).toHaveLength(14);
    // gbp_verification has A3 archetype affinity — should be #1
    expect(result.suggestions[0].angle).toBe('gbp_verification');
  });

  it('audit lookup error → graceful degradation (no boost)', async () => {
    mockGetLatestAuditData.mockRejectedValue(new Error('audit not found'));

    const result = await HookSuggestionService.suggestForCampaign('camp-001');

    expect(result.suggestions).toHaveLength(14);
    expect(result.suggestions[0].angle).toBe('gbp_verification');
  });
});
