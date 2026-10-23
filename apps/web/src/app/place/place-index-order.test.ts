/**
 * /place home composition — band order is the contract. Regression: the
 * national coverage band rendered above the header, so the page read as copy
 * first and the "Places Directory" title second. The header must lead, the
 * national narrative must follow as page copy, and the counts the header
 * carries come from the server-side category read.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Children, Suspense, type ReactElement, type ReactNode } from 'react';

vi.mock('@/services/PlacesBrowsePublicService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    default: {
      getLocationEnrichment: vi.fn(),
      getNationalCategoryRoster: vi.fn(),
      getCategories: vi.fn(),
      getAllPlaces: vi.fn(),
    },
  };
});

import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';
import PlacesIndexPage from './page';
import PlacesIndexHero from './PlacesIndexHero';
import PlaceNationalPanel from './PlaceNationalPanel';
import PlacesIndexDirectory from './PlacesIndexDirectory';

const nationalPacket = {
  market: { city: '__all__', state: '__all__', locationName: 'United States' },
  effective: { description: 'National coverage copy.' },
  bodyCopy: 'VisibleShelf tracks local businesses across the country.',
  topCategories: [],
  context: null,
} as any;

const shelf = {
  categories: [
    {
      category: 'Grocery Store',
      slug: 'grocery-store',
      placeCount: 2,
      cities: [{ city: 'Indianapolis', state: 'IN', placeCount: 2 }],
    },
  ],
  totalPlaces: 10,
} as any;

async function pageChildren() {
  const page = (await PlacesIndexPage()) as ReactElement<{ children: ReactNode }>;
  return Children.toArray(page.props.children) as ReactElement<any>[];
}

beforeEach(() => {
  vi.mocked(placesBrowsePublicService.getLocationEnrichment).mockResolvedValue(nationalPacket);
  vi.mocked(placesBrowsePublicService.getNationalCategoryRoster).mockResolvedValue([]);
  vi.mocked(placesBrowsePublicService.getCategories).mockResolvedValue(shelf);
  vi.mocked(placesBrowsePublicService.getAllPlaces).mockResolvedValue([
    { id: 'place-1', businessName: 'Baraka', slug: 'baraka' },
  ] as any);
});

describe('/place home band order', () => {
  it('leads with the header, then the national coverage band', async () => {
    const children = await pageChildren();
    const types = children.map((child) => child.type);

    expect(types[0]).toBe(PlacesIndexHero);
    expect(types.indexOf(PlaceNationalPanel)).toBeGreaterThan(types.indexOf(PlacesIndexHero));
  });

  it('feeds the server-read shelf counts into the header', async () => {
    const children = await pageChildren();
    const hero = children.find((child) => child.type === PlacesIndexHero);

    expect(hero?.props.totalPlaces).toBe(10);
    expect(hero?.props.categoryCount).toBe(1);
  });

  it('passes the shelf to the grid so it renders without a client fetch', async () => {
    const children = await pageChildren();
    const boundary = children.find((child) => child.type === Suspense);

    expect(boundary?.props.children.props.initialCategories).toEqual(shelf.categories);
  });

  it('omits the national band when no national packet exists', async () => {
    vi.mocked(placesBrowsePublicService.getLocationEnrichment).mockResolvedValue(null);
    const children = await pageChildren();

    expect(children.map((child) => child.type)).not.toContain(PlaceNationalPanel);
    expect(children[0].type).toBe(PlacesIndexHero);
  });

  it('renders the server crawl index after the client grid (spec §4.4.2)', async () => {
    const children = await pageChildren();
    const types = children.map((child) => child.type);
    const index = children.find((child) => child.type === PlacesIndexDirectory);

    expect(types.indexOf(PlacesIndexDirectory)).toBeGreaterThan(types.indexOf(Suspense));
    expect(index?.props.places).toHaveLength(1);
    expect(index?.props.cities).toEqual([
      { label: 'Indianapolis, IN', href: '/place/city/indianapolis-in' },
    ]);
  });
});
