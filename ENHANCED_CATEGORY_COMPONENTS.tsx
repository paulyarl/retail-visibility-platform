// ============================================================================
// ENHANCED CATEGORY COMPONENTS WITH 3-CATEGORY SUPPORT
// ============================================================================

import React, { useState, useEffect } from 'react';

// Types for enhanced category system
interface EnhancedCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
  googleCategoryId?: string | null;
  sortOrder?: number;
  productsWithImages?: number;
  productsWithDescriptions?: number;
  avgPriceCents?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  lastProductUpdated?: Date;
  // NEW: 3-category system fields
  categoryType?: 'tenant' | 'gbp_primary' | 'gbp_secondary' | 'platform';
  isPrimary?: boolean;
  tenantId?: string;
  tenantName?: string;
}

interface CategoryTypeSummary {
  type: string;
  count: number;
  products: number;
  isPrimary: boolean;
  categories: EnhancedCategory[];
}

// Category type configuration
const CATEGORY_TYPE_CONFIG = {
  tenant: {
    label: 'Store Categories',
    description: 'Your custom store categories',
    color: 'blue',
    icon: '🏪',
    priority: 1
  },
  gbp_primary: {
    label: 'Primary GBP Categories',
    description: 'Main Google Business Profile categories',
    color: 'green',
    icon: '🌟',
    priority: 2
  },
  gbp_secondary: {
    label: 'Secondary GBP Categories',
    description: 'Additional Google Business Profile categories',
    color: 'orange',
    icon: '📍',
    priority: 3
  },
  platform: {
    label: 'Platform Categories',
    description: 'Standard platform-wide categories',
    color: 'purple',
    icon: '🌐',
    priority: 4
  }
};

// Enhanced Category Card Component
export function EnhancedCategoryCard({ category }: { category: EnhancedCategory }) {
  const config = CATEGORY_TYPE_CONFIG[category.categoryType || 'tenant'];
  
  return (
    <div className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border-l-4 border-${config.color}-500`}>
      <div className="p-4">
        {/* Category Type Badge */}
        <div className="flex items-center justify-between mb-2">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
            <span className="mr-1">{config.icon}</span>
            {config.label}
          </div>
          {category.isPrimary && (
            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              ⭐ Primary
            </div>
          )}
        </div>
        
        {/* Category Name */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{category.name}</h3>
        
        {/* Product Count */}
        <div className="flex items-center text-sm text-gray-600 mb-3">
          <span className="font-medium">{category.count}</span>
          <span className="ml-1">products</span>
        </div>
        
        {/* Quality Indicators */}
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          {category.productsWithImages !== undefined && (
            <div className="flex items-center">
              <span className="mr-1">🖼️</span>
              <span>{category.productsWithImages} with images</span>
            </div>
          )}
          {category.productsWithDescriptions !== undefined && (
            <div className="flex items-center">
              <span className="mr-1">📝</span>
              <span>{category.productsWithDescriptions} with descriptions</span>
            </div>
          )}
        </div>
        
        {/* Pricing Info */}
        {category.avgPriceCents && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Avg: ${(category.avgPriceCents / 100).toFixed(2)}</span>
              <span>${(category.minPriceCents! / 100).toFixed(2)} - ${(category.maxPriceCents! / 100).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Category Type Filter Component
export function CategoryTypeFilter({ 
  selectedType, 
  onTypeChange, 
  availableTypes 
}: { 
  selectedType?: string;
  onTypeChange: (type: string | undefined) => void;
  availableTypes: CategoryTypeSummary[];
}) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-3">Filter by Category Type</h3>
      <div className="flex flex-wrap gap-2">
        {/* All Categories Option */}
        <button
          onClick={() => onTypeChange(undefined)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !selectedType 
              ? 'bg-gray-900 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Categories
        </button>
        
        {/* Category Type Options */}
        {availableTypes.map((type) => {
          const config = CATEGORY_TYPE_CONFIG[type.type as keyof typeof CATEGORY_TYPE_CONFIG];
          return (
            <button
              key={type.type}
              onClick={() => onTypeChange(type.type)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                selectedType === type.type
                  ? `bg-${config.color}-600 text-white`
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <span className="mr-2">{config.icon}</span>
              {config.label}
              <span className="ml-2 bg-white bg-opacity-20 rounded-full px-2 py-1 text-xs">
                {type.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Category Type Summary Component
export function CategoryTypeSummary({ categoryTypes }: { categoryTypes: CategoryTypeSummary[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {categoryTypes.map((type) => {
        const config = CATEGORY_TYPE_CONFIG[type.type as keyof typeof CATEGORY_TYPE_CONFIG];
        return (
          <div key={type.type} className={`bg-white rounded-lg shadow-md p-4 border-l-4 border-${config.color}-500`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
                <span className="mr-1">{config.icon}</span>
                {config.label}
              </div>
              {type.isPrimary && (
                <div className="text-xs text-yellow-600">⭐ Primary</div>
              )}
            </div>
            
            <div className="space-y-1">
              <div className="text-2xl font-bold text-gray-900">{type.count}</div>
              <div className="text-sm text-gray-600">categories</div>
              <div className="text-lg font-semibold text-gray-800">{type.products}</div>
              <div className="text-sm text-gray-600">total products</div>
            </div>
            
            <div className="mt-3 text-xs text-gray-500">
              {config.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Enhanced Categories Page Component
export function EnhancedCategoriesPage({ tenantId }: { tenantId: string }) {
  const [categories, setCategories] = useState<EnhancedCategory[]>([]);
  const [categoryTypes, setCategoryTypes] = useState<CategoryTypeSummary[]>([]);
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategoryData();
  }, [tenantId, selectedType]);

  const loadCategoryData = async () => {
    try {
      setLoading(true);
      
      // Load category types
      const typesResponse = await fetch(`/api/directory/categories/types?tenantId=${tenantId}`);
      const typesData = await typesResponse.json();
      
      if (typesData.success) {
        setCategoryTypes(typesData.data.availableTypes);
      }
      
      // Load categories (filtered or all)
      const categoriesUrl = selectedType 
        ? `/api/directory/categories/enhanced?tenantId=${tenantId}&categoryType=${selectedType}`
        : `/api/directory/categories/enhanced?tenantId=${tenantId}`;
        
      const categoriesResponse = await fetch(categoriesUrl);
      const categoriesData = await categoriesResponse.json();
      
      if (categoriesData.success) {
        // Handle both grouped and ungrouped responses
        const cats = selectedType 
          ? categoriesData.data.categories 
          : Object.values(categoriesData.data.categories).flat();
        setCategories(cats);
      }
      
    } catch (err) {
      setError('Failed to load category data');
      console.error('Category data loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading categories...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Categories Directory</h1>
        <p className="text-gray-600">
          Browse and filter categories by type: Store, GBP, and Platform categories
        </p>
      </div>

      {/* Category Type Summary */}
      <CategoryTypeSummary categoryTypes={categoryTypes} />

      {/* Category Type Filter */}
      <CategoryTypeFilter 
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        availableTypes={categoryTypes}
      />

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <EnhancedCategoryCard key={category.id} category={category} />
        ))}
      </div>

      {/* Empty State */}
      {categories.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">No categories found</div>
          <div className="text-gray-400 mt-2">
            {selectedType ? 'Try selecting a different category type' : 'No categories available for this tenant'}
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedCategoriesPage;
