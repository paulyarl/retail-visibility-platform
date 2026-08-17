'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

interface PlaceResult {
  id: string;
  businessName: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  snapEbtReported: boolean;
  category: string;
  categorySlug: string;
  iconEmoji: string | null;
  logoUrl: string | null;
  description: string | null;
}

interface SearchResponse {
  places: PlaceResult[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

class PlacesSearchService extends PublicApiSingleton {
  private static instance: PlacesSearchService;
  private constructor() { super('places-search', { ttl: 0 }); }
  static getInstance() {
    if (!PlacesSearchService.instance) PlacesSearchService.instance = new PlacesSearchService();
    return PlacesSearchService.instance;
  }

  async search(params: { q?: string; category?: string; city?: string; snapEbt?: boolean; sort?: string; page?: number }): Promise<SearchResponse | null> {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.category) qs.set('category', params.category);
    if (params.city) qs.set('city', params.city);
    if (params.snapEbt) qs.set('snapEbt', 'true');
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));
    qs.set('perPage', '24');

    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/places/search?${qs.toString()}`,
        { method: 'GET' },
        undefined,
        0,
      );
      const data = result.data?.data ?? result.data;
      return data as SearchResponse;
    } catch {
      return null;
    }
  }

  async logSearchDemand(input: { searchQuery: string; resolvedCategory?: string; resolvedCity?: string; resultCount: number }): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/directory/search-demand`,
        { method: 'POST', body: JSON.stringify(input) },
        undefined,
        0,
      );
    } catch {
      // Best-effort — silently fail
    }
  }
}

const searchService = PlacesSearchService.getInstance();

export default function PlacesSearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const city = searchParams.get('city') || '';
  const snapEbt = searchParams.get('snapEbt') === 'true';
  const sort = searchParams.get('sort') || 'name';
  const page = parseInt(searchParams.get('page') || '1');

  const [searchInput, setSearchInput] = useState(q);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const doSearch = useCallback(async () => {
    setLoading(true);
    const data = await searchService.search({ q, category, city, snapEbt, sort, page });
    setResults(data);
    setLoading(false);

    // Log search demand for zero-result or low-result searches (Sprint 7)
    if (data && data.total < 5 && q) {
      try {
        await searchService.logSearchDemand({
          searchQuery: q,
          resolvedCategory: category || undefined,
          resolvedCity: city || undefined,
          resultCount: data.total,
        });
      } catch {
        // Silently fail — demand logging is best-effort
      }
    }
  }, [q, category, city, snapEbt, sort, page]);

  useEffect(() => { doSearch(); }, [doSearch]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    if (key !== 'page') params.delete('page');
    router.push(`/place/search?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('q', searchInput);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search Places</h1>
        <p className="text-gray-600 mb-6">Find businesses across all cities and categories</p>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by business name, city, or category..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Search
          </button>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            value={city}
            onChange={(e) => updateParam('city', e.target.value)}
            placeholder="City"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="text"
            value={category}
            onChange={(e) => updateParam('category', e.target.value)}
            placeholder="Category"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={snapEbt}
              onChange={(e) => updateParam('snapEbt', e.target.checked ? 'true' : '')}
              className="rounded"
            />
            SNAP/EBT only
          </label>
          <select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="name">Name (A-Z)</option>
            <option value="city">City</option>
            <option value="recent">Recently Added</option>
            <option value="snap">SNAP/EBT First</option>
          </select>
        </div>

        {/* Results */}
        {loading && <p className="text-gray-500">Loading...</p>}
        {!loading && results && results.places.length === 0 && (
          <p className="text-gray-500">No places found. Try a different search.</p>
        )}
        {!loading && results && results.places.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {results.total} result{results.total !== 1 ? 's' : ''}
              {q && ` for "${q}"`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.places.map((p) => (
                <Link
                  key={p.id}
                  href={`/place/${p.slug}`}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {p.iconEmoji && <span className="text-2xl">{p.iconEmoji}</span>}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{p.businessName}</h3>
                      <p className="text-sm text-gray-500">{p.category}</p>
                      <p className="text-sm text-gray-600 mt-1">{p.city}, {p.state}</p>
                      {p.snapEbtReported && (
                        <span className="inline-block mt-2 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                          SNAP/EBT
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {results.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                {page > 1 && (
                  <button
                    onClick={() => updateParam('page', String(page - 1))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    ← Prev
                  </button>
                )}
                <span className="text-sm text-gray-600">
                  Page {page} of {results.totalPages}
                </span>
                {page < results.totalPages && (
                  <button
                    onClick={() => updateParam('page', String(page + 1))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Next →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
