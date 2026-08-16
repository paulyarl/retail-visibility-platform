/**
 * Focus-alignment tests for IntelligenceProfileService (Migration 202 — Profile
 * Type Alignment).
 *
 * Tests the focus-aware resolution + type-scoped activation behavior with a
 * mocked Prisma client. Verifies:
 *   - resolve(category, 'emerging') with an emerging active profile → returns it
 *   - resolve(category, 'competitive') with a competitive active profile → returns it
 *   - resolve(category, 'emerging') with no emerging but a competitive active →
 *     falls back to competitive (legacy behavior) — ghost-bug detection path
 *   - resolve(category, 'emerging') with both active → returns emerging (exact wins)
 *   - resolve(category) with no focus → category-only match (business §1B path)
 *   - activateDraft retires only the same-focus active profile
 *   - importAsDraft stamps the focus onto the draft
 *   - publishVersion carries the focus from the latest version
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma ──────────────────────────────────────────────────────────
// We mock the BaseService.prisma getter to return a controllable fake client.

const mockPrisma = {
  mkt_intelligence_profiles: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
};

vi.mock('../BaseService', () => {
  class MockBaseService {
    get prisma() {
      return mockPrisma;
    }
    handleError(error: any, _ctx?: any) {
      return error;
    }
  }
  return { BaseService: MockBaseService };
});

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { IntelligenceProfileService, normalizeCategoryKey } from '../intelligence/IntelligenceProfileService';

describe('IntelligenceProfileService — focus-aware resolution (Migration 202)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    service = IntelligenceProfileService.getInstance();
    vi.clearAllMocks();
  });

  it('resolve(category, "emerging") with an emerging active profile → returns it', async () => {
    const emergingProfile = {
      id: 'auto_repair_emerging',
      category_key: 'auto repair',
      category_name: 'Auto Repair',
      version: 1,
      intelligence_focus: 'emerging',
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(emergingProfile);

    const result = await service.resolve('Auto Repair', 'emerging');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('auto_repair_emerging');
    expect(result!.intelligence_focus).toBe('emerging');
    // Should have queried with focus filter
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith({
      where: {
        category_key: 'auto repair',
        intelligence_focus: 'emerging',
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });
  });

  it('resolve(category, "competitive") with a competitive active profile → returns it', async () => {
    const competitiveProfile = {
      id: 'auto_repair_competitive',
      category_key: 'auto repair',
      category_name: 'Auto Repair',
      version: 1,
      intelligence_focus: 'competitive',
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(competitiveProfile);

    const result = await service.resolve('Auto Repair', 'competitive');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('auto_repair_competitive');
    expect(result!.intelligence_focus).toBe('competitive');
  });

  it('resolve(category, "emerging") with no emerging but a competitive active → falls back to competitive', async () => {
    // First call (focus-specific) returns null
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    // Second call (fallback) returns the competitive profile
    const competitiveProfile = {
      id: 'auto_repair_competitive',
      category_key: 'auto repair',
      category_name: 'Auto Repair',
      version: 1,
      intelligence_focus: 'competitive',
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(competitiveProfile);

    const result = await service.resolve('Auto Repair', 'emerging');

    // Fallback returns the competitive profile (legacy behavior)
    expect(result).not.toBeNull();
    expect(result!.id).toBe('auto_repair_competitive');
    expect(result!.intelligence_focus).toBe('competitive');
    // Two queries: first focus-specific, second fallback
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledTimes(2);
  });

  it('resolve(category, "emerging") with both active → returns emerging (exact match wins)', async () => {
    const emergingProfile = {
      id: 'auto_repair_emerging',
      category_key: 'auto repair',
      category_name: 'Auto Repair',
      version: 1,
      intelligence_focus: 'emerging',
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(emergingProfile);

    const result = await service.resolve('Auto Repair', 'emerging');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('auto_repair_emerging');
    expect(result!.intelligence_focus).toBe('emerging');
    // Only one query — exact match found, no fallback
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledTimes(1);
  });

  it('resolve(category) with no focus → category-only match (business §1B path)', async () => {
    const profile = {
      id: 'auto_repair_us',
      category_key: 'auto repair',
      category_name: 'Auto Repair',
      version: 1,
      intelligence_focus: 'emerging',
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(profile);

    const result = await service.resolve('Auto Repair');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('auto_repair_us');
    // Should have queried without focus filter
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith({
      where: { category_key: 'auto repair', status: 'active' },
      orderBy: { version: 'desc' },
    });
    // Only one query — no focus, no fallback
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledTimes(1);
  });

  it('resolve(category, "emerging") with no profiles at all → returns null', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);

    const result = await service.resolve('Unknown Category', 'emerging');

    expect(result).toBeNull();
  });
});

describe('IntelligenceProfileService — type-scoped activation (Migration 202)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    service = IntelligenceProfileService.getInstance();
    vi.clearAllMocks();
  });

  it('activateDraft retires only the same-focus active profile', async () => {
    const competitiveDraft = {
      id: 'auto_repair_competitive',
      category_key: 'auto repair',
      category_name: 'Auto Repair',
      version: 2,
      intelligence_focus: 'competitive',
      status: 'draft',
      configuration_json: {},
    };
    const activatedRow = { ...competitiveDraft, status: 'active' };

    mockPrisma.mkt_intelligence_profiles.findUnique.mockResolvedValueOnce(competitiveDraft);
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.mkt_intelligence_profiles.update.mockResolvedValueOnce(activatedRow);

    await service.activateDraft('auto_repair_competitive', 2);

    // The retirement updateMany should filter by category_key + focus +
    // reference_city. Migration 205 adds reference_city: null to the filter
    // so a city-agnostic draft retires only city-agnostic active profiles.
    expect(mockPrisma.mkt_intelligence_profiles.updateMany).toHaveBeenCalledWith({
      where: {
        category_key: 'auto repair',
        intelligence_focus: 'competitive',
        reference_city: null,
        status: 'active',
      },
      data: { status: 'retired', updated_at: expect.any(Date) },
    });
  });
});

describe('IntelligenceProfileService — focus-stamped import (Migration 202)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    service = IntelligenceProfileService.getInstance();
    vi.clearAllMocks();
  });

  it('importAsDraft stamps the focus onto the draft', async () => {
    // No existing profile for (category, focus)
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    const createdProfile = {
      id: 'new_competitive_profile',
      category_key: 'plumbing',
      category_name: 'Plumbing',
      version: 1,
      intelligence_focus: 'competitive',
      status: 'draft',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce(createdProfile);

    const result = await service.importAsDraft({
      categoryKey: 'plumbing',
      categoryName: 'Plumbing',
      configurationJson: { specialized_sources: [] } as any,
      intelligenceFocus: 'competitive',
    });

    expect(result.intelligence_focus).toBe('competitive');
    // The create call should include intelligence_focus
    expect(mockPrisma.mkt_intelligence_profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        intelligence_focus: 'competitive',
        status: 'draft',
      }),
    });
  });

  it('importAsDraft defaults to emerging when no focus provided', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce({
      id: 'new_emerging',
      category_key: 'plumbing',
      category_name: 'Plumbing',
      version: 1,
      intelligence_focus: 'emerging',
      status: 'draft',
      configuration_json: {},
    });

    await service.importAsDraft({
      categoryKey: 'plumbing',
      categoryName: 'Plumbing',
      configurationJson: { specialized_sources: [] } as any,
    });

    expect(mockPrisma.mkt_intelligence_profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        intelligence_focus: 'emerging',
      }),
    });
  });

  it('importAsDraft finds existing profile by (category_key, focus) for version bump', async () => {
    const existingProfile = {
      id: 'plumbing_competitive',
      category_key: 'plumbing',
      version: 1,
      intelligence_focus: 'competitive',
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(existingProfile);
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce({
      id: 'plumbing_competitive',
      category_key: 'plumbing',
      category_name: 'Plumbing',
      version: 2,
      intelligence_focus: 'competitive',
      status: 'draft',
      configuration_json: {},
    });

    await service.importAsDraft({
      categoryKey: 'plumbing',
      categoryName: 'Plumbing',
      configurationJson: { specialized_sources: [] } as any,
      intelligenceFocus: 'competitive',
    });

    // Should have searched with category_key + intelligence_focus +
    // reference_city. Migration 205 adds reference_city: null so a
    // city-agnostic import finds the city-agnostic profile lineage.
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith({
      where: { category_key: 'plumbing', intelligence_focus: 'competitive', reference_city: null },
      orderBy: { version: 'desc' },
    });
  });
});

describe('IntelligenceProfileService — focus-preserving publish (Migration 202)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    service = IntelligenceProfileService.getInstance();
    vi.clearAllMocks();
  });

  it('publishVersion carries the focus from the latest version', async () => {
    const latestVersion = {
      id: 'auto_repair_emerging',
      category_key: 'auto repair',
      category_name: 'Auto Repair',
      version: 1,
      intelligence_focus: 'emerging',
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValueOnce([latestVersion]);
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce({
      ...latestVersion,
      version: 2,
      intelligence_focus: 'emerging',
    });

    await service.publishVersion('auto_repair_emerging', {
      configurationJson: { specialized_sources: [] } as any,
    });

    // The new version should carry the focus from the latest version
    expect(mockPrisma.mkt_intelligence_profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'auto_repair_emerging',
        version: 2,
        intelligence_focus: 'emerging',
        status: 'active',
      }),
    });
  });
});

describe('IntelligenceProfileService — createProfile with focus (Migration 202)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    service = IntelligenceProfileService.getInstance();
    vi.clearAllMocks();
  });

  it('createProfile stamps the focus onto the new profile', async () => {
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce({
      id: 'new_competitive',
      category_key: 'hvac',
      category_name: 'HVAC',
      version: 1,
      intelligence_focus: 'competitive',
      status: 'draft',
      configuration_json: {},
    });

    await service.createProfile({
      categoryKey: 'HVAC',
      categoryName: 'HVAC',
      configurationJson: { specialized_sources: [] } as any,
      intelligenceFocus: 'competitive',
    });

    expect(mockPrisma.mkt_intelligence_profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        intelligence_focus: 'competitive',
        version: 1,
      }),
    });
  });

  it('createProfile defaults to emerging when no focus provided', async () => {
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce({
      id: 'new_emerging',
      category_key: 'hvac',
      category_name: 'HVAC',
      version: 1,
      intelligence_focus: 'emerging',
      status: 'draft',
      configuration_json: {},
    });

    await service.createProfile({
      categoryKey: 'HVAC',
      categoryName: 'HVAC',
      configurationJson: { specialized_sources: [] } as any,
    });

    expect(mockPrisma.mkt_intelligence_profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        intelligence_focus: 'emerging',
      }),
    });
  });
});

// ─── Migration 205: City-Scoped Resolution ───────────────────────────────

describe('IntelligenceProfileService — city-scoped resolution (Migration 205)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    service = IntelligenceProfileService.getInstance();
    vi.clearAllMocks();
  });

  it('resolve(category, focus, city) with a city-specific active profile → returns it', async () => {
    const zionsvilleProfile = {
      id: 'african_grocery_zionsville',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 1,
      intelligence_focus: 'competitive',
      reference_city: 'zionsville',
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(zionsvilleProfile);

    const result = await service.resolve('African Grocery Store', 'competitive', 'Zionsville');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('african_grocery_zionsville');
    expect(result!.reference_city).toBe('zionsville');
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith({
      where: {
        category_key: 'african grocery store',
        reference_city: 'zionsville',
        intelligence_focus: 'competitive',
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });
    // Only one query — exact city match found, no fallback
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledTimes(1);
  });

  it('resolve(category, focus, city) with no city-specific profile falls back to city-agnostic', async () => {
    // First call (city-specific) returns null
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    // Second call (city-agnostic) returns a NULL-reference_city profile
    const agnosticProfile = {
      id: 'african_grocery_agnostic',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 1,
      intelligence_focus: 'competitive',
      reference_city: null,
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(agnosticProfile);

    const result = await service.resolve('African Grocery Store', 'competitive', 'Zionsville');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('african_grocery_agnostic');
    expect(result!.reference_city).toBeNull();
    // Two queries: city-specific, then city-agnostic
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledTimes(2);
  });

  it('resolve(category, focus, city) with no city-specific AND no city-agnostic falls back to category+focus', async () => {
    // city-specific → null, city-agnostic → null, category+focus → indianapolis profile
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    const indianapolisProfile = {
      id: 'african_grocery_indianapolis',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 1,
      intelligence_focus: 'competitive',
      reference_city: 'indianapolis',
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(indianapolisProfile);

    const result = await service.resolve('African Grocery Store', 'competitive', 'Zionsville');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('african_grocery_indianapolis');
    // Three queries: city-specific, city-agnostic, category+focus
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledTimes(3);
  });

  it('resolve(category, focus) with no city preserves legacy focus-only behavior', async () => {
    const profile = {
      id: 'auto_repair_emerging',
      category_key: 'auto repair',
      category_name: 'Auto Repair',
      version: 1,
      intelligence_focus: 'emerging',
      reference_city: null,
      status: 'active',
      configuration_json: {},
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(profile);

    const result = await service.resolve('Auto Repair', 'emerging');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('auto_repair_emerging');
    // Should query by category + focus only (no city filter)
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith({
      where: {
        category_key: 'auto repair',
        intelligence_focus: 'emerging',
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('IntelligenceProfileService — city-scoped activation (Migration 205)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    service = IntelligenceProfileService.getInstance();
    vi.clearAllMocks();
  });

  it('activateDraft retires only the same (category, city, focus) active profile', async () => {
    const zionsvilleDraft = {
      id: 'african_grocery_zionsville',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 2,
      intelligence_focus: 'competitive',
      reference_city: 'zionsville',
      status: 'draft',
      configuration_json: {},
    };
    const activatedRow = { ...zionsvilleDraft, status: 'active' };

    mockPrisma.mkt_intelligence_profiles.findUnique.mockResolvedValueOnce(zionsvilleDraft);
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.mkt_intelligence_profiles.update.mockResolvedValueOnce(activatedRow);

    await service.activateDraft('african_grocery_zionsville', 2);

    // The retirement updateMany should filter by category + city + focus
    expect(mockPrisma.mkt_intelligence_profiles.updateMany).toHaveBeenCalledWith({
      where: {
        category_key: 'african grocery store',
        intelligence_focus: 'competitive',
        reference_city: 'zionsville',
        status: 'active',
      },
      data: { status: 'retired', updated_at: expect.any(Date) },
    });
  });

  it('activateDraft for a city-agnostic draft retires only NULL-reference_city active profiles', async () => {
    const agnosticDraft = {
      id: 'african_grocery_agnostic',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 2,
      intelligence_focus: 'competitive',
      reference_city: null,
      status: 'draft',
      configuration_json: {},
    };

    mockPrisma.mkt_intelligence_profiles.findUnique.mockResolvedValueOnce(agnosticDraft);
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.mkt_intelligence_profiles.update.mockResolvedValueOnce({ ...agnosticDraft, status: 'active' });

    await service.activateDraft('african_grocery_agnostic', 2);

    expect(mockPrisma.mkt_intelligence_profiles.updateMany).toHaveBeenCalledWith({
      where: {
        category_key: 'african grocery store',
        intelligence_focus: 'competitive',
        reference_city: null,
        status: 'active',
      },
      data: { status: 'retired', updated_at: expect.any(Date) },
    });
  });
});

describe('IntelligenceProfileService — city-stamped import (Migration 205)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    service = IntelligenceProfileService.getInstance();
    vi.clearAllMocks();
  });

  it('importAsDraft stamps the reference_city onto the draft', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce({
      id: 'african_grocery_zionsville',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 1,
      intelligence_focus: 'competitive',
      reference_city: 'zionsville',
      status: 'draft',
      configuration_json: {},
    });

    const result = await service.importAsDraft({
      categoryKey: 'African Grocery Store',
      categoryName: 'African Grocery Store',
      configurationJson: { specialized_sources: [] } as any,
      intelligenceFocus: 'competitive',
      referenceCity: 'Zionsville',
    });

    expect(result.reference_city).toBe('zionsville');
    expect(mockPrisma.mkt_intelligence_profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reference_city: 'zionsville',
        intelligence_focus: 'competitive',
        status: 'draft',
      }),
    });
  });

  it('importAsDraft finds existing profile by (category, city, focus) for version bump', async () => {
    const existing = {
      id: 'african_grocery_zionsville',
      category_key: 'african grocery store',
      version: 1,
      intelligence_focus: 'competitive',
      reference_city: 'zionsville',
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(existing);
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce({
      id: 'african_grocery_zionsville',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 2,
      intelligence_focus: 'competitive',
      reference_city: 'zionsville',
      status: 'draft',
      configuration_json: {},
    });

    await service.importAsDraft({
      categoryKey: 'African Grocery Store',
      categoryName: 'African Grocery Store',
      configurationJson: { specialized_sources: [] } as any,
      intelligenceFocus: 'competitive',
      referenceCity: 'Zionsville',
    });

    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith({
      where: {
        category_key: 'african grocery store',
        intelligence_focus: 'competitive',
        reference_city: 'zionsville',
      },
      orderBy: { version: 'desc' },
    });
  });
});

describe('IntelligenceProfileService — renderProfileBlock city retargeting directive (Migration 205)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    service = IntelligenceProfileService.getInstance();
    vi.clearAllMocks();
  });

  it('emits a CITY RETARGETING DIRECTIVE when profile city differs from target city', () => {
    const profile = {
      id: 'african_grocery_indianapolis',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 1,
      intelligence_focus: 'competitive',
      reference_city: 'Indianapolis',
      status: 'active',
      configuration_json: {
        specialized_sources: [{ name: 'Obiji Foods', type: 'vertical_directory', capabilities: [], limitations: [] }],
      },
    } as any;

    const block = service.renderProfileBlock(profile, 'Zionsville');

    expect(block).toContain('CITY RETARGETING DIRECTIVE');
    expect(block).toContain('indianapolis');
    expect(block).toContain('zionsville');
    expect(block).toContain('Reference city (profile established for): indianapolis');
    expect(block).toContain('Target city (this discovery campaign): zionsville');
  });

  it('does NOT emit a retargeting directive when profile city matches target city', () => {
    const profile = {
      id: 'african_grocery_zionsville',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 1,
      intelligence_focus: 'competitive',
      reference_city: 'Zionsville',
      status: 'active',
      configuration_json: { specialized_sources: [] },
    } as any;

    const block = service.renderProfileBlock(profile, 'Zionsville');

    expect(block).not.toContain('CITY RETARGETING DIRECTIVE');
    expect(block).toContain('Reference city (profile established for): zionsville');
  });

  it('emits a CITY APPLICATION DIRECTIVE for a city-agnostic profile applied to a city-specific campaign', () => {
    const profile = {
      id: 'african_grocery_agnostic',
      category_key: 'african grocery store',
      category_name: 'African Grocery Store',
      version: 1,
      intelligence_focus: 'competitive',
      reference_city: null,
      status: 'active',
      configuration_json: { specialized_sources: [] },
    } as any;

    const block = service.renderProfileBlock(profile, 'Zionsville');

    expect(block).toContain('CITY APPLICATION DIRECTIVE');
    expect(block).toContain('city-agnostic');
    expect(block).toContain('zionsville');
  });
});

// Re-export for convenience
export { normalizeCategoryKey };
