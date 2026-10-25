/**
 * /api/directory/mv/search — open-now contract.
 *
 * The hero "open now" chip reads `openNowCount`, and `?openNow=true` must
 * filter + paginate consistently. Both derive from each listing's own
 * business_hours, evaluated in JS (see directory-mv.hours.test.ts for the
 * day-key normalization itself).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));

vi.mock('../utils/db-pool', () => ({
  getDirectPool: () => ({ query: poolQuery }),
}));
vi.mock('../services/TenantSingletonService', () => ({
  default: { getTenantSlug: vi.fn(async () => 'store-slug') },
}));
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import directoryMvRoutes from './directory-mv';

const MONDAY_HOURS = {
  monday: { open: '08:00', close: '20:00', closed: false },
  timezone: 'America/New_York',
};
const SUNDAY_ONLY_HOURS = {
  sunday: { open: '09:00', close: '12:00', closed: false },
  timezone: 'America/New_York',
};

const LISTINGS = [
  {
    tenant_id: 't-open',
    id: 't-open',
    business_name: 'Open Market',
    slug: 'open-market',
    business_hours: MONDAY_HOURS,
    rating_avg: 4,
    rating_count: 2,
    product_count: 1,
  },
  {
    tenant_id: 't-closed',
    id: 't-closed',
    business_name: 'Closed Market',
    slug: 'closed-market',
    business_hours: SUNDAY_ONLY_HOURS,
    rating_avg: 3,
    rating_count: 1,
    product_count: 1,
  },
];

const isListingsQuery = (sql: string) => sql.includes('business_name');
const isCountQuery = (sql: string) => sql.includes('COUNT(DISTINCT');
const isOpenNowQuery = (sql: string) =>
  sql.includes('dll.business_hours') && !isListingsQuery(sql);

function buildApp() {
  const app = express();
  app.use('/api/directory/mv', directoryMvRoutes);
  return app;
}

describe('GET /api/directory/mv/search open-now', () => {
  beforeEach(() => {
    // Monday 2026-10-26 12:00 UTC = 08:00 EDT — LISTINGS[0] is open.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));

    poolQuery.mockImplementation(async (sql: string) => {
      if (isCountQuery(sql)) return { rows: [{ count: '2' }] };
      if (isOpenNowQuery(sql)) {
        return {
          rows: LISTINGS.map((l) => ({
            tenant_id: l.tenant_id,
            business_hours: l.business_hours,
          })),
        };
      }
      return { rows: LISTINGS };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('reports the full-set total and open-now count for the hero chips', async () => {
    const res = await request(buildApp()).get(
      '/api/directory/mv/search?sort=distance&lat=40&lng=-75',
    );

    expect(res.status).toBe(200);
    expect(res.body.pagination.totalItems).toBe(2);
    expect(res.body.openNowCount).toBe(1);
    expect(res.body.listings).toHaveLength(2);
  });

  it('filters and paginates in memory so ?openNow=true is consistent', async () => {
    const res = await request(buildApp()).get(
      '/api/directory/mv/search?openNow=true&sort=distance&lat=40&lng=-75',
    );

    expect(res.status).toBe(200);
    expect(res.body.listings.map((l: any) => l.businessName)).toEqual([
      'Open Market',
    ]);
    expect(res.body.pagination.totalItems).toBe(1);
    expect(res.body.openNowCount).toBe(1);

    const [listingsSql, listingsParams] = poolQuery.mock.calls.find(
      ([sql]) => isListingsQuery(sql),
    )!;
    expect(listingsSql).not.toContain('LIMIT');
    expect(listingsParams).toHaveLength(0);
  });

  it('binds every SQL parameter when category + openNow + distance combine', async () => {
    const res = await request(buildApp()).get(
      '/api/directory/mv/search?openNow=true&category=indian-grocery-store&sort=distance&lat=40&lng=-75',
    );

    expect(res.status).toBe(200);

    const [listingsSql, listingsParams] = poolQuery.mock.calls.find(
      ([sql]) => isListingsQuery(sql),
    )!;
    const placeholders = [...listingsSql.matchAll(/\$(\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...placeholders)).toBeLessThanOrEqual(listingsParams.length);
  });
});
