/**
 * Unit tests for ProfileRepairPromptService briefing persistence (§2).
 *
 * Tests that executeSeekSync persists the triage briefing on the campaign
 * row with provenance metadata (_execution_id, _validated), and that
 * best-effort output is flagged as unvalidated.
 *
 * These tests mock Prisma + the AI execution path to isolate the
 * persistence logic. The pure-logic tests (resolveSeekTemplateId,
 * serializeSignals, etc.) live in ProfileRepairPromptService.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaigns,
  mockExecutions,
  mockExecuteSingle,
} = vi.hoisted(() => ({
  mockCampaigns: { findUnique: vi.fn(), update: vi.fn() },
  mockExecutions: { findMany: vi.fn() },
  mockExecuteSingle: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaigns,
    mkt_prompt_executions_list: mockExecutions,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// MarketingExecutionService is a named import with static getInstance()
vi.mock('../MarketingExecutionService', () => ({
  MarketingExecutionService: {
    getInstance: () => ({ executeSingle: mockExecuteSingle }),
  },
}));

// MarketingPromptService is a named import with static getInstance()
vi.mock('../MarketingPromptService', () => ({
  MarketingPromptService: {
    getInstance: () => ({
      getTemplate: vi.fn().mockResolvedValue({
        id: 'mpt-profile-repair-triage-default',
        prompt_type: 'seek',
        output_schema: { name: 'profile_repair_triage' },
      }),
      createExecution: vi.fn().mockResolvedValue({ id: 'exec-test-1' }),
      updateExecution: vi.fn().mockResolvedValue({}),
    }),
  },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: {
    transitionStage: vi.fn().mockResolvedValue({}),
  },
}));

// signal-extractor is imported as { extractSignals }
vi.mock('../triage/signal-extractor', () => ({
  extractSignals: vi.fn().mockReturnValue([]),
}));

vi.mock('../ai-providers', () => ({
  default: { getProvider: vi.fn().mockReturnValue(null) },
}));

import { ProfileRepairPromptService, PROFILE_REPAIR_TRIAGE_TEMPLATE_ID } from '../ProfileRepairPromptService';

describe('ProfileRepairPromptService — briefing persistence (§2)', () => {
  let service: ProfileRepairPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = ProfileRepairPromptService.getInstance();
    mockCampaigns.findUnique.mockResolvedValue({
      id: 'camp-1',
      campaign_category: 'profile_repair',
      repair_issue_type: null,
      category: 'HVAC',
      city: 'Plainfield',
      mkt_audits_list: [{ audit_data: { detected_signals: [] } }],
    });
    mockCampaigns.update.mockResolvedValue({});
  });

  it('persists repair_triage_briefing with _execution_id and _validated=true on strict validation pass', async () => {
    // A well-formed triage output that passes strict Zod validation
    const validTriageOutput = JSON.stringify({
      profile_repair_triage: {
        severity_score: 6,
        recommended_track: 'standard',
        issue_type_confirmed: 'nap_drift',
        rationale: 'NAP drift detected across 3 platforms.',
        scope: {
          summary: 'Phone and address differ on Apple Maps and Yelp.',
          broken_platforms: ['apple', 'yelp'],
          drift_details: 'Phone differs on Apple Maps; address differs on Yelp.',
          missing_assets: [],
        },
        viability: {
          pursuit_recommendation: 'pursue',
          rationale: 'High-impact repair with clear evidence.',
        },
        pitch: {
          primary_angle: 'NAP consistency',
          opener_hook: 'Hi, I noticed your business phone is different on Apple Maps.',
          pain_points: ['Customers find wrong number'],
          marketplace_positioning: 'Competitors have consistent NAP.',
        },
        risks: ['Postcard verification may be required.'],
        escalation_signals: [],
        standard_signals: ['nap_drift'],
      },
    });

    mockExecuteSingle.mockResolvedValue({
      id: 'exec-strict-1',
      raw_output: validTriageOutput,
    });

    await service.executeSeekSync('camp-1', PROFILE_REPAIR_TRIAGE_TEMPLATE_ID);

    expect(mockCampaigns.update).toHaveBeenCalledOnce();
    const updateArg = mockCampaigns.update.mock.calls[0][0];
    expect(updateArg.where.id).toBe('camp-1');
    const briefing = updateArg.data.repair_triage_briefing;
    expect(briefing._execution_id).toBe('exec-strict-1');
    expect(briefing._validated).toBe(true);
    expect(briefing.severity_score).toBe(6);
    expect(briefing.recommended_track).toBe('standard');
  });

  it('persists with _validated=false when strict validation fails but best-effort extraction succeeds', async () => {
    // Missing required fields — strict Zod fails, but profile_repair_triage exists
    const partialOutput = JSON.stringify({
      profile_repair_triage: {
        severity_score: 5,
        recommended_track: 'standard',
        issue_type_confirmed: 'nap_drift',
        rationale: 'Partial output.',
        // Missing scope, viability, pitch, risks — strict validation fails
      },
    });

    mockExecuteSingle.mockResolvedValue({
      id: 'exec-best-effort-1',
      raw_output: partialOutput,
    });

    await service.executeSeekSync('camp-1', PROFILE_REPAIR_TRIAGE_TEMPLATE_ID);

    expect(mockCampaigns.update).toHaveBeenCalledOnce();
    const briefing = mockCampaigns.update.mock.calls[0][0].data.repair_triage_briefing;
    expect(briefing._validated).toBe(false);
    expect(briefing._execution_id).toBe('exec-best-effort-1');
  });

  it('does not write repair_triage_briefing when AI output fails to parse (previous briefing preserved)', async () => {
    mockExecuteSingle.mockResolvedValue({
      id: 'exec-fail-1',
      raw_output: 'not valid json {{{',
    });

    await service.executeSeekSync('camp-1', PROFILE_REPAIR_TRIAGE_TEMPLATE_ID);

    // No update should have been called — previous briefing is preserved
    expect(mockCampaigns.update).not.toHaveBeenCalled();
  });

  it('does not write when a per-issue template is used (not the triage template)', async () => {
    mockExecuteSingle.mockResolvedValue({
      id: 'exec-nap-1',
      raw_output: JSON.stringify({
        profile_repair_audit: {
          severityScore: 7,
          issueType: 'nap_drift',
          scope: { summary: 'test', affected_platforms: [], specifics: 'test' },
          impact: { primary_consequence: 'test', estimated_reach_loss: 'test', competitive_gap: 'test' },
          pitch: { opener_hook: 'test', pain_points: [], value_preview: 'test' },
          risks: [],
        },
      }),
    });

    await service.executeSeekSync('camp-1', 'mpt-profile-repair-nap-drift-seek');

    // Per-issue templates don't persist to repair_triage_briefing
    expect(mockCampaigns.update).not.toHaveBeenCalled();
  });
});
