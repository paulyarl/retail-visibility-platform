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
 *   - serializeCatalogBlock: emits revision + rows
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

import { BronzeReasonCatalogService } from '../intelligence/BronzeReasonCatalogService';
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
  });
});
