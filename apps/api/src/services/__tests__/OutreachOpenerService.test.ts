/**
 * Unit tests for OutreachOpenerService.createFromBriefing
 *
 * Tests the AI briefing → opener handoff path:
 *   - Creates an opener with source='ai_briefing' and hook_angle=null
 *   - Upserts in place (one opener per campaign)
 *   - Quality-gate failure does not block creation
 *   - Stores provenance in extracted_fields
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockOpeners,
} = vi.hoisted(() => ({
  mockOpeners: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_outreach_openers_list: mockOpeners,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: {
    getCampaign: vi.fn().mockResolvedValue({
      id: 'camp-1',
      business_name: 'Test Biz',
      category: 'HVAC',
      city: 'Plainfield',
      campaign_category: 'profile_repair',
      audits: [
        {
          id: 'audit-1',
          platform: 'business_analysis',
          audit_data: { nap_consistency: {} },
          created_at: new Date().toISOString(),
        },
      ],
    }),
    transitionStage: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../CampaignTriageService', () => ({
  default: {
    getInstance: () => ({ getTriageResult: vi.fn().mockResolvedValue(null) }),
  },
}));

vi.mock('../deliverable/BusinessContextService', () => ({
  default: {
    getInstance: () => ({ buildContext: vi.fn().mockResolvedValue(null) }),
  },
}));

vi.mock('../ai-providers', () => ({
  default: { getProvider: vi.fn().mockReturnValue(null) },
}));

vi.mock('../outreach-openers', () => ({
  selectArchetype: vi.fn().mockReturnValue({ archetype: 'A3', label: 'Listing Inconsistency' }),
  extractFields: vi.fn().mockReturnValue({ business_name: 'Test Biz', category: 'HVAC' }),
  buildArchetypePrompt: vi.fn().mockReturnValue('resolved prompt'),
  runQualityGate: vi.fn().mockReturnValue({ passed: true, issues: [] }),
  DEFAULT_CLOSE_VARIANT: 'soft',
}));

vi.mock('../../lib/id-generator', () => ({
  generateOutreachOpenerId: () => 'opener-test-001',
}));

import { OutreachOpenerService } from '../OutreachOpenerService';

describe('OutreachOpenerService.createFromBriefing', () => {
  let service: OutreachOpenerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = OutreachOpenerService.getInstance();
  });

  it('creates an opener with source=ai_briefing and hook_angle=null when no existing opener', async () => {
    mockOpeners.findFirst.mockResolvedValue(null);
    mockOpeners.create.mockResolvedValue({ id: 'opener-test-001', source: 'ai_briefing' });

    const result = await service.createFromBriefing({
      campaignId: 'camp-1',
      openerText: 'Hi, I noticed your business listing has inconsistent NAP data across platforms.',
      primaryAngle: 'NAP consistency drives local search visibility',
      sourceBriefing: 'triage',
      executionId: 'exec-1',
    });

    expect(mockOpeners.create).toHaveBeenCalledOnce();
    const createArg = mockOpeners.create.mock.calls[0][0].data;
    expect(createArg.source).toBe('ai_briefing');
    expect(createArg.hook_angle).toBeNull();
    expect(createArg.opener_text).toContain('inconsistent NAP data');
    expect(createArg.extracted_fields.sourceBriefing).toBe('triage');
    expect(createArg.extracted_fields.executionId).toBe('exec-1');
    expect(createArg.extracted_fields.primaryAngle).toBe('NAP consistency drives local search visibility');
    expect(result.opener.id).toBe('opener-test-001');
  });

  it('updates the existing opener in place when one already exists (no unique-constraint error)', async () => {
    mockOpeners.findFirst.mockResolvedValue({ id: 'opener-existing-1', source: 'external' });
    mockOpeners.update.mockResolvedValue({ id: 'opener-existing-1', source: 'ai_briefing' });

    const result = await service.createFromBriefing({
      campaignId: 'camp-1',
      openerText: 'Hi, I noticed your business listing has inconsistent NAP data across platforms.',
      sourceBriefing: 'issue_audit',
      executionId: 'exec-2',
    });

    expect(mockOpeners.create).not.toHaveBeenCalled();
    expect(mockOpeners.update).toHaveBeenCalledOnce();
    const updateArg = mockOpeners.update.mock.calls[0][0];
    expect(updateArg.where.id).toBe('opener-existing-1');
    expect(updateArg.data.source).toBe('ai_briefing');
    expect(result.opener.id).toBe('opener-existing-1');
  });

  it('stores quality_gate_passed=false and issues on gate failure (does not throw)', async () => {
    const { runQualityGate } = await import('../outreach-openers');
    (runQualityGate as any).mockReturnValue({
      passed: false,
      issues: ['Too long', 'Missing signoff'],
    });

    mockOpeners.findFirst.mockResolvedValue(null);
    mockOpeners.create.mockResolvedValue({ id: 'opener-test-002' });

    const result = await service.createFromBriefing({
      campaignId: 'camp-1',
      openerText: 'Hi, I noticed your business listing has inconsistent NAP data across platforms.',
      sourceBriefing: 'triage',
    });

    expect(result.qualityGate.passed).toBe(false);
    expect(result.qualityGate.issues).toHaveLength(2);
    const createArg = mockOpeners.create.mock.calls[0][0].data;
    expect(createArg.quality_gate_passed).toBe(false);
    expect(createArg.quality_gate_issues).toHaveLength(2);
  });

  it('stores provenance fields in extracted_fields', async () => {
    mockOpeners.findFirst.mockResolvedValue(null);
    mockOpeners.create.mockResolvedValue({ id: 'opener-test-003' });

    await service.createFromBriefing({
      campaignId: 'camp-1',
      openerText: 'Hi, I noticed your business listing has inconsistent NAP data across platforms.',
      primaryAngle: 'Reach loss from NAP drift',
      sourceBriefing: 'issue_audit',
      executionId: 'exec-3',
    });

    const createArg = mockOpeners.create.mock.calls[0][0].data;
    expect(createArg.extracted_fields.sourceBriefing).toBe('issue_audit');
    expect(createArg.extracted_fields.executionId).toBe('exec-3');
    expect(createArg.extracted_fields.primaryAngle).toBe('Reach loss from NAP drift');
  });
});
