'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  icon?: string | null;
  storeCount: number;
  primaryStoreCount?: number;
  secondaryStoreCount?: number;
  productCount: number;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function AllCategoriesClient() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        // Fetch from materialized view for primary/secondary breakdown
        const response = await fetch(`${apiBaseUrl}/api/directory/mv/categories`);

        if (!response.ok) {
          throw new Error('Failed to fetch categories');
        }

        const result = await response.json();
        const transformedCategories = (result.categories || []).map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          googleCategoryId: cat.googleCategoryId,
          icon: cat.icon,
          storeCount: cat.storeCount,
          primaryStoreCount: cat.primaryStoreCount,
          secondaryStoreCount: cat.secondaryStoreCount,
          productCount: cat.totalProducts,
        }));
        setCategories(transformedCategories);
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError('Failed to load categories. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const filteredCategories = categories
    .filter((cat) => cat.storeCount > 0) // Only show categories that have stores
    .filter((cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Loading categories...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Error Loading Categories
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{error}</p>
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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Back Link */}
          <Link
            href="/directory"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Directory
          </Link>

          {/* Title */}
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
            All Categories
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Browse stores by product category
          </p>

          {/* Search */}
          <div className="mt-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredCategories.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <Package className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
              {searchQuery ? 'No categories found' : 'No categories available'}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400">
              {searchQuery
                ? `No categories match "${searchQuery}"`
                : 'Categories will appear here once stores add products.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              Showing {filteredCategories.length} of {categories.filter(cat => cat.storeCount > 0).length}{' '}
              {categories.filter(cat => cat.storeCount > 0).length === 1 ? 'category' : 'categories'} with stores
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() =>
                    router.push(`/directory/categories/${category.slug}`)
                  }
                  className="flex items-start gap-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-all bg-white dark:bg-neutral-800"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
                    {category.icon || <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="font-medium text-neutral-900 dark:text-white text-sm truncate">
                      {category.name}
                    </h3>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      {/* Show primary/secondary breakdown if available */}
                      {category.primaryStoreCount !== undefined && category.secondaryStoreCount !== undefined ? (
                        <>
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            {category.primaryStoreCount} specialized
                          </span>
                          {category.secondaryStoreCount > 0 && (
                            <span className="text-neutral-500">
                              {' + '}{category.secondaryStoreCount} also carry
                            </span>
                          )}
                          <div className="mt-0.5">
                            {category.productCount}{' '}
                            {category.productCount === 1 ? 'product' : 'products'}
                          </div>
                        </>
                      ) : (
                        <>
                          {category.storeCount}{' '}
                          {category.storeCount === 1 ? 'store' : 'stores'}
                          {' · '}
                          {category.productCount}{' '}
                          {category.productCount === 1 ? 'product' : 'products'}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
