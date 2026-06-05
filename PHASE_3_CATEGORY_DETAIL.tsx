// ============================================================================
// PHASE 3: CATEGORY DETAIL PAGE
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Search, 
  Star, 
  MapPin, 
  Package, 
  ArrowLeft, 
  Filter, 
  Grid, 
  List,
  DollarSign,
  TrendingUp,
  Users
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  total_stores: number;
  total_products: number;
}

interface Store {
  id: string;
  name: string;
  slug: string | null;
  product_count: number;
  quality_score: number;
  avg_price: number;
  in_stock_count: number;
  city: string;
  state: string;
  is_featured: boolean;
  is_primary: boolean;
  rating_avg: number;
  rating_count: number;
}

interface CategoryDetailData {
  category: Category[];
  stores: Store[];
}

const CategoryDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [data, setData] = useState<CategoryDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'products' | 'quality' | 'price' | 'rating'>('products');

  useEffect(() => {
    if (slug) {
      fetchCategoryData();
    }
  }, [slug]);

  const fetchCategoryData = async () => {
    try {
      const response = await fetch(`/api/directory/categories/${slug}/stores`);
      if (!response.ok) {
        throw new Error('Category not found');
      }
      const categoryData = await response.json();
      setData(categoryData);
    } catch (error) {
      console.error('Error fetching category data:', error);
      setError('Category not found or failed to load');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedStores = data?.stores
    .filter(store => 
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.city.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'products':
          return b.product_count - a.product_count;
        case 'quality':
          return b.quality_score - a.quality_score;
        case 'price':
          return (a.avg_price || 0) - (b.avg_price || 0);
        case 'rating':
          return (b.rating_avg || 0) - (a.rating_avg || 0);
        default:
          return 0;
      }
    }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !data || !data.category.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📂</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Category Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'This category does not exist'}</p>
          <button
            onClick={() => router.push('/directory/categories')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse All Categories
          </button>
        </div>
      </div>
    );
  }

  const category = data.category[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 py-12">
          <button
            onClick={() => router.push('/directory/categories')}
            className="flex items-center gap-2 text-blue-100 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Categories
          </button>
          
          <div className="flex items-center gap-6">
            <div className="text-6xl">{category.icon}</div>
            <div>
              <h1 className="text-4xl font-bold mb-2">{category.name}</h1>
              <div className="flex items-center gap-6 text-blue-100">
                <span className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {category.total_products} products
                </span>
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {category.total_stores} stores
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{category.total_products}</div>
              <div className="text-sm text-gray-600">Total Products</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{category.total_stores}</div>
              <div className="text-sm text-gray-600">Active Stores</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                ${filteredAndSortedStores.reduce((sum, store) => sum + (store.avg_price || 0), 0) / (filteredAndSortedStores.length || 1)}
              </div>
              <div className="text-sm text-gray-600">Avg Price</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {filteredAndSortedStores.reduce((sum, store) => sum + store.quality_score, 0) / (filteredAndSortedStores.length || 1)}
              </div>
              <div className="text-sm text-gray-600">Avg Quality</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {filteredAndSortedStores.length} stores found
            </span>
            
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="products">Most Products</option>
                <option value="quality">Highest Quality</option>
                <option value="price">Lowest Price</option>
                <option value="rating">Highest Rating</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stores..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-white border rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stores Grid/List */}
      <div className="container mx-auto px-4 pb-12">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedStores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedStores.map((store) => (
              <StoreListItem key={store.id} store={store} />
            ))}
          </div>
        )}

        {filteredAndSortedStores.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No stores found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Store Card Component (Grid View)
const StoreCard: React.FC<{ store: Store }> = ({ store }) => {
  return (
    <a 
      href={`/directory/stores/${store.id}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 block group hover:scale-105"
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
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded">
          <div className="text-lg font-semibold text-gray-900">{store.product_count}</div>
          <div className="text-xs text-gray-600">Products</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded">
          <div className="text-lg font-semibold text-gray-900">{store.quality_score}/100</div>
          <div className="text-xs text-gray-600">Quality</div>
        </div>
      </div>
      
      {/* Additional Info */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Avg Price:</span>
          <span className="font-medium">${store.avg_price || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">In Stock:</span>
          <span className="font-medium">{store.in_stock_count}</span>
        </div>
      </div>
      
      {/* Rating */}
      {store.rating_avg > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.floor(store.rating_avg)
                    ? 'text-yellow-500 fill-current'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-600">
            {store.rating_avg} ({store.rating_count} reviews)
          </span>
        </div>
      )}
    </a>
  );
};

// Store List Item Component (List View)
const StoreListItem: React.FC<{ store: Store }> = ({ store }) => {
  return (
    <a 
      href={`/directory/stores/${store.id}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 flex items-center gap-6 group"
    >
      <div className="flex-1">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
              {store.name}
            </h3>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {store.city}, {store.state}
              </span>
              {store.is_featured && (
                <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded">
                  Featured
                </span>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">{store.product_count}</div>
            <div className="text-sm text-gray-600">Products</div>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Quality: </span>
            <span className="font-medium">{store.quality_score}/100</span>
          </div>
          <div>
            <span className="text-gray-600">Avg Price: </span>
            <span className="font-medium">${store.avg_price || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-600">In Stock: </span>
            <span className="font-medium">{store.in_stock_count}</span>
          </div>
          <div>
            <span className="text-gray-600">Rating: </span>
            <span className="font-medium">{store.rating_avg || 'N/A'}</span>
          </div>
        </div>
      </div>
    </a>
  );
};

export default CategoryDetailPage;
