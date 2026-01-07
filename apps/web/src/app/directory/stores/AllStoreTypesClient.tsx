'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { PoweredByFooter } from '@/components/PoweredByFooter';

interface StoreType {
  name: string;
  slug: string;
  storeCount: number;
  primaryStoreCount?: number;
  secondaryStoreCount?: number;
  description?: string;
  icon?: string;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function AllStoreTypesClient() {
  const router = useRouter();
  const [storeTypes, setStoreTypes] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchStoreTypes = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiBaseUrl}/api/directory/store-types`);

        if (!response.ok) {
          throw new Error('Failed to fetch store types');
        }

        const result = await response.json();
        // Handle both response formats: result.storeTypes or result.data.storeTypes
        setStoreTypes(result.storeTypes || result.data?.storeTypes || []);
      } catch (err) {
        console.error('Error fetching store types:', err);
        setError('Failed to load store types. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchStoreTypes();
  }, []);

  const filteredStoreTypes = storeTypes
    .filter((type) => type.storeCount >= 0) // Show all types in development, even with 0 count
    .filter((type) => type.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Loading store types...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/directory')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Return to Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/directory"
            className="inline-flex items-center text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Directory
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Store className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
                All Store Types
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                Browse {storeTypes.length} different types of stores
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search store types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Store Types Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredStoreTypes.length === 0 ? (
          <div className="text-center py-12">
            <Store className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">
              {searchQuery
                ? `No store types found matching "${searchQuery}"`
                : 'No store types available'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Showing {filteredStoreTypes.length} of {storeTypes.length} store types
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStoreTypes.map((type, index) => (
                <Link
                  key={`${type.slug}-${index}`}
                  href={`/directory/stores/${type.slug}`}
                  className="group"
                >
                  <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-lg hover:border-green-500 dark:hover:border-green-500 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        {type.icon || <Store className="w-6 h-6 text-green-600 dark:text-green-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-900 dark:text-white text-base mb-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                          {type.name}
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {type.storeCount} {type.storeCount === 1 ? 'store' : 'stores'}
                          {type.primaryStoreCount !== undefined && type.secondaryStoreCount !== undefined && (
                            <span className="ml-1 text-xs text-neutral-500">
                              ({type.primaryStoreCount > 0 && `${type.primaryStoreCount} primary`}
                              {type.primaryStoreCount > 0 && type.secondaryStoreCount > 0 && ', '}
                              {type.secondaryStoreCount > 0 && `${type.secondaryStoreCount} also`})
                            </span>
                          )}
                        </p>
                        {type.description && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2 line-clamp-2">
                            {type.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

                  {/* Platform Branding Footer */}
                  <PoweredByFooter />
    </div>
  );
}
