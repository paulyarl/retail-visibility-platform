/**
 * CategorySelector Component
 * Allows users to filter by product or shop categories
 * Phase 5 UI Implementation
 */

'use client';

import { useState, useEffect } from 'react';
import { Search, Package, Store } from 'lucide-react';
import { CategoryParams, CategoryType, CategoryAggregation } from '@/types/scope';
import { shopsService } from '@/services/ShopsService';

interface CategorySelectorProps {
  value?: CategoryParams;
  onChange: (category: CategoryParams) => void;
  categories?: { name: string; count: number; type: 'shop' | 'product' }[];
}

export default function CategorySelector({ value, onChange, categories = [] }: CategorySelectorProps) {
  const [categoryType, setCategoryType] = useState<CategoryType>(value?.categoryType || 'product');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Use provided categories instead of fetching from API
  useEffect(() => {
    if (categories.length > 0) {
      setLoading(false);
    }
  }, [categories]);

  // Filter categories by type and search query
  const filteredCategories = (Array.isArray(categories) ? categories : [])
    .filter(cat => cat.type === categoryType)
    .filter(cat => 
      searchQuery === '' || 
      cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => b.count - a.count);

  const handleCategoryTypeChange = (type: CategoryType) => {
    setCategoryType(type);
    // Clear selection when switching types
    onChange({
      categoryType: type
    });
  };

  const handleCategorySelect = (category: any) => {
    if (categoryType === 'product') {
      onChange({
        productName: category.name,
        productSlug: category.name,
        categoryType: 'product'
      });
    } else {
      onChange({
        shopCategoryName: category.name,
        categoryType: 'shop'
      });
    }
  };

  const selectedCategoryName = categoryType === 'product' 
    ? value?.productName 
    : value?.shopCategoryName;

  return (
    <div className="space-y-4">
      {/* Category Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => handleCategoryTypeChange('product')}
          className={`
            flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
            transition-colors
            ${categoryType === 'product'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
        >
          <Package size={18} />
          Product Categories
        </button>
        <button
          onClick={() => handleCategoryTypeChange('shop')}
          className={`
            flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
            transition-colors
            ${categoryType === 'shop'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
        >
          <Store size={18} />
          Shop Categories
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder={`Search ${categoryType} categories...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
        />
      </div>

      {/* Category List */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {filteredCategories.map((category, index) => (
          <div
            key={category.name}
            onClick={() => handleCategorySelect(category)}
            className={`
              p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all duration-200 cursor-pointer
              ${selectedCategoryName === category.name
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : 'bg-white dark:bg-gray-800'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {category.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {category.count} items
                </div>
              </div>
              {selectedCategoryName === category.name && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Category Info */}
      {selectedCategoryName && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <span className="font-medium">Filtering by:</span> {selectedCategoryName}
          </p>
        </div>
      )}
    </div>
  );
}
