import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock('../../prisma', () => ({
  prisma: {
    inventory_imports: { findFirst, create: vi.fn() },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getLastImport } from '../InventoryImportService';

describe('InventoryImportService — import watermark (spec §4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the latest inventory_imports row to the freshness payload', async () => {
    const at = new Date('2026-11-01T12:00:00Z');
    findFirst.mockResolvedValue({
      created_at: at,
      created_count: 12,
      updated_count: 3,
      unchanged_count: 40,
    });

    const result = await getLastImport('t1');

    expect(result).toEqual({ at, created: 12, updated: 3, unchanged: 40 });
    expect(findFirst).toHaveBeenCalledWith({
      where: { tenant_id: 't1' },
      orderBy: { created_at: 'desc' },
      select: { created_at: true, created_count: true, updated_count: true, unchanged_count: true },
    });
  });

  it('returns null when the tenant has never imported', async () => {
    findFirst.mockResolvedValue(null);
    expect(await getLastImport('t2')).toBeNull();
  });
});
