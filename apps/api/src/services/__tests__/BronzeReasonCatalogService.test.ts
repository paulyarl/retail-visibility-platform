/**
 * BronzeReasonCatalogService tests (Bronze Standard System — spec §3.5)
 *
 * Covers:
 *   - createReason: revision bump in-transaction, introduced_in_revision stamp,
 *     scope normalization (category underscores, city title-case, state names),
 *     key validation, duplicate rejection, city-without-state rejection
 *   - updateReason: immutable reason_key, revised_in_revision stamp
 *   - deprecateReason: deprecated_in_revision stamp, superseded_by validation,
 *     double-deprecate rejection
 *   - uncoveredReasons: staleness predicate issues the raw query
 *   - serializeCatalogBlock: emits revision + rows + each reason's scope
 *   - buildBronzeCatalogSnapshot / formatBronzeReasonScope: the §4 DB-truth
 *     snapshot + §3.6.3 scope_mix (regression: category-scoped reasons must
 *     not read as universal)
 *   - audit() called with actorType 'user'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  mkt_bronze_reason_catalog: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mkt_bronze_catalog_meta: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
  $queryRawUnsafe: vi.fn(),
};

const mockAudit = vi.fn(async () => undefined);

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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: (...args: any[]) => mockAudit(...args),
}));

import {
  BronzeReasonCatalogService,
  buildBronzeCatalogSnapshot,
  formatBronzeReasonScope,
} from '../intelligence/BronzeReasonCatalogService';
import { ConflictError, NotFoundError, ValidationError } from '../../middleware/errorHandler';

const CTX = { userId: 'op-test', tenantId: 'platform' } as any;

describe('BronzeReasonCatalogService', () => {
  let service: BronzeReasonCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.mkt_bronze_catalog_meta.update.mockResolvedValue({ catalog_revision: 5 });
    service = BronzeReasonCatalogService.getInstance();
  });

  describe('createReason', () => {
    it('creates a reason and bumps catalog_revision in the same transaction', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue(null);
      mockPrisma.mkt_bronze_reason_catalog.create.mockResolvedValue({ reason_key: 'community_only_presence' });

      const row = await service.createReason('community_only_presence', {
        label: 'Community-only presence',
        definition: 'Visible only inside community channels.',
        signals: ['no mainstream listings'],
        expected_vectors: ['church bulletins'],
        priority: 2,
      }, CTX);

      expect(mockPrisma.mkt_bronze_catalog_meta.update).toHaveBeenCalledWith({
        where: { id: 'catalog' },
        data: { catalog_revision: { increment: 1 }, updated_at: expect.any(Date) },
        select: { catalog_revision: true },
      });
      expect(mockPrisma.mkt_bronze_reason_catalog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reason_key: 'community_only_presence',
          provenance: 'operator_authored',
          introduced_in_revision: 5,
          created_by: 'op-test',
        }),
      });
      expect(row.reason_key).toBe('community_only_presence');
    });

    it('normalizes scope values on write (§3.5.1)', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue(null);
      mockPrisma.mkt_bronze_reason_catalog.create.mockResolvedValue({ reason_key: 'test_reason' });

      await service.createReason('test_reason', {
        label: 'L',
        definition: 'D',
        scope_category_key: 'African_Grocery_Store',
        scope_city: 'kansas city',
        scope_state: 'Missouri',
        scope_platform: 'GOOGLE',
      }, CTX);

      expect(mockPrisma.mkt_bronze_reason_catalog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scope_category_key: 'african grocery store',
          scope_city: 'Kansas City',
          scope_state: 'MO',
          scope_platform: 'google',
        }),
      });
    });

    it('rejects an invalid reason_key format', async () => {
      await expect(
        service.createReason('Bad Key!', { label: 'L', definition: 'D' }, CTX),
      ).rejects.toThrow(ValidationError);
      expect(mockPrisma.mkt_bronze_catalog_meta.update).not.toHaveBeenCalled();
    });

    it('rejects a duplicate reason_key with ConflictError', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue({ reason_key: 'absent_from_platform' });
      await expect(
        service.createReason('absent_from_platform', { label: 'L', definition: 'D' }, CTX),
      ).rejects.toThrow(ConflictError);
    });

    it('rejects scope_city without scope_state (location scope is city + state)', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue(null);
      await expect(
        service.createReason('test_reason', { label: 'L', definition: 'D', scope_city: 'Kansas City' }, CTX),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects a scope_platform outside the gold vocabulary', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue(null);
      await expect(
        service.createReason('test_reason', { label: 'L', definition: 'D', scope_platform: 'tiktok' as any }, CTX),
      ).rejects.toThrow(ValidationError);
    });

    it('audits the write with actorType user', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue(null);
      mockPrisma.mkt_bronze_reason_catalog.create.mockResolvedValue({ reason_key: 'r' });
      await service.createReason('test_reason', { label: 'L', definition: 'D' }, CTX);
      expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
        actorType: 'user',
        action: 'create',
      }));
    });
  });

  describe('updateReason', () => {
    it('rejects a reason_key change (keys are immutable)', async () => {
      await expect(
        service.updateReason('r', { reason_key: 'other' } as any, CTX),
      ).rejects.toThrow(ValidationError);
    });

    it('stamps revised_in_revision on every write', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue({
        reason_key: 'r',
        scope_category_key: null, scope_city: null, scope_state: null, scope_platform: null,
      });
      mockPrisma.mkt_bronze_reason_catalog.update.mockResolvedValue({ reason_key: 'r' });

      await service.updateReason('r', { label: 'New label' }, CTX);

      expect(mockPrisma.mkt_bronze_reason_catalog.update).toHaveBeenCalledWith({
        where: { reason_key: 'r' },
        data: expect.objectContaining({
          label: 'New label',
          revised_in_revision: 5,
        }),
      });
    });

    it('throws NotFoundError for an unknown key', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue(null);
      await expect(service.updateReason('ghost', { label: 'L' }, CTX)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deprecateReason', () => {
    it('stamps deprecated_in_revision', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue({
        reason_key: 'r',
        deprecated_in_revision: null,
      });
      mockPrisma.mkt_bronze_reason_catalog.update.mockResolvedValue({ reason_key: 'r', superseded_by: null });

      await service.deprecateReason('r', { deprecatedReason: 'folded into another reason' }, CTX);

      expect(mockPrisma.mkt_bronze_reason_catalog.update).toHaveBeenCalledWith({
        where: { reason_key: 'r' },
        data: expect.objectContaining({
          deprecated_in_revision: 5,
          deprecated_reason: 'folded into another reason',
        }),
      });
    });

    it('rejects double deprecation', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue({
        reason_key: 'r',
        deprecated_in_revision: 3,
      });
      await expect(service.deprecateReason('r', {}, CTX)).rejects.toThrow(ConflictError);
    });

    it('rejects superseded_by pointing at itself', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique.mockResolvedValue({
        reason_key: 'r',
        deprecated_in_revision: null,
      });
      await expect(
        service.deprecateReason('r', { supersededBy: 'r' }, CTX),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects superseded_by pointing at a deprecated reason', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique
        .mockResolvedValueOnce({ reason_key: 'r', deprecated_in_revision: null })
        .mockResolvedValueOnce({ deprecated_in_revision: 2 });
      await expect(
        service.deprecateReason('r', { supersededBy: 'dead_reason' }, CTX),
      ).rejects.toThrow(ValidationError);
    });

    it('accepts a valid superseded_by target', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findUnique
        .mockResolvedValueOnce({ reason_key: 'r', deprecated_in_revision: null })
        .mockResolvedValueOnce({ deprecated_in_revision: null });
      mockPrisma.mkt_bronze_reason_catalog.update.mockResolvedValue({ reason_key: 'r', superseded_by: 'canonical_reason' });

      await service.deprecateReason('r', { supersededBy: 'canonical_reason' }, CTX);
      expect(mockPrisma.mkt_bronze_reason_catalog.update).toHaveBeenCalledWith({
        where: { reason_key: 'r' },
        data: expect.objectContaining({ superseded_by: 'canonical_reason' }),
      });
    });
  });

  describe('uncoveredReasons', () => {
    it('issues the staleness query scoped to the profile revision', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { reason_key: 'new_reason', label: 'New', gap_kind: 'never_covered' },
      ]);
      const rows = await service.uncoveredReasons({
        categoryKey: 'African Grocery Store',
        city: 'Kansas City',
        state: 'Missouri',
        profileCatalogRevision: 3,
      }, CTX);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST(introduced_in_revision'),
        3,
        'african grocery store',
        'Kansas City',
        'MO',
        null,
      );
      expect(rows[0].gap_kind).toBe('never_covered');
    });

    it('passes NULL platform so a cross-platform profile flags platform-bound reasons too (§3.6.1)', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await service.uncoveredReasons({
        categoryKey: 'african grocery store',
        profileCatalogRevision: 3,
      }, CTX);
      const [sql, ...params] = mockPrisma.$queryRawUnsafe.mock.calls.at(-1) as any[];
      expect(sql).toContain('$5::text IS NULL');
      expect(params.at(-1)).toBeNull();
    });
  });

  describe('applicableReasons', () => {
    it('excludes deprecated rows and applies the scope predicate', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findMany.mockResolvedValue([]);
      await service.applicableReasons({ categoryKey: 'african grocery store', platform: 'google' }, CTX);
      expect(mockPrisma.mkt_bronze_reason_catalog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          deprecated_in_revision: null,
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [{ scope_platform: null }, { scope_platform: 'google' }],
            }),
          ]),
        }),
        orderBy: [{ priority: 'asc' }, { reason_key: 'asc' }],
      });
    });

    it('omits the platform clause for a cross-platform scan so platform-bound reasons apply (§3.6.1)', async () => {
      mockPrisma.mkt_bronze_reason_catalog.findMany.mockResolvedValue([]);
      await service.applicableReasons({ categoryKey: 'african grocery store' }, CTX);
      const call = mockPrisma.mkt_bronze_reason_catalog.findMany.mock.calls.at(-1)?.[0] as any;
      const platformClause = call.where.AND.find((c: any) =>
        (c?.OR ?? []).some((o: any) => 'scope_platform' in o),
      );
      expect(platformClause).toBeUndefined();
    });
  });

  describe('serializeCatalogBlock', () => {
    it('emits the revision and each reason with signals + vectors', () => {
      const block = service.serializeCatalogBlock([
        {
          reason_key: 'absent_from_platform',
          label: 'Absent from a major platform',
          definition: 'No verifiable listing on a major platform.',
          signals: ['no GBP listing'],
          expected_vectors: ['community directories'],
          priority: 1,
        } as any,
      ], 7);
      expect(block).toContain('Catalog revision: 7');
      expect(block).toContain('[absent_from_platform]');
      expect(block).toContain('no GBP listing');
      expect(block).toContain('community directories');
    });

    it('returns empty string for an empty catalog', () => {
      expect(service.serializeCatalogBlock([], 1)).toBe('');
    });

    it('emits each reason\'s scope so the model can echo it into the snapshot (§3.6.1)', () => {
      const row = (overrides: Record<string, any>) => ({
        reason_key: 'r', label: 'R', definition: 'd',
        signals: [], expected_vectors: [], priority: 1, ...overrides,
      });
      const block = service.serializeCatalogBlock([
        row({ reason_key: 'universal_reason' }),
        row({ reason_key: 'category_reason', scope_category_key: 'african grocery store' }),
        row({ reason_key: 'location_reason', scope_city: 'Indianapolis', scope_state: 'IN' }),
        row({ reason_key: 'platform_reason', scope_category_key: 'african grocery store', scope_platform: 'yelp' }),
      ] as any, 3);

      expect(block).toContain('Scope: universal');
      expect(block).toContain('Scope: category=african grocery store');
      expect(block).toContain('Scope: location=Indianapolis, IN');
      expect(block).toContain('Scope: category=african grocery store; platform=yelp');
    });

    it('defines what scope means for the analyst — not just the variable', () => {
      const block = service.serializeCatalogBlock([
        { reason_key: 'r', label: 'R', definition: 'd', signals: [], expected_vectors: [], priority: 1 } as any,
      ], 1);

      // The definition the analyst needs to use scope wisely — the selection
      // filter first (why this reason is in the block at all), then what it
      // governs.
      expect(block).toContain('REASON SCOPE');
      expect(block).toContain('Scope is the filter that selected this block');
      expect(block).toContain('would not appear in another category\'s block');
      expect(block).toContain('scope is never a reason to skip one');
      expect(block).toContain('category=<key>');
      expect(block).toContain('location=<city, ST>');
      expect(block).toContain('a platform-bound one is a per-platform finding');
      expect(block).toContain('whole-business visibility verdict');
      // The scope-relative proof rule (§6.2.1) — the judgement scope changes.
      expect(block).toContain('proof is scope-relative');
      expect(block).toContain('empty_proven_elsewhere');
      expect(block).toContain('empty_unproven');
      // …and what to record.
      expect(block).toContain('scope_mix');
      expect(block).toContain('platform_bound');
    });
  });

  describe('formatBronzeReasonScope', () => {
    it('labels a wildcard row universal and joins the set scope parts', () => {
      expect(formatBronzeReasonScope({
        scope_category_key: null, scope_city: null, scope_state: null, scope_platform: null,
      })).toBe('universal');
      expect(formatBronzeReasonScope({
        scope_category_key: 'african grocery store', scope_city: 'Indianapolis', scope_state: 'IN', scope_platform: 'yelp',
      })).toBe('category=african grocery store; location=Indianapolis, IN; platform=yelp');
    });

    it('renders a city without a state without a dangling separator', () => {
      expect(formatBronzeReasonScope({
        scope_category_key: null, scope_city: 'Indianapolis', scope_state: null, scope_platform: null,
      })).toBe('location=Indianapolis');
    });
  });

  describe('buildBronzeCatalogSnapshot (§4 — DB-truth snapshot)', () => {
    const row = (overrides: Record<string, any>) => ({
      reason_key: 'r', label: 'L', definition: 'D', signals: ['s'], expected_vectors: ['v'],
      priority: 1, provenance: 'derived',
      scope_category_key: null, scope_city: null, scope_state: null, scope_platform: null,
      ...overrides,
    });

    it('embeds every scope column and derives scope_mix by level + the platform axis', () => {
      const { catalog_snapshot, scope_mix } = buildBronzeCatalogSnapshot([
        row({ reason_key: 'u' }),
        row({ reason_key: 'c', scope_category_key: 'african grocery store' }),
        row({ reason_key: 'l', scope_city: 'Indianapolis', scope_state: 'IN' }),
        row({ reason_key: 'cl', scope_category_key: 'african grocery store', scope_city: 'Indianapolis', scope_state: 'IN' }),
        row({ reason_key: 'p', scope_platform: 'yelp' }),
      ] as any);

      // Platform is the independent axis (§3.6.5): a platform-only reason is
      // geographically universal AND counted in platform_bound.
      expect(scope_mix).toEqual({
        universal: 2, category: 1, location: 1, category_location: 1, platform_bound: 1,
      });
      expect(catalog_snapshot).toHaveLength(5);
      expect(catalog_snapshot[1]).toMatchObject({
        reason_key: 'c',
        scope_category_key: 'african grocery store',
        scope_city: null,
        scope_state: null,
        scope_platform: null,
        provenance: 'derived',
      });
      expect(catalog_snapshot[0]).toMatchObject({ signals: ['s'], expected_vectors: ['v'] });
    });

    it('regression — a category-scoped reason never reads as universal', () => {
      // The live defect: migration 291 seeds trade_manifest_only +
      // wholesale_or_hybrid_role as category-scoped, but the persisted
      // snapshot came back with every scope column null and scope_mix
      // { universal: 17, category: 0 }.
      const { catalog_snapshot, scope_mix } = buildBronzeCatalogSnapshot([
        row({ reason_key: 'trade_manifest_only', scope_category_key: 'african grocery store' }),
        row({ reason_key: 'wholesale_or_hybrid_role', scope_category_key: 'african grocery store', priority: 3 }),
      ] as any);

      expect(scope_mix).toMatchObject({ universal: 0, category: 2 });
      expect(catalog_snapshot.map((r) => r.scope_category_key)).toEqual([
        'african grocery store', 'african grocery store',
      ]);
    });

    it('treats a city without a state as universal scope (location is city + state, §3.6.1)', () => {
      const { scope_mix } = buildBronzeCatalogSnapshot([
        row({ reason_key: 'orphan_city', scope_city: 'Indianapolis', scope_state: null }),
      ] as any);
      expect(scope_mix).toMatchObject({ universal: 1, location: 0 });
    });
  });
});
