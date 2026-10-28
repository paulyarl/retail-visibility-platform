/**
 * /place/{slug} metadata — §4.8 indexation gate.
 *
 * Thin/template seed pages stay live for the claim funnel, but they must not
 * be indexed. The API owns the predicate (`seedPublishable`); the page only
 * translates it into a robots directive. Suppressed seeds must also be
 * noindexed even if a stale cache still serves the listing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDirectoryConsolidated } = vi.hoisted(() => ({
  mockGetDirectoryConsolidated: vi.fn(),
}));

vi.mock('@/services/DirectorySingletonService', () => ({
  directoryService: { getDirectoryConsolidated: mockGetDirectoryConsolidated },
}));

import { generateMetadata } from './layout';

const params = Promise.resolve({ slug: 'royal-african-market-llc' });

const listing = {
  slug: 'royal-african-market-llc',
  businessName: 'Royal African Market LLC',
  description: 'Royal African Market LLC is a African Grocery Store. Listed on VisibleShelf from public information (address, phone).',
  address: '3071 N High School Rd',
  city: 'Indianapolis',
  state: 'IN',
  listingOrigin: 'directory_seed',
  seedStatus: 'published',
  seedPublishable: false,
};

describe('place metadata publish gate', () => {
  beforeEach(() => {
    mockGetDirectoryConsolidated.mockReset();
  });

  it('noindexes a thin seed page', async () => {
    mockGetDirectoryConsolidated.mockResolvedValue({ listing });

    const metadata = await generateMetadata({ params });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('lets an enriched seed page index', async () => {
    mockGetDirectoryConsolidated.mockResolvedValue({
      listing: { ...listing, seedPublishable: true },
    });

    const metadata = await generateMetadata({ params });

    expect(metadata.robots).toBeUndefined();
  });

  it('noindexes a suppressed seed even from a stale cache', async () => {
    mockGetDirectoryConsolidated.mockResolvedValue({
      listing: { ...listing, seedStatus: 'suppressed' },
    });

    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe('Place Not Found');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
