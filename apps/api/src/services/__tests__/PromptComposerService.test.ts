/**
 * Unit tests for PromptComposerService (Sprint 2 — Seek Intelligence Scope).
 *
 * Tests the composition logic with mocked fragment loading + profile resolution.
 * Verifies:
 *   - emerging + profile → base + extension + profile block + emerging focus
 *   - competitive + profile → base + extension + profile block + competitive focus
 *   - null profile → base + extension + generic fallback + focus
 *   - resolution metadata is correct in all cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock instances are stable across factory + test code
const { mockProfileService, mockPromptService } = vi.hoisted(() => {
  const mockProfileService = {
    resolve: vi.fn(async (_category: string, _focus?: string) => null),
    renderProfileBlock: vi.fn((profile: any) => `PROFILE_BLOCK:${profile.id}:v${profile.version}`),
  };
  const mockPromptService = {
    listTemplates: vi.fn(async (filters: any) => {
      const fragmentBodies: Record<string, string> = {
        seek_category_base: 'BASE_FRAGMENT_BODY',
        seek_intelligence_extension: 'EXTENSION_FRAGMENT_BODY',
        seek_intelligence_focus_emerging: 'FOCUS_EMERGING_BODY',
        seek_intelligence_focus_competitive: 'FOCUS_COMPETITIVE_BODY',
        seek_intelligence_generic_fallback: 'GENERIC_FALLBACK_BODY',
      };
      const kind = filters.fragmentKind;
      if (fragmentBodies[kind]) {
        return [{ body: fragmentBodies[kind] }];
      }
      return [];
    }),
  };
  return { mockProfileService, mockPromptService };
});

vi.mock('../MarketingPromptService', () => ({
  MarketingPromptService: {
    getInstance: () => mockPromptService,
  },
}));

vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => mockProfileService,
  },
}));

import { PromptComposerService } from '../intelligence/PromptComposerService';

describe('PromptComposerService.composeIntelligencePrompt', () => {
  let service: PromptComposerService;

  beforeEach(() => {
    service = PromptComposerService.getInstance();
    vi.clearAllMocks();
    // Reset default behavior: resolve returns null
    mockProfileService.resolve.mockImplementation(async () => null);
  });

  it('composes with emerging focus + active profile', async () => {
    mockProfileService.resolve.mockResolvedValueOnce({
      id: 'auto_repair_us',
      version: 1,
      category_key: 'auto repair',
      category_name: 'Auto Repair',
      intelligence_focus: 'emerging',
      status: 'active',
      configuration_json: {},
    });

    const result = await service.composeIntelligencePrompt({
      category: 'Auto Repair',
      focus: 'emerging',
    });

    expect(result.body).toContain('BASE_FRAGMENT_BODY');
    expect(result.body).toContain('EXTENSION_FRAGMENT_BODY');
    expect(result.body).toContain('PROFILE_BLOCK:auto_repair_us:v1');
    expect(result.body).toContain('FOCUS_EMERGING_BODY');
    expect(result.body).not.toContain('GENERIC_FALLBACK_BODY');

    expect(result.resolution.intelligence_mode).toBe('profile');
    expect(result.resolution.profile_id).toBe('auto_repair_us');
    expect(result.resolution.profile_version).toBe(1);
    expect(result.focus).toBe('emerging');

    // Migration 202 — focus is passed through to the resolver.
    // Migration 205 — city is passed through (undefined when not provided).
    expect(mockProfileService.resolve).toHaveBeenCalledWith('Auto Repair', 'emerging', undefined, undefined);
  });

  it('composes with competitive focus + active profile', async () => {
    mockProfileService.resolve.mockResolvedValueOnce({
      id: 'plumbing_us',
      version: 2,
      category_key: 'plumbing',
      category_name: 'Plumbing',
      intelligence_focus: 'competitive',
      status: 'active',
      configuration_json: {},
    });

    const result = await service.composeIntelligencePrompt({
      category: 'Plumbing',
      focus: 'competitive',
    });

    expect(result.body).toContain('BASE_FRAGMENT_BODY');
    expect(result.body).toContain('EXTENSION_FRAGMENT_BODY');
    expect(result.body).toContain('PROFILE_BLOCK:plumbing_us:v2');
    expect(result.body).toContain('FOCUS_COMPETITIVE_BODY');
    expect(result.body).not.toContain('FOCUS_EMERGING_BODY');

    expect(result.resolution.intelligence_mode).toBe('profile');
    expect(result.resolution.profile_id).toBe('plumbing_us');
    expect(result.resolution.profile_version).toBe(2);
    expect(result.focus).toBe('competitive');

    // Migration 202 — focus is passed through to the resolver.
    // Migration 205 — city is passed through (undefined when not provided).
    expect(mockProfileService.resolve).toHaveBeenCalledWith('Plumbing', 'competitive', undefined, undefined);
  });

  it('Migration 205 — passes city through to the resolver and renderProfileBlock', async () => {
    mockProfileService.resolve.mockResolvedValueOnce({
      id: 'african_grocery_zionsville',
      version: 1,
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      intelligence_focus: 'competitive',
      reference_city: 'zionsville',
      status: 'active',
      configuration_json: {},
    });

    const result = await service.composeIntelligencePrompt({
      category: 'African Grocery Store',
      focus: 'competitive',
      city: 'Zionsville',
    });

    expect(result.resolution.profile_id).toBe('african_grocery_zionsville');
    // City is passed to resolve
    expect(mockProfileService.resolve).toHaveBeenCalledWith('African Grocery Store', 'competitive', 'Zionsville', undefined);
    // City is passed to renderProfileBlock so it can emit a retargeting directive
    expect(mockProfileService.renderProfileBlock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'african_grocery_zionsville' }),
      'Zionsville',
    );
  });

  it('composes with null profile → generic fallback + intelligence_mode none', async () => {
    mockProfileService.resolve.mockResolvedValueOnce(null);

    const result = await service.composeIntelligencePrompt({
      category: 'Unknown Category',
      focus: 'emerging',
    });

    expect(result.body).toContain('BASE_FRAGMENT_BODY');
    expect(result.body).toContain('EXTENSION_FRAGMENT_BODY');
    expect(result.body).toContain('GENERIC_FALLBACK_BODY');
    expect(result.body).toContain('FOCUS_EMERGING_BODY');
    expect(result.body).not.toContain('PROFILE_BLOCK:');

    expect(result.resolution.intelligence_mode).toBe('none');
    expect(result.resolution.profile_id).toBeNull();
    expect(result.resolution.profile_version).toBeNull();
  });

  it('assembled body does not contain business_name variable reference', async () => {
    mockProfileService.resolve.mockResolvedValueOnce(null);

    const result = await service.composeIntelligencePrompt({
      category: 'Auto Repair',
      focus: 'emerging',
    });

    // The fragments are mocked with static strings, but we verify the
    // assembly structure — no business_name reference should be in the
    // intelligence-scope composed body.
    expect(result.body).not.toContain('{{business_name}}');
  });
});
