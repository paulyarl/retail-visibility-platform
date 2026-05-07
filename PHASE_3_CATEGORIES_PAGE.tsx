// ============================================================================
// PHASE 3: CATEGORIES LISTING PAGE
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { Search, Users, Star, Package, ArrowRight, Filter, Grid, List } from 'lucide-react';

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
}

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'products' | 'stores' | 'quality' | 'name'>('products');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/directory/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedCategories = categories
    .filter(category => 
      category.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'products':
          return b.total_products - a.total_products;
        case 'stores':
          return b.store_count - a.store_count;
        case 'quality':
          return b.avg_quality - a.avg_quality;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Browse Categories</h1>
              <p className="text-gray-600 mt-1">
                Explore {categories.length} categories with {categories.reduce((sum, cat) => sum + cat.total_products, 0)} products
              </p>
            </div>
            
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {filteredAndSortedCategories.length} categories found
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
                <option value="stores">Most Stores</option>
                <option value="quality">Highest Quality</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
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

      {/* Categories Grid/List */}
      <div className="container mx-auto px-4 pb-12">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedCategories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedCategories.map((category) => (
              <CategoryListItem key={category.id} category={category} />
            ))}
          </div>
        )}

        {filteredAndSortedCategories.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📂</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No categories found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Category Card Component (Grid View)
const CategoryCard: React.FC<{ category: Category }> = ({ category }) => {
  return (
    <a 
      href={`/directory/categories/${category.slug}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 block group hover:scale-105"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-5xl">{category.icon}</div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{category.total_products}</div>
          <div className="text-sm text-gray-600">Products</div>
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
        {category.name}
      </h3>
      
      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
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
              <span className="truncate">{store.name}</span>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">{store.product_count}</span>
            </div>
          ))}
          {category.top_stores.length > 2 && (
            <div className="text-xs text-blue-600">+{category.top_stores.length - 2} more</div>
          )}
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-blue-600 font-medium">View all stores</span>
        <ArrowRight className="w-4 h-4 text-blue-600" />
      </div>
    </a>
  );
};

// Category List Item Component (List View)
const CategoryListItem: React.FC<{ category: Category }> = ({ category }) => {
  return (
    <a 
      href={`/directory/categories/${category.slug}`}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 flex items-center gap-6 group"
    >
      <div className="text-4xl flex-shrink-0">{category.icon}</div>
      
      <div className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {category.name}
          </h3>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">{category.total_products}</div>
            <div className="text-sm text-gray-600">Products</div>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {category.store_count} stores
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500" />
            {category.avg_quality}/100 quality
          </span>
        </div>
        
        {/* Top Stores Preview */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Top stores:</span>
          <div className="flex gap-3">
            {category.top_stores.slice(0, 3).map((store) => (
              <span key={store.id} className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {store.name} ({store.product_count})
              </span>
            ))}
          </div>
          {category.top_stores.length > 3 && (
            <span className="text-xs text-blue-600">+{category.top_stores.length - 3} more</span>
          )}
        </div>
      </div>
      
      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
    </a>
  );
};

export default CategoriesPage;
