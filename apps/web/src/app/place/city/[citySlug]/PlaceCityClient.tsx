'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
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
}

interface CityResponse {
  city: string;
  citySlug: string;
  categories: Array<{ category: string; slug: string; iconEmoji: string | null; places: PlaceResult[] }>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

class PlacesCityService extends PublicApiSingleton {
  private static instance: PlacesCityService;
  private constructor() { super('places-city', { ttl: 0 }); }
  static getInstance() {
    if (!PlacesCityService.instance) PlacesCityService.instance = new PlacesCityService();
    return PlacesCityService.instance;
  }

  async getCity(citySlug: string, params: { sort?: string; page?: number }): Promise<CityResponse | null> {
    const qs = new URLSearchParams();
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));
    qs.set('perPage', '24');

    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/places/city/${encodeURIComponent(citySlug)}?${qs.toString()}`,
        { method: 'GET' },
        undefined,
        0,
      );
      const data = result.data?.data ?? result.data;
      return data as CityResponse;
    } catch {
      return null;
    }
  }
}

const cityService = PlacesCityService.getInstance();

export default function PlaceCityClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const citySlug = (params?.citySlug as string) || '';

  const sort = searchParams.get('sort') || 'name';
  const page = parseInt(searchParams.get('page') || '1');

  const [data, setData] = useState<CityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await cityService.getCity(citySlug, { sort, page });
    setData(result);
    setLoading(false);
  }, [citySlug, sort, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateParam = (key: string, value: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value); else sp.delete(key);
    if (key !== 'page') sp.delete('page');
    router.push(`/place/city/${citySlug}?${sp.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Places Found</h1>
          <p className="text-gray-600 mb-4">We don&apos;t have any listings in this city yet.</p>
          <Link href="/place" className="text-blue-600 hover:underline">← Browse all places</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/place" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          ← All places
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Places in {data.city}
        </h1>
        <p className="text-gray-600 mb-6">{data.total} business{data.total !== 1 ? 'es' : ''}</p>

        {/* Sort */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm text-gray-500">Sort:</span>
          <select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="name">Name (A-Z)</option>
            <option value="recent">Recently Added</option>
            <option value="snap">SNAP/EBT First</option>
          </select>
        </div>

        {/* Category breakdown chips */}
        {data.categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {data.categories.map((c) => (
              <Link
                key={c.slug}
                href={`/place/category/${c.slug}?city=${encodeURIComponent(data.city)}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm hover:bg-gray-50"
              >
                {c.iconEmoji && <span>{c.iconEmoji}</span>}
                <span>{c.category}</span>
                <span className="text-gray-400">({c.places.length})</span>
              </Link>
            ))}
          </div>
        )}

        {/* Listings grouped by category */}
        <div className="space-y-8">
          {data.categories.map((cat) => (
            <div key={cat.slug}>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                {cat.iconEmoji && <span className="mr-2">{cat.iconEmoji}</span>}
                {cat.category}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.places.map((p) => (
                  <Link
                    key={p.id}
                    href={`/place/${p.slug}`}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-semibold text-gray-900 truncate">{p.businessName}</h3>
                    <p className="text-sm text-gray-600 mt-1">{p.address}</p>
                    <p className="text-sm text-gray-500">{p.phone}</p>
                    {p.snapEbtReported && (
                      <span className="inline-block mt-2 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        SNAP/EBT
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
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
              Page {page} of {data.totalPages}
            </span>
            {page < data.totalPages && (
              <button
                onClick={() => updateParam('page', String(page + 1))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Next →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
