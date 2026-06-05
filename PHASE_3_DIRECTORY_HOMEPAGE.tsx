// ============================================================================
// PHASE 3: DIRECTORY HOMEPAGE COMPONENT
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { Search, Star, MapPin, Package, TrendingUp, Users, ArrowRight } from 'lucide-react';

// Types for our API responses
interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  level: number;
  store_count: number;
  total_products: number;
  avg_quality: number;
  top_stores: Store[];
}

interface Store {
  id: string;
  name: string;
  product_count: number;
  quality_score: number;
  city: string;
  state: string;
  is_featured: boolean;
  avg_price?: number;
  rating_avg?: number;
}

interface FeaturedData {
  featured_categories: Category[];
  featured_stores: Store[];
}

const DirectoryHomepage: React.FC = () => {
  const [featuredData, setFeaturedData] = useState<FeaturedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFeaturedData();
  }, []);

  const fetchFeaturedData = async () => {
    try {
      const response = await fetch('/api/directory/featured');
      const data = await response.json();
      setFeaturedData(data);
    } catch (error) {
      console.error('Error fetching featured data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/directory/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Discover Local Stores
            </h1>
            <p className="text-xl mb-8 text-blue-100">
              Browse categories, find stores, and explore products from local businesses
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search categories or stores..."
                  className="w-full px-6 py-4 rounded-lg text-gray-900 placeholder-gray-500 text-lg shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-4 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {featuredData?.featured_categories.reduce((sum, cat) => sum + cat.total_products, 0) || 0}
            </div>
            <div className="text-gray-600">Total Products</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {featuredData?.featured_stores.length || 0}
            </div>
            <div className="text-gray-600">Active Stores</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {featuredData?.featured_categories.length || 0}
            </div>
            <div className="text-gray-600">Categories</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {featuredData?.featured_stores.reduce((sum, store) => sum + (store.rating_avg || 0), 0) / (featuredData?.featured_stores.length || 1) || 0}
            </div>
            <div className="text-gray-600">Avg Rating</div>
          </div>
        </div>
      </div>

      {/* Featured Categories */}
      <div className="container mx-auto px-4 mb-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Featured Categories</h2>
          <a 
            href="/directory/categories"
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
          >
            View All Categories
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredData?.featured_categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>

      {/* Featured Stores */}
      <div className="container mx-auto px-4 mb-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Featured Stores</h2>
          <a 
            href="/directory/stores"
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
          >
            View All Stores
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {featuredData?.featured_stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Category Card Component
const CategoryCard: React.FC<{ category: Category }> = ({ category }) => {
  return (
    <a 
      href={`/directory/categories/${category.slug}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 block group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-4xl">{category.icon}</div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{category.total_products}</div>
          <div className="text-sm text-gray-600">Products</div>
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
        {category.name}
      </h3>
      
      <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
        <span className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          {category.store_count} stores
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500" />
          {category.avg_quality}/100
        </span>
      </div>
      
      {/* Top Stores Preview */}
      <div className="border-t pt-3">
        <div className="text-xs text-gray-500 mb-2">Top stores:</div>
        <div className="space-y-1">
          {category.top_stores.slice(0, 2).map((store) => (
            <div key={store.id} className="text-sm text-gray-600 flex justify-between">
              <span>{store.name}</span>
              <span>{store.product_count} products</span>
            </div>
          ))}
        </div>
      </div>
    </a>
  );
};

// Store Card Component
const StoreCard: React.FC<{ store: Store }> = ({ store }) => {
  return (
    <a 
      href={`/directory/stores/${store.id}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 block group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
            {store.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4" />
            {store.city}, {store.state}
          </div>
        </div>
        {store.is_featured && (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded">
            Featured
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-semibold text-gray-900">{store.product_count}</div>
          <div className="text-xs text-gray-600">Products</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{store.quality_score}/100</div>
          <div className="text-xs text-gray-600">Quality</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">${store.avg_price || '0'}</div>
          <div className="text-xs text-gray-600">Avg Price</div>
        </div>
      </div>
      
      {store.rating_avg && store.rating_avg > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.floor(store.rating_avg || 0)
                    ? 'text-yellow-500 fill-current'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-600">
            {store.rating_avg} ({store.rating_count || 0} reviews)
          </span>
        </div>
      )}
    </a>
  );
};

export default DirectoryHomepage;
