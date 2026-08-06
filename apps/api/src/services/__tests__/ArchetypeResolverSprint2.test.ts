/**
 * Sprint 2 tests for the shared archetype resolver — resolveCampaignArchetype.
 *
 * Verifies:
 *   1. Operator-accepted triage result → returns triage archetype (source: 'triage')
 *   2. Overridden playbook → returns overridden archetype (not recommended)
 *   3. No triage / not accepted → falls back to selectArchetype (source: 'fallback')
 *   4. No audit → throws
 *
 * See: docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md §5.5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────

const {
  mockTriageGetResult,
  mockCampaigns,
} = vi.hoisted(() => ({
  mockTriageGetResult: vi.fn(),
  mockCampaigns: { findUnique: vi.fn() },
}));

// Mock CampaignTriageService directly — the real service does complex Prisma
// joins + field mapping that's hard to mock at the prisma layer.
vi.mock('../CampaignTriageService', () => ({
  default: {
    getInstance: () => ({
      getTriageResult: mockTriageGetResult,
    }),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaigns,
    mkt_owner_voice_profile: { findUnique: vi.fn() },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../middleware/errorHandler', () => ({
  NotFoundError: class NotFoundError extends Error {},
}));

vi.mock('../ai-providers', () => ({
  default: { generateChatCompletion: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateOutreachOpenerId: () => 'moo-test-001',
}));

import { resolveCampaignArchetype } from '../OutreachOpenerService';

// ─── Fixtures ────────────────────────────────────────────────────────────

const productBusinessAudit = (overrides: Partial<any> = {}) => ({
  id: 'mcamp-a6',
  business_name: 'Indy African Market',
  category: 'grocery_store',
  city: 'Indianapolis',
  state: 'IN',
  tone: 'short informal',
  phone: '317-555-0100',
  website_url: null,
  mkt_audits_list: [
    {
      id: 'audit-a6',
      platform: 'business_analysis',
      created_at: new Date('2024-06-01'),
      audit_data: {
        business_type: 'product',
        platforms: {
          google: {
            displayed_name: 'Indy African Market',
            displayed_phone: '317-555-0100',
            photo_count: 3,
            photo_types: ['logo'],
            special_hours_present: false,
          },
        },
        negative_review_themes: [],
        nap_consistency: { overall_status: 'consistent' },
        website: {
          url: null,
          has_product_browsing: false,
          has_availability_inquiry: false,
          has_pickup_ordering: false,
          has_delivery_option: false,
          call_to_action_present: 'no',
          click_to_call_available: 'no',
          has_booking: null,
          conversion_opportunities: [],
        },
        combined_review_metrics: {
          observable_unanswered_rate_percent: 10,
          observable_unanswered_reviews: 2,
        },
      },
    },
  ],
  ...overrides,
});

/** StoredTriageResult shape — matches what CampaignTriageService.getTriageResult returns. */
const triageResult = (
  archetype: string,
  code: string,
  accepted: boolean,
  overriddenArchetype?: string,
) => ({
  id: 'triage-1',
  campaignId: 'mcamp-a6',
  recommendedPlaybook: { archetype, code, name: 'Test Playbook' },
  overriddenPlaybook: overriddenArchetype
    ? { archetype: overriddenArchetype, code: 'PB-07', name: 'Product Visibility' }
    : null,
  confidenceScore: 0.85,
  triageReasoning: 'test',
  detectedSignals: [],
  isOperatorAccepted: accepted,
  evaluatedAt: new Date(),
  sourceAudit: null,
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('resolveCampaignArchetype — Sprint 2 shared resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the triage archetype when operator-accepted (source: triage)', async () => {
    mockTriageGetResult.mockResolvedValue(triageResult('A6', 'PB-07', true));
    mockCampaigns.findUnique.mockResolvedValue(productBusinessAudit());

    const result = await resolveCampaignArchetype('mcamp-a6');

    expect(result.archetype).toBe('A6');
    expect(result.source).toBe('triage');
    expect(result.reason).toContain('triage-accepted');
  });

  it('returns the overridden playbook archetype when override is present', async () => {
    // Recommended was A1, but operator overrode to A6
    mockTriageGetResult.mockResolvedValue(triageResult('A1', 'PB-02', true, 'A6'));
    mockCampaigns.findUnique.mockResolvedValue(productBusinessAudit());

    const result = await resolveCampaignArchetype('mcamp-a6');

    expect(result.archetype).toBe('A6');
    expect(result.source).toBe('triage');
  });

  it('falls back to selectArchetype when triage is not accepted (source: fallback)', async () => {
    mockTriageGetResult.mockResolvedValue(triageResult('A6', 'PB-07', false));
    mockCampaigns.findUnique.mockResolvedValue(productBusinessAudit());

    const result = await resolveCampaignArchetype('mcamp-a6');

    // selectArchetype fallback — for this product-business audit with no
    // website, no product browsing, low photo count → A6
    expect(result.source).toBe('fallback');
    expect(result.archetype).toBe('A6');
  });

  it('falls back to selectArchetype when no triage result exists', async () => {
    mockTriageGetResult.mockResolvedValue(null);
    mockCampaigns.findUnique.mockResolvedValue(productBusinessAudit());

    const result = await resolveCampaignArchetype('mcamp-a6');

    expect(result.source).toBe('fallback');
  });

  it('throws when no audit exists and no triage is accepted', async () => {
    mockTriageGetResult.mockResolvedValue(null);
    mockCampaigns.findUnique.mockResolvedValue({
      id: 'mcamp-empty',
      mkt_audits_list: [],
    });

    await expect(resolveCampaignArchetype('mcamp-empty')).rejects.toThrow(
      /no business_analysis audit/i,
    );
  });

  it('returns A1 for a service-business audit via fallback', async () => {
    mockTriageGetResult.mockResolvedValue(null);
    mockCampaigns.findUnique.mockResolvedValue({
      id: 'mcamp-a1',
      business_name: 'Reliable HVAC',
      category: 'hvac',
      city: 'Austin',
      state: 'TX',
      tone: 'short informal',
      phone: '555-123-4567',
      website_url: 'https://example.com',
      mkt_audits_list: [
        {
          id: 'audit-a1',
          platform: 'business_analysis',
          created_at: new Date(),
          audit_data: {
            platforms: { google: { displayed_name: 'Reliable HVAC' } },
            negative_review_themes: [
              { theme: 'pricing', summary: 'Too high', supporting_review_count: 3 },
            ],
            nap_consistency: { overall_status: 'consistent' },
            website: {
              url: 'https://example.com',
              has_booking: true,
              call_to_action_present: 'yes',
              click_to_call_available: 'yes',
              conversion_opportunities: [],
            },
            combined_review_metrics: {
              observable_unanswered_rate_percent: 70,
              observable_unanswered_reviews: 12,
            },
          },
        },
      ],
    });

    const result = await resolveCampaignArchetype('mcamp-a1');

    expect(result.source).toBe('fallback');
    // HVAC with high unanswered rate + negative themes → A1 or A2
    expect(['A1', 'A2']).toContain(result.archetype);
  });
});
