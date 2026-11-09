/**
 * getStoresByCategory — directory category shelf pagination.
 *
 * Regression guard. The /directory/categories/[slug] grid links to ?page=N,
 * but this method used to take only the slug — every request fetched page 1,
 * so the listing never flipped pages. The request URL must carry page/limit
 * and the cache key must vary by page, or page 2 would be served page 1's
 * cached payload.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { recommendationsService } from './RecommendationsSingletonService';

const service = recommendationsService as unknown as { makeDefaultRequest: unknown };
const original = service.makeDefaultRequest;

const stubTransport = () => {
  const spy = vi.fn().mockResolvedValue({ success: true, data: { stores: [], pagination: {} } });
  service.makeDefaultRequest = spy;
  return spy;
};

afterEach(() => {
  service.makeDefaultRequest = original;
  vi.restoreAllMocks();
});

describe('getStoresByCategory', () => {
  it('sends the requested page and limit to the MV categories endpoint', async () => {
    const spy = stubTransport();

    await recommendationsService.getStoresByCategory('asian-grocery-store', 2);

    const [url] = spy.mock.calls[0];
    expect(url).toBe('/api/directory/mv/categories/asian-grocery-store?page=2&limit=12');
  });

  it('defaults to page=1&limit=12', async () => {
    const spy = stubTransport();

    await recommendationsService.getStoresByCategory('asian-grocery-store');

    const [url] = spy.mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).toContain('limit=12');
  });

  it('keys the cache by page so page 2 is not served page 1 results', async () => {
    const spy = stubTransport();

    await recommendationsService.getStoresByCategory('asian-grocery-store', 1);
    await recommendationsService.getStoresByCategory('asian-grocery-store', 2);

    const [, , cacheKeyP1] = spy.mock.calls[0];
    const [, , cacheKeyP2] = spy.mock.calls[1];
    expect(cacheKeyP1).not.toBe(cacheKeyP2);
    expect(cacheKeyP2).toContain('p2');
  });

  it('clamps a zero/negative page to 1', async () => {
    const spy = stubTransport();

    await recommendationsService.getStoresByCategory('asian-grocery-store', 0);

    const [url] = spy.mock.calls[0];
    expect(url).toContain('page=1');
  });
});
