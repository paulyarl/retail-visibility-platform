// ============================================================================
// PHASE 3: SEARCH RESULTS PAGE
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, 
  Star, 
  MapPin, 
  Package, 
  ArrowLeft, 
  Filter,
  Grid,
  List,
  Users,
  TrendingUp
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  store_count: number;
  total_products: number;
  avg_quality: number;
  relevance_score: number;
}

interface Store {
  id: string;
  name: string;
  slug: string | null;
  city: string;
  state: string;
  matching_categories: Array<{
    id: string;
    name: string;
    slug: string;
    product_count: number;
    quality_score: number;
  }>;
  total_products: number;
  relevance_score: number;
}

interface SearchData {
  query: string;
  categories: Category[];
  stores: Store[];
}

const SearchPage: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  const [activeTab, setActiveTab] = useState<'all' | 'categories' | 'stores'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/directory/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchData(data);
    } catch (error) {
      console.error('Error performing search:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/directory/search?q=${encodeURIComponent(searchInput)}`);
    }
  };

  const getFilteredResults = () => {
    if (!searchData) return { categories: [], stores: [] };
    
    switch (activeTab) {
      case 'categories':
        return { categories: searchData.categories, stores: [] };
      case 'stores':
        return { categories: [], stores: searchData.stores };
      default:
        return searchData;
    }
  };

  const filteredResults = getFilteredResults();

  if (!query) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Search Directory</h1>
          <p className="text-gray-600 mb-6">Enter a search term to find categories and stores</p>
          <form onSubmit={handleSearch} className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search categories or stores..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/directory')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search categories or stores..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Results Summary */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Search Results for "{query}"
            </h1>
            <p className="text-gray-600 mt-1">
              {filteredResults.categories.length} categories, {filteredResults.stores.length} stores found
            </p>
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

      {/* Tabs */}
      <div className="container mx-auto px-4">
        <div className="flex gap-1 bg-white border rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
          >
            All Results ({(filteredResults.categories.length + filteredResults.stores.length)})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded ${activeTab === 'categories' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
          >
            Categories ({filteredResults.categories.length})
          </button>
          <button
            onClick={() => setActiveTab('stores')}
            className={`px-4 py-2 rounded ${activeTab === 'stores' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
          >
            Stores ({filteredResults.stores.length})
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 py-6">
        {filteredResults.categories.length === 0 && filteredResults.stores.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600 mb-4">Try searching with different keywords</p>
            <button
              onClick={() => router.push('/directory')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Directory
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Categories Section */}
            {(activeTab === 'all' || activeTab === 'categories') && filteredResults.categories.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Categories ({filteredResults.categories.length})
                </h2>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredResults.categories.map((category) => (
                      <CategoryResultCard key={category.id} category={category} query={query} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredResults.categories.map((category) => (
                      <CategoryResultItem key={category.id} category={category} query={query} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Stores Section */}
            {(activeTab === 'all' || activeTab === 'stores') && filteredResults.stores.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Stores ({filteredResults.stores.length})
                </h2>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredResults.stores.map((store) => (
                      <StoreResultCard key={store.id} store={store} query={query} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredResults.stores.map((store) => (
                      <StoreResultItem key={store.id} store={store} query={query} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Category Result Card (Grid View)
const CategoryResultCard: React.FC<{ category: Category; query: string }> = ({ category, query }) => {
  const highlightMatch = (text: string) => {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  return (
    <a 
      href={`/directory/categories/${category.slug}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 block group hover:scale-105"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-4xl">{category.icon}</div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-600">{category.relevance_score}%</div>
          <div className="text-xs text-gray-600">Match</div>
        </div>
      </div>
      
      <h3 
        className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors"
        dangerouslySetInnerHTML={{ __html: highlightMatch(category.name) }}
      />
      
      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
        <span className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          {category.store_count} stores
        </span>
        <span className="flex items-center gap-1">
          <Package className="w-4 h-4" />
          {category.total_products} products
        </span>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-sm text-blue-600 font-medium">View stores</span>
        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
          {category.avg_quality}/100 quality
        </span>
      </div>
    </a>
  );
};

// Category Result Item (List View)
const CategoryResultItem: React.FC<{ category: Category; query: string }> = ({ category, query }) => {
  const highlightMatch = (text: string) => {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  return (
    <a 
      href={`/directory/categories/${category.slug}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 flex items-center gap-6 group"
    >
      <div className="text-4xl flex-shrink-0">{category.icon}</div>
      
      <div className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 
            className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors"
            dangerouslySetInnerHTML={{ __html: highlightMatch(category.name) }}
          />
          <div className="text-lg font-bold text-green-600">{category.relevance_score}% match</div>
        </div>
        
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {category.store_count} stores
          </span>
          <span className="flex items-center gap-1">
            <Package className="w-4 h-4" />
            {category.total_products} products
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            {category.avg_quality}/100 quality
          </span>
        </div>
      </div>
    </a>
  );
};

// Store Result Card (Grid View)
const StoreResultCard: React.FC<{ store: Store; query: string }> = ({ store, query }) => {
  const highlightMatch = (text: string) => {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  return (
    <a 
      href={`/directory/stores/${store.id}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 block group hover:scale-105"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 
            className="text-xl font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors"
            dangerouslySetInnerHTML={{ __html: highlightMatch(store.name) }}
          />
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4" />
            {store.city}, {store.state}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-600">{store.relevance_score}%</div>
          <div className="text-xs text-gray-600">Match</div>
        </div>
      </div>
      
      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-600">Total Products:</span>
          <span className="font-medium">{store.total_products}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Matching Categories:</span>
          <span className="font-medium">{store.matching_categories.length}</span>
        </div>
      </div>
      
      {/* Matching Categories */}
      <div className="border-t pt-3">
        <div className="text-xs text-gray-500 mb-2">Matches in:</div>
        <div className="space-y-1">
          {store.matching_categories.slice(0, 2).map((category) => (
            <div key={category.id} className="text-sm text-gray-600 flex justify-between">
              <span>{category.name}</span>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">{category.product_count}</span>
            </div>
          ))}
          {store.matching_categories.length > 2 && (
            <div className="text-xs text-blue-600">+{store.matching_categories.length - 2} more</div>
          )}
        </div>
      </div>
    </a>
  );
};

// Store Result Item (List View)
const StoreResultItem: React.FC<{ store: Store; query: string }> = ({ store, query }) => {
  const highlightMatch = (text: string) => {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  return (
    <a 
      href={`/directory/stores/${store.id}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 flex items-center gap-6 group"
    >
      <div className="flex-1">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 
              className="text-xl font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors"
              dangerouslySetInnerHTML={{ __html: highlightMatch(store.name) }}
            />
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {store.city}, {store.state}
              </span>
              <span className="text-green-600 font-medium">{store.relevance_score}% match</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">{store.total_products}</div>
            <div className="text-sm text-gray-600">Products</div>
          </div>
        </div>
        
        {/* Matching Categories */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Matches in:</span>
          <div className="flex gap-2">
            {store.matching_categories.slice(0, 3).map((category) => (
              <span key={category.id} className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {category.name}
              </span>
            ))}
          </div>
          {store.matching_categories.length > 3 && (
            <span className="text-xs text-blue-600">+{store.matching_categories.length - 3} more</span>
          )}
        </div>
      </div>
    </a>
  );
};

export default SearchPage;
