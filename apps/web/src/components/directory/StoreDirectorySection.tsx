/**
 * Store Directory Section
 * 
 * Displays published stores in the directory.
 * Integrates with Store Publish Singleton for real-time updates.
 * Supports filtering, pagination, and various display modes.
 */

'use client';

import { useState, useEffect } from 'react';
import { useStorePublish } from '@/providers/data/StorePublishProvider';
import { PublishedStore, DirectoryCategory, StorePublishOptions } from '@/providers/data/StorePublishSingleton';

interface StoreDirectorySectionProps {
  title?: string;
  limit?: number;
  category?: string;
  featured?: boolean;
  trending?: boolean;
  showFilters?: boolean;
  showPagination?: boolean;
  layout?: 'grid' | 'list' | 'cards';
  className?: string;
}

export default function StoreDirectorySection({
  title = 'Store Directory',
  limit = 20,
  category,
  featured = false,
  trending = false,
  showFilters = true,
  showPagination = true,
  layout = 'grid',
  className = ''
}: StoreDirectorySectionProps) {
  const {
    stores,
    categories,
    loading,
    error,
    totalCount,
    loadStores,
    setFilters,
    getFeaturedStores,
    getTrendingStores,
    getStoresByCategory
  } = useStorePublish();

  const [displayStores, setDisplayStores] = useState<PublishedStore[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(category || '');
  const [sortBy, setSortBy] = useState<'publishedAt' | 'lastUpdated' | 'rating' | 'viewCount' | 'featuredRank'>('publishedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [displayLayout, setDisplayLayout] = useState<'grid' | 'list' | 'cards'>(layout);

  // Load stores based on props
  useEffect(() => {
    const loadStoreData = async () => {
      try {
        let storeData: PublishedStore[] = [];

        if (featured) {
          storeData = await getFeaturedStores(limit);
        } else if (trending) {
          storeData = await getTrendingStores(limit);
        } else if (selectedCategory) {
          storeData = await getStoresByCategory(selectedCategory, limit);
        } else {
          await loadStores({ limit, category: selectedCategory, featured, trending });
          return; // loadStores will update the stores state
        }

        setDisplayStores(storeData);
      } catch (error) {
        console.error('Failed to load store data:', error);
      }
    };

    loadStoreData();
  }, [featured, trending, selectedCategory, limit]);

  // Update display stores when stores change
  useEffect(() => {
    if (!featured && !trending && !selectedCategory) {
      setDisplayStores(stores.slice(0, limit));
    }
  }, [stores, featured, trending, selectedCategory, limit]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<StorePublishOptions>) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  // Handle category change
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  // Handle sort change
  const handleSortChange = (newSortBy: 'publishedAt' | 'lastUpdated' | 'rating' | 'viewCount' | 'featuredRank', newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    handleFilterChange({ sortBy: newSortBy, sortOrder: newSortOrder });
  };

  // Render store card
  const renderStoreCard = (store: PublishedStore) => {
    const primaryPhoto = store.gallery.find(photo => photo.isPrimary) || store.gallery[0];
    
    return (
      <div key={store.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
        {/* Store Image */}
        <div className="relative h-48 bg-gray-200 rounded-t-lg overflow-hidden">
          {primaryPhoto ? (
            <img
              src={primaryPhoto.url}
              alt={primaryPhoto.alt || store.branding?.theme || 'Store image'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-300">
              <span className="text-gray-500">No Image</span>
            </div>
          )}
          
          {/* Featured/Trending Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {store.featuredRank && (
              <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                Featured #{store.featuredRank}
              </span>
            )}
            {store.trending && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                Trending
              </span>
            )}
          </div>
        </div>

        {/* Store Info */}
        <div className="p-4">
          {/* Store Name & Rating */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {store.branding?.theme || 'Store Name'}
            </h3>
            <div className="flex items-center text-sm text-gray-600">
              <span className="text-yellow-500">★</span>
              <span className="ml-1">{store.rating.toFixed(1)}</span>
              <span className="ml-1 text-gray-400">({store.reviewCount})</span>
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-1 mb-2">
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
              {store.primaryCategory.name}
            </span>
            {store.secondaryCategories.slice(0, 2).map(cat => (
              <span key={cat.id} className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                {cat.name}
              </span>
            ))}
          </div>

          {/* Location */}
          <div className="text-sm text-gray-600 mb-2">
            📍 {store.location.city}, {store.location.state}
          </div>

          {/* Contact */}
          <div className="text-sm text-gray-600 mb-3">
            📞 {store.contact.phone}
          </div>

          {/* Hours */}
          <div className="text-xs text-gray-500 mb-3">
            {store.hours.monday.closed ? 'Closed Monday' : `Open ${store.hours.monday.open} - ${store.hours.monday.close}`}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button className="flex-1 bg-blue-600 text-white text-sm py-2 px-3 rounded hover:bg-blue-700 transition-colors">
              View Store
            </button>
            <button className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded hover:bg-gray-50 transition-colors">
              Contact
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render list item
  const renderListItem = (store: PublishedStore) => {
    const primaryPhoto = store.gallery.find(photo => photo.isPrimary) || store.gallery[0];
    
    return (
      <div key={store.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-4">
        <div className="flex gap-4">
          {/* Store Image */}
          <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
            {primaryPhoto ? (
              <img
                src={primaryPhoto.url}
                alt={primaryPhoto.alt || store.branding?.theme || 'Store image'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-300">
                <span className="text-gray-500 text-xs">No Image</span>
              </div>
            )}
          </div>

          {/* Store Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {store.branding?.theme || 'Store Name'}
              </h3>
              <div className="flex items-center text-sm text-gray-600">
                <span className="text-yellow-500">★</span>
                <span className="ml-1">{store.rating.toFixed(1)}</span>
              </div>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-1 mb-2">
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                {store.primaryCategory.name}
              </span>
              {store.secondaryCategories.slice(0, 2).map(cat => (
                <span key={cat.id} className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                  {cat.name}
                </span>
              ))}
            </div>

            {/* Location & Contact */}
            <div className="text-sm text-gray-600 mb-2">
              📍 {store.location.city}, {store.location.state} • 📞 {store.contact.phone}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button className="bg-blue-600 text-white text-sm py-1 px-3 rounded hover:bg-blue-700 transition-colors">
                View Store
              </button>
              <button className="border border-gray-300 text-gray-700 text-sm py-1 px-3 rounded hover:bg-gray-50 transition-colors">
                Contact
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: limit }).map((_, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-4 animate-pulse">
              <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error loading stores: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (displayStores.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-gray-500 mb-4">
            <div className="text-4xl mb-2">🏪</div>
            <p className="text-lg">No stores found</p>
          </div>
          <p className="text-gray-400 text-sm">
            {featured ? 'No featured stores available.' : 
             trending ? 'No trending stores at the moment.' :
             'Try adjusting your filters or check back later.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <div className="text-sm text-gray-600">
          {totalCount > 0 && (
            <span>{displayStores.length} of {totalCount} stores</span>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as 'publishedAt' | 'lastUpdated' | 'rating' | 'viewCount' | 'featuredRank', sortOrder)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="publishedAt">Published Date</option>
                <option value="rating">Rating</option>
                <option value="viewCount">Views</option>
                <option value="lastUpdated">Last Updated</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => handleSortChange(sortBy, e.target.value as 'asc' | 'desc')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>

            {/* Layout */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Layout</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDisplayLayout('grid')}
                  className={`px-3 py-2 rounded ${displayLayout === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setDisplayLayout('list')}
                  className={`px-3 py-2 rounded ${displayLayout === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stores */}
      <div className={displayLayout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {displayStores.map(store => 
          displayLayout === 'list' ? renderListItem(store) : renderStoreCard(store)
        )}
      </div>

      {/* Pagination */}
      {showPagination && totalCount > limit && (
        <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} stores
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1">
              Page {currentPage} of {Math.ceil(totalCount / limit)}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / limit), currentPage + 1))}
              disabled={currentPage >= Math.ceil(totalCount / limit)}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
