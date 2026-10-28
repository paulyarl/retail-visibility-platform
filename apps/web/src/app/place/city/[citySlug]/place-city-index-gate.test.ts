/**
 * /place/city/{city}-{state} metadata — thin-market index gate.
 *
 * Huntertown (one suppressed seed) and the other 1–2 listing markets were
 * being crawled as thin city shelves. They stay live for shoppers, but only
 * markets with at least three listings are indexable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCityShelfSummary } = vi.hoisted(() => ({
  mockGetCityShelfSummary: vi.fn(),
}));

vi.mock('@/services/PlacesBrowsePublicService', () => ({
  default: { getCityShelfSummary: mockGetCityShelfSummary },
}));

import { generateMetadata } from './page';

const params = Promise.resolve({ citySlug: 'huntertown-in' });

const summary = {
  city: 'Huntertown',
  state: 'IN',
  total: 1,
  enrichment: null,
  canonicalSlug: 'huntertown-in',
};

describe('city metadata index gate', () => {
  beforeEach(() => {
    mockGetCityShelfSummary.mockReset();
  });

  it('noindexes a one-listing market', async () => {
    mockGetCityShelfSummary.mockResolvedValue(summary);

    const metadata = await generateMetadata({ params });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('lets a filled-out market index', async () => {
    mockGetCityShelfSummary.mockResolvedValue({ ...summary, total: 72 });

    const metadata = await generateMetadata({ params });

    expect(metadata.robots).toBeUndefined();
  });
});
