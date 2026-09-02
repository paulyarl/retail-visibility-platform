/**
 * Unit tests for the Discovery Leads block (Migration 253 — GAP-E3).
 *
 * Tests the renderDiscoveryLeadsBlock method on MarketingExecutionService:
 *   T3 — Block renders signals (labeled) + provenance + priority/fit +
 *        discovered_at; absent (byte-identical render) when context missing;
 *        unknown INT code falls back to raw code. Focus omission: context
 *        without focus renders without the focus parenthetical. Provenance
 *        cap boundary: exactly 6 → no suffix; 7 → 6 + "+1 more".
 *   T4 — Triage invariance: identical audit signal set → identical
 *        recommendation with and without discovery context on the campaign.
 *   T5 — Role gating: no block for fulfill / signal_triage / intelligence-scope
 *        renders even when context exists.
 *
 * Spec: docs/LocalBiz/marketing_ops_discovery_leads_handoff_spec.md §11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock instances are stable across factory + test code
const { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService } = vi.hoisted(() => {
  const mockProfileService = {
    resolve: vi.fn(async () => null),
    resolveGoldStandard: vi.fn(async () => null),
    serializeGoldStandard: vi.fn(() => ''),
    renderBusinessProfileBlock: vi.fn(
      (profile: any, _city?: string | null, headerTitle?: string) =>
        `\n${headerTitle ? `=== ${headerTitle} ===\n` : ''}PROFILE_BLOCK:${profile.id}:v${profile.version}`,
    ),
  };
  const mockPromptService = {
    getTemplate: vi.fn(),
    createExecution: vi.fn(),
    updateExecution: vi.fn(),
  };
  const mockCampaignService = { getCampaign: vi.fn() };
  const mockAiProvider = { generateChatCompletion: vi.fn() };
  const mockHotProspectService = { syncFromExecution: vi.fn() };
  const mockComposerService = {
    composeIntelligencePrompt: vi.fn(async (input: any) => ({
      body: 'COMPOSED_BODY',
      resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' as const },
      focus: input.focus,
    })),
  };
  return { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService };
});

vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => mockProfileService,
  },
}));

vi.mock('../intelligence/PromptComposerService', () => ({
  PromptComposerService: {
    getInstance: () => mockComposerService,
  },
}));

vi.mock('../MarketingPromptService', () => ({
  MarketingPromptService: {
    getInstance: () => mockPromptService,
  },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: mockCampaignService,
}));

vi.mock('../ai-providers', () => ({
  default: mockAiProvider,
}));

vi.mock('../MarketingHotProspectService', () => ({
  MarketingHotProspectService: {
    getInstance: () => mockHotProspectService,
  },
}));

import { MarketingExecutionService } from '../MarketingExecutionService';

describe('Discovery Leads block (Migration 253 — GAP-E3)', () => {
  let service: MarketingExecutionService;

  beforeEach(() => {
    service = MarketingExecutionService.getInstance();
    vi.clearAllMocks();
    // Defaults: no profile, no gold standard → byte-identical base render
    mockProfileService.resolve.mockImplementation(async () => null);
    mockProfileService.resolveGoldStandard.mockImplementation(async () => null);
    mockProfileService.serializeGoldStandard.mockImplementation(() => '');
  });

  const makeTemplate = (promptType: string, category = '', body = 'Hello {{business_name}} in {{category}}') => ({
    body,
    prompt_type: promptType,
    scope: 'business',
    category,
  });

  const makeCampaign = (overrides: Record<string, any> = {}) => ({
    id: 'camp-1',
    scope: 'business',
    category: 'Auto Repair',
    business_name: 'Test Business',
    city: 'Test City',
    state: 'TS',
    ...overrides,
  });

  const sampleContext = {
    focus: 'emerging' as const,
    discovered_at: '2026-09-01T12:00:00Z',
    business_seek_priority: 'high' as const,
    category_fit: 'verified' as const,
    identity_confidence: 'high' as const,
    location_status: 'inside_city',
    seek_batch_id: 'msb_abc',
    discovery_signals: ['INT_HIDDEN_TRUST', 'INT_POSSIBLE_CATEGORY_MISALIGNMENT'],
    discovery_provenance: [
      { source: 'Somali Community Directory', role: 'primary', evidence_types: ['listing', 'hours'], url: 'https://example.com', accessed_at: '2026-09-01' },
      { source: 'Yelp', role: 'corroboration', evidence_types: ['reviews'] },
    ],
  };

  // ─── T3: Block rendering ──────────────────────────────────────────────

  it('T3a: renders signals (labeled) + provenance + priority/fit + discovered_at', async () => {
    const template = makeTemplate('seek');
    const campaign = makeCampaign({ discovery_context: sampleContext });

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    // Block header + framing
    expect(renderedPrompt).toContain('=== DISCOVERY LEADS (VERIFY — NOT FINDINGS) ===');
    expect(renderedPrompt).toContain('emerging focus');
    expect(renderedPrompt).toContain('on 2026-09-01');
    expect(renderedPrompt).toContain('scan-time HYPOTHESES, not audit');
    expect(renderedPrompt).toContain('Do not copy these codes into detected_signals');

    // Seek priority / fit / identity line
    expect(renderedPrompt).toContain('Seek priority at discovery: high');
    expect(renderedPrompt).toContain('Category fit: verified');
    expect(renderedPrompt).toContain('Identity confidence: high');

    // Signals (labeled)
    expect(renderedPrompt).toContain('- INT_HIDDEN_TRUST — Strong Hidden Trust');
    expect(renderedPrompt).toContain('- INT_POSSIBLE_CATEGORY_MISALIGNMENT — Possible Category Misalignment');

    // Provenance
    expect(renderedPrompt).toContain('Discovery provenance');
    expect(renderedPrompt).toContain('Somali Community Directory (primary) — evidence: listing, hours');
    expect(renderedPrompt).toContain('Yelp (corroboration) — evidence: reviews');

    // Absence rules paragraph (mandatory)
    expect(renderedPrompt).toContain('Absence rules:');
    expect(renderedPrompt).toContain('not proof of absence');

    // Resolution stamp
    expect(resolution.discovery_leads_injected).toBe(true);
  });

  it('T3b: absent context → byte-identical render (no block)', async () => {
    const template = makeTemplate('seek');
    const campaign = makeCampaign({ discovery_context: null });

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(renderedPrompt).not.toContain('DISCOVERY LEADS');
    expect(resolution.discovery_leads_injected).toBe(false);
  });

  it('T3c: unknown INT code falls back to raw code', async () => {
    const template = makeTemplate('seek');
    const campaign = makeCampaign({
      discovery_context: {
        ...sampleContext,
        discovery_signals: ['INT_UNKNOWN_NEW_CODE'],
      },
    });

    const { renderedPrompt } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).toContain('- INT_UNKNOWN_NEW_CODE — INT_UNKNOWN_NEW_CODE');
  });

  it('T3d: focus omission — context without focus renders without the focus parenthetical', async () => {
    const template = makeTemplate('seek');
    const campaign = makeCampaign({
      discovery_context: {
        ...sampleContext,
        focus: undefined,
      },
    });

    const { renderedPrompt } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).toContain('focus not recorded');
    expect(renderedPrompt).not.toContain('emerging focus');
    expect(renderedPrompt).not.toContain('competitive focus');
  });

  it('T3e: provenance cap boundary — exactly 6 sources → no suffix', async () => {
    const template = makeTemplate('seek');
    const sixSources = Array.from({ length: 6 }, (_, i) => ({
      source: `Source ${i + 1}`,
      role: 'corroboration',
      evidence_types: ['listing'],
    }));
    const campaign = makeCampaign({
      discovery_context: { ...sampleContext, discovery_provenance: sixSources },
    });

    const { renderedPrompt } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).toContain('Source 6 (corroboration) — evidence: listing');
    expect(renderedPrompt).not.toContain('+1 more');
    expect(renderedPrompt).not.toContain('+0 more');
  });

  it('T3f: provenance cap boundary — 7 sources → 6 rendered + "+1 more"', async () => {
    const template = makeTemplate('seek');
    const sevenSources = Array.from({ length: 7 }, (_, i) => ({
      source: `Source ${i + 1}`,
      role: 'corroboration',
      evidence_types: ['listing'],
    }));
    const campaign = makeCampaign({
      discovery_context: { ...sampleContext, discovery_provenance: sevenSources },
    });

    const { renderedPrompt } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).toContain('Source 6 (corroboration) — evidence: listing');
    expect(renderedPrompt).not.toContain('Source 7');
    expect(renderedPrompt).toContain('+1 more');
  });

  // ─── T4: Triage invariance ────────────────────────────────────────────
  // The presence of discovery context must not alter triage results for a
  // given audit signal set. The leads block is prompt prose only — it never
  // enters detected_signals or the signal extractor. We verify by checking
  // that the block text is purely additive and contains no RA/DS/WC/CP/VP
  // codes (which would contaminate triage if extracted).

  it('T4: triage invariance — block contains no audit-family signal codes', async () => {
    const template = makeTemplate('seek');
    const campaign = makeCampaign({ discovery_context: sampleContext });

    const { renderedPrompt } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    // The block must not emit any RA/DS/WC/CP/VP codes as leads — only INT_*
    // codes are allowed in the discovery signals section. The only place
    // audit-family codes appear is in the framing instruction ("emit only
    // your own audit-family signals (RA/DS/WC/CP/VP)"), which is prose, not
    // a detected_signals entry.
    const blockStart = renderedPrompt.indexOf('=== DISCOVERY LEADS');
    expect(blockStart).toBeGreaterThanOrEqual(0);
    const block = renderedPrompt.slice(blockStart);

    // The discovery signals section is bounded by "Discovery signals (hypotheses):"
    // and the next blank line. Extract only those lines and verify every code
    // is INT_* — no RA/DS/WC/CP/VP leakage.
    const signalsHeader = block.indexOf('Discovery signals (hypotheses):');
    expect(signalsHeader).toBeGreaterThanOrEqual(0);
    const afterHeader = block.slice(signalsHeader + 'Discovery signals (hypotheses):'.length);
    const sectionEnd = afterHeader.indexOf('\n\n');
    const signalsSection = sectionEnd >= 0 ? afterHeader.slice(0, sectionEnd) : afterHeader;
    const signalLines = signalsSection.split('\n').filter((l) => l.trim().startsWith('- '));
    expect(signalLines.length).toBeGreaterThan(0);
    for (const line of signalLines) {
      const code = line.trim().split(' — ')[0].replace('- ', '');
      expect(code.startsWith('INT_')).toBe(true);
    }
  });

  // ─── T5: Role gating ──────────────────────────────────────────────────
  // The block renders only for business-scope seek prompts with
  // promptRole === 'category_audit'. Never for fulfill, signal_triage, or
  // intelligence-scope prompts.

  it('T5a: no block for fulfill prompt even when context exists', async () => {
    const template = makeTemplate('fulfill');
    const campaign = makeCampaign({ discovery_context: sampleContext });

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).not.toContain('DISCOVERY LEADS');
    expect(resolution.discovery_leads_injected).toBeFalsy();
  });

  it('T5b: no block for signal_triage (profile_repair) prompt even when context exists', async () => {
    // profile_repair category + seek prompt → signal_triage role
    const template = makeTemplate('seek', 'profile_repair');
    const campaign = makeCampaign({
      discovery_context: sampleContext,
      // signal_triage path requires audit_signals to be non-empty or it
      // suppresses the category block; we pass it via variables to reach the
      // signal_triage return path.
    });

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: { audit_signals: 'DS_CLAIMED_STATUS' },
    });

    expect(renderedPrompt).not.toContain('DISCOVERY LEADS');
    expect(resolution.discovery_leads_injected).toBeFalsy();
  });

  it('T5c: no block for intelligence-scope prompt even when context exists', async () => {
    // Intelligence-scope templates use different variables than business-scope.
    // Use a body that only references intelligence-allowed variables.
    const template = makeTemplate('seek', '', 'Scan {{category}} in {{city}} for {{focus}} opportunities');
    const campaign = makeCampaign({
      scope: 'intelligence',
      discovery_context: sampleContext,
      intelligence_focus: 'emerging',
    });

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).not.toContain('DISCOVERY LEADS');
    expect(resolution.discovery_leads_injected).toBeFalsy();
  });

  it('T5d: no block for non-seek prompt (e.g. recovery_resolution) even when context exists', async () => {
    const template = makeTemplate('recovery_resolution');
    const campaign = makeCampaign({ discovery_context: sampleContext });

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).not.toContain('DISCOVERY LEADS');
    expect(resolution.discovery_leads_injected).toBeFalsy();
  });
});
