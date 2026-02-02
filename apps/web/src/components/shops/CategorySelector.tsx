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
}

export default function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const [categoryType, setCategoryType] = useState<CategoryType>(value?.categoryType || 'product');
  const [categories, setCategories] = useState<CategoryAggregation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch categories from API using ShopsService
  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const categories = await shopsService.getCategories({
          limit: 100,
          minProducts: 1,
        });
        setCategories(categories);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Filter categories by type and search query
  const filteredCategories = categories
    .filter(cat => cat.category_type === categoryType)
    .filter(cat => 
      searchQuery === '' || 
      cat.category_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => b.product_count - a.product_count);

  const handleCategoryTypeChange = (type: CategoryType) => {
    setCategoryType(type);
    // Clear selection when switching types
    onChange({
      categoryType: type
    });
  };

  const handleCategorySelect = (category: CategoryAggregation) => {
    if (categoryType === 'product') {
      onChange({
        productName: category.category_name,
        productSlug: category.category_slug,
        categoryType: 'product'
      });
    } else {
      onChange({
        shopCategoryName: category.category_name,
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
      <div className="max-h-64 overflow-y-auto space-y-1">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading categories...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {searchQuery ? 'No categories found' : 'No categories available'}
            </p>
          </div>
        ) : (
          filteredCategories.map((category) => {
            const isSelected = selectedCategoryName === category.category_name;
            
            return (
              <button
                key={`${category.category_type}-${category.category_slug}`}
                onClick={() => handleCategorySelect(category)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm
                  transition-colors text-left
                  ${isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                <span className="font-medium">{category.category_name}</span>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{category.product_count} products</span>
                  {category.shop_count > 0 && (
                    <span>{category.shop_count} shops</span>
                  )}
                </div>
              </button>
            );
          })
        )}
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
