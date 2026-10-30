/**
 * GBP batch materialization tests (Sprint D6, spec §6.2).
 *
 * Pins the four fan-out rules:
 *   - managed_by='self' locations are never batch targets
 *   - delegated_surfaces.posts === false → skip
 *   - dedupe: same summary within 7d → skip
 *   - min-interval: a scheduled post within 24h → shift +24h
 *   - stagger: sequential minute offsets spread the fan-out
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockLocationsFindMany,
  mockPostsFindFirst,
  mockPostsCreate,
  mockBatchesCreate,
  mockEmitGbpActivity,
} = vi.hoisted(() => ({
  mockLocationsFindMany: vi.fn(),
  mockPostsFindFirst: vi.fn(),
  mockPostsCreate: vi.fn(),
  mockBatchesCreate: vi.fn(),
  mockEmitGbpActivity: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    gbp_locations_list: { findMany: mockLocationsFindMany },
    gbp_posts: { findFirst: mockPostsFindFirst, create: mockPostsCreate },
    gbp_post_batches: { create: mockBatchesCreate },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/google/gbp-activity', () => ({
  emitGbpActivity: mockEmitGbpActivity,
}));

vi.mock('../lib/id-generator', () => ({
  generateQuickStart: (p: string) => `${p}_test_${Math.random().toString(36).slice(2, 8)}`,
}));

const { previewBatch, createAndMaterializeBatch } = await import('../services/GbpBatchService');

const TEMPLATE = { summary: 'Grand reopening sale — 20% off!' };
const BASE = new Date('2026-11-01T12:00:00Z');

const managedLoc = (id: string, tenantId = 't1', surfaces: any = { posts: true }) => ({
  id,
  tenant_id: tenantId,
  managed_by: 'platform',
  delegated_surfaces: surfaces,
});

describe('GbpBatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostsFindFirst.mockResolvedValue(null); // no dedupe hit / no nearby schedule
    mockPostsCreate.mockResolvedValue({});
    mockBatchesCreate.mockResolvedValue({});
    mockEmitGbpActivity.mockResolvedValue(undefined);
  });

  it('skips locations that are not platform-managed', async () => {
    mockLocationsFindMany.mockResolvedValue([{ ...managedLoc('loc1'), managed_by: 'self' }]);
    const plans = await previewBatch({ type: 'all_managed' }, TEMPLATE, BASE);
    expect(plans[0].decision.outcome).toBe('skipped_not_managed');
  });

  it('skips locations where delegated_surfaces.posts is off', async () => {
    mockLocationsFindMany.mockResolvedValue([managedLoc('loc1', 't1', { posts: false })]);
    const plans = await previewBatch({ type: 'all_managed' }, TEMPLATE, BASE);
    expect(plans[0].decision.outcome).toBe('skipped_not_delegated');
  });

  it('skips on dedupe — same summary posted within the window', async () => {
    mockLocationsFindMany.mockResolvedValue([managedLoc('loc1')]);
    mockPostsFindFirst.mockResolvedValue({ id: 'existing-post' });
    const plans = await previewBatch({ type: 'all_managed' }, TEMPLATE, BASE);
    expect(plans[0].decision.outcome).toBe('skipped_dedupe');
  });

  it('shifts +24h when a scheduled post sits inside the min-interval', async () => {
    mockLocationsFindMany.mockResolvedValue([managedLoc('loc1')]);
    // first findFirst (dedupe) → null; second (interval) → nearby scheduled post
    mockPostsFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ scheduled_for: new Date('2026-11-01T20:00:00Z') });
    const plans = await previewBatch({ type: 'all_managed' }, TEMPLATE, BASE);
    expect(plans[0].decision.outcome).toBe('created');
    expect((plans[0].decision as any).scheduledFor.toISOString()).toBe('2026-11-02T20:00:00.000Z');
  });

  it('staggers created rows by index minutes', async () => {
    mockLocationsFindMany.mockResolvedValue([managedLoc('loc1'), managedLoc('loc2', 't2'), managedLoc('loc3', 't3')]);
    const plans = await previewBatch({ type: 'all_managed' }, TEMPLATE, BASE);
    const times = plans.map((p) => (p.decision as any).scheduledFor.toISOString());
    expect(times).toEqual([
      '2026-11-01T12:00:00.000Z',
      '2026-11-01T12:01:00.000Z',
      '2026-11-01T12:02:00.000Z',
    ]);
  });

  it('explicit audience resolves only the given ids', async () => {
    mockLocationsFindMany.mockResolvedValue([managedLoc('loc9', 't9')]);
    const plans = await previewBatch({ type: 'explicit', gbpLocationIds: ['loc9', 'loc-missing'] }, TEMPLATE, BASE);
    expect(mockLocationsFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['loc9', 'loc-missing'] } },
      select: expect.any(Object),
    });
    expect(plans).toHaveLength(1);
  });

  it('materializes created rows with batch_id + created_by=admin and marks the batch', async () => {
    mockLocationsFindMany.mockResolvedValue([managedLoc('loc1')]);
    const { decisions } = await createAndMaterializeBatch(
      { type: 'all_managed' },
      TEMPLATE,
      BASE,
      'user_ops'
    );
    expect(decisions[0].outcome).toBe('created');
    expect(mockPostsCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 't1',
        location_id: 'loc1',
        status: 'SCHEDULED',
        created_by: 'admin',
        summary: TEMPLATE.summary,
      }),
    });
    expect(mockPostsCreate.mock.calls[0][0].data.batch_id).toBeTruthy();
    expect(mockBatchesCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'materialized', actor_user_id: 'user_ops' }),
    });
    // Merchant-visible feed entry per created tenant
    expect(mockEmitGbpActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'post_scheduled', actor: 'admin', tenantId: 't1' })
    );
  });
});
