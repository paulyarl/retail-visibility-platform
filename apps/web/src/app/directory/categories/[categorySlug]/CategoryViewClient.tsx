'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, MapPin, Package, Store, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  storeCount: number;
  productCount: number;
}

interface Store {
  id: string;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  distance?: number;
  productCount: number;
  verified: boolean;
  lastSync: string | null;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface CategoryData {
  category: Category;
  categoryPath: Category[];
  stores: Store[];
  totalCount: number;
  returnedCount: number;
  location: { lat: number; lng: number } | null;
  radius: number;
}

interface CategoryViewClientProps {
  categorySlug: string;
  searchParams: {
    lat?: string;
    lng?: string;
    radius?: string;
  };
}

export default function CategoryViewClient({
  categorySlug,
  searchParams,
}: CategoryViewClientProps) {
  const router = useRouter();
  const [data, setData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategoryData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

        // Build query params
        const params = new URLSearchParams();
        if (searchParams.lat) params.set('lat', searchParams.lat);
        if (searchParams.lng) params.set('lng', searchParams.lng);
        if (searchParams.radius) params.set('radius', searchParams.radius);

        const response = await fetch(
          `${apiBaseUrl}/api/directory/categories/${categorySlug}/stores?${params}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch category data');
        }

        const result = await response.json();
        setData(result.data);
      } catch (err) {
        console.error('Error fetching category data:', err);
        setError('Failed to load category. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, [categorySlug, searchParams.lat, searchParams.lng, searchParams.radius]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Loading category...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Category Not Found
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {error || 'The category you are looking for does not exist.'}
          </p>
          <Link
            href="/directory"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  const { category, categoryPath, stores, totalCount } = data;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            <Link
              href="/directory"
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              Directory
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link
              href="/directory/categories"
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              Categories
            </Link>
            {categoryPath.map((cat, index) => (
              <div key={cat.id} className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4" />
                {index === categoryPath.length - 1 ? (
                  <span className="text-neutral-900 dark:text-white font-medium">
                    {cat.name}
                  </span>
                ) : (
                  <Link
                    href={`/directory/categories/${cat.slug}`}
                    className="hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {cat.name}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Category Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
                {category.name}
              </h1>
              <div className="flex items-center gap-4 text-neutral-600 dark:text-neutral-400">
                <div className="flex items-center gap-1">
                  <Store className="w-4 h-4" />
                  <span>
                    {totalCount} {totalCount === 1 ? 'store' : 'stores'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  <span>
                    {category.productCount}{' '}
                    {category.productCount === 1 ? 'product' : 'products'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {stores.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <Store className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
              No Stores Found
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              There are currently no stores with products in this category.
            </p>
            <Link
              href="/directory"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Browse All Stores
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {stores.map((store) => (
              <Link
                key={store.id}
                href={`/tenant/${store.id}`}
                className="block bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-6 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                        {store.name}
                      </h3>
                      {store.verified && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          ✓ Verified
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                      {store.address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {store.address}
                            {store.city && `, ${store.city}`}
                            {store.state && `, ${store.state}`}
                          </span>
                        </div>
                      )}
                      {store.distance !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            {store.distance.toFixed(1)} mi
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        <span>
                          {store.productCount}{' '}
                          {store.productCount === 1 ? 'product' : 'products'} in{' '}
                          {category.name}
                        </span>
                      </div>
                    </div>

                    {store.lastSync && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
                        Last updated:{' '}
                        {new Date(store.lastSync).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="w-5 h-5 text-neutral-400 flex-shrink-0 ml-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
