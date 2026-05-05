/**
 * Advanced Search & Filtering Component
 * 
 * Advanced search and filtering with:
 * - Advanced search with multiple criteria
 * - Filter by status, category, price range, stock level
 * - Sort by name, price, stock, created date, last modified
 * - Saved filter presets
 * - Search result highlighting
 * - Filter count badges
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button, Input, Badge, Tooltip } from '@/components/ui';
import { 
  Search, 
  Filter, 
  X, 
  Save, 
  ChevronDown, 
  ChevronUp,
  SlidersHorizontal,
  Star,
  Clock,
  TrendingUp,
  Package
} from 'lucide-react';

interface AdvancedSearchProps {
  onSearch: (query: string, filters: SearchFilters, sort: SortOption) => void;
  onFiltersChange: (filters: SearchFilters) => void;
  onSortChange: (sort: SortOption) => void;
  totalItems: number;
  loading?: boolean;
}

interface SearchFilters {
  query: string;
  status: 'all' | 'active' | 'inactive' | 'archived' | 'trashed';
  category: string | null;
  subcategory: string | null;
  priceRange: {
    min: number | null;
    max: number | null;
  };
  stockLevel: 'all' | 'inStock' | 'lowStock' | 'outOfStock';
  hasPhotos: 'all' | 'with' | 'without';
  dateRange: {
    createdAfter: string | null;
    createdBefore: string | null;
    updatedAfter: string | null;
    updatedBefore: string | null;
  };
  tags: string[];
}

interface SortOption {
  field: 'name' | 'price' | 'stock' | 'createdAt' | 'updatedAt' | 'views' | 'sales';
  direction: 'asc' | 'desc';
}

interface FilterPreset {
  id: string;
  name: string;
  filters: SearchFilters;
  sort: SortOption;
  icon?: React.ReactNode;
}

/**
 * Advanced Search & Filtering System
 */
export default function AdvancedSearch({
  onSearch,
  onFiltersChange,
  onSortChange,
  totalItems,
  loading = false,
}: AdvancedSearchProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({
    query: '',
    status: 'all',
    category: null,
    subcategory: null,
    priceRange: { min: null, max: null },
    stockLevel: 'all',
    hasPhotos: 'all',
    dateRange: {
      createdAfter: null,
      createdBefore: null,
      updatedAfter: null,
      updatedBefore: null,
    },
    tags: [],
  });
  const [currentSort, setCurrentSort] = useState<SortOption>({
    field: 'name',
    direction: 'asc',
  });
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    {
      id: 'active-products',
      name: 'Active Products',
      filters: { ...activeFilters, status: 'active' },
      sort: { field: 'name', direction: 'asc' },
      icon: <Package className="w-4 h-4" />,
    },
    {
      id: 'low-stock',
      name: 'Low Stock',
      filters: { ...activeFilters, stockLevel: 'lowStock' },
      sort: { field: 'stock', direction: 'asc' },
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: 'recently-added',
      name: 'Recently Added',
      filters: { ...activeFilters },
      sort: { field: 'createdAt', direction: 'desc' },
      icon: <Clock className="w-4 h-4" />,
    },
  ]);

  // Count active filters
  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (activeFilters.query) count++;
    if (activeFilters.status !== 'all') count++;
    if (activeFilters.category) count++;
    if (activeFilters.subcategory) count++;
    if (activeFilters.priceRange.min !== null || activeFilters.priceRange.max !== null) count++;
    if (activeFilters.stockLevel !== 'all') count++;
    if (activeFilters.hasPhotos !== 'all') count++;
    if (activeFilters.dateRange.createdAfter || activeFilters.dateRange.createdBefore ||
        activeFilters.dateRange.updatedAfter || activeFilters.dateRange.updatedBefore) count++;
    if (activeFilters.tags.length > 0) count++;
    return count;
  }, [activeFilters]);

  // Handle search
  const handleSearch = useCallback(() => {
    onSearch(activeFilters.query, activeFilters, currentSort);
  }, [activeFilters, currentSort, onSearch]);

  // Handle filter changes
  const handleFilterChange = useCallback((updates: Partial<SearchFilters>) => {
    const newFilters = { ...activeFilters, ...updates };
    setActiveFilters(newFilters);
    onFiltersChange(newFilters);
  }, [activeFilters, onFiltersChange]);

  // Handle sort changes
  const handleSortChange = useCallback((field: SortOption['field']) => {
    const newDirection: 'asc' | 'desc' = currentSort.field === field && currentSort.direction === 'asc' ? 'desc' : 'asc';
    const newSort = { field, direction: newDirection };
    setCurrentSort(newSort);
    onSortChange(newSort);
  }, [currentSort, onSortChange]);

  // Apply preset
  const applyPreset = useCallback((preset: FilterPreset) => {
    setActiveFilters(preset.filters);
    setCurrentSort(preset.sort);
    onFiltersChange(preset.filters);
    onSortChange(preset.sort);
  }, [onFiltersChange, onSortChange]);

  // Save current as preset
  const saveAsPreset = useCallback(() => {
    const name = prompt('Enter preset name:');
    if (!name) return;

    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      name,
      filters: activeFilters,
      sort: currentSort,
      icon: <Star className="w-4 h-4" />,
    };

    setSavedPresets(prev => [...prev, newPreset]);
  }, [activeFilters, currentSort]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const clearedFilters: SearchFilters = {
      query: '',
      status: 'all',
      category: null,
      subcategory: null,
      priceRange: { min: null, max: null },
      stockLevel: 'all',
      hasPhotos: 'all',
      dateRange: {
        createdAfter: null,
        createdBefore: null,
        updatedAfter: null,
        updatedBefore: null,
      },
      tags: [],
    };
    setActiveFilters(clearedFilters);
    setCurrentSort({ field: 'name', direction: 'asc' });
    onFiltersChange(clearedFilters);
    onSortChange({ field: 'name', direction: 'asc' });
  }, [onFiltersChange, onSortChange]);

  // Get sort label
  const getSortLabel = (sort: SortOption) => {
    const fieldLabels = {
      name: 'Name',
      price: 'Price',
      stock: 'Stock',
      createdAt: 'Created',
      updatedAt: 'Updated',
      views: 'Views',
      sales: 'Sales',
    };
    return `${fieldLabels[sort.field]} ${sort.direction === 'asc' ? '↑' : '↓'}`;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
      {/* Main Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search products by name, SKU, description, or tags..."
              value={activeFilters.query}
              onChange={(e) => handleFilterChange({ query: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 pr-12"
            />
            {activeFilters.query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFilterChange({ query: '' })}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSearch} disabled={loading} className="bg-primary-600 hover:bg-primary-700">
            {loading ? 'Searching...' : 'Search'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="relative"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge variant="info" className="ml-1 h-5 px-1 text-xs">
                {activeFilterCount}
              </Badge>
            )}
            {showAdvanced ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400 self-center">Quick presets:</span>
        {savedPresets.map((preset) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset)}
            className="h-7"
          >
            {preset.icon && <span className="mr-1">{preset.icon}</span>}
            {preset.name}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={saveAsPreset}
          className="h-7 text-gray-500"
        >
          <Save className="w-3 h-3 mr-1" />
          Save Current
        </Button>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={activeFilters.status}
                onChange={(e) => handleFilterChange({ status: e.target.value as SearchFilters['status'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
                <option value="trashed">Trashed</option>
              </select>
            </div>

            {/* Stock Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stock Level
              </label>
              <select
                value={activeFilters.stockLevel}
                onChange={(e) => handleFilterChange({ stockLevel: e.target.value as SearchFilters['stockLevel'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="all">All Stock Levels</option>
                <option value="inStock">In Stock</option>
                <option value="lowStock">Low Stock</option>
                <option value="outOfStock">Out of Stock</option>
              </select>
            </div>

            {/* Has Photos Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Photos
              </label>
              <select
                value={activeFilters.hasPhotos}
                onChange={(e) => handleFilterChange({ hasPhotos: e.target.value as SearchFilters['hasPhotos'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="all">All Products</option>
                <option value="with">With Photos</option>
                <option value="without">Without Photos</option>
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Price Range
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={activeFilters.priceRange.min || ''}
                  onChange={(e) => handleFilterChange({
                    priceRange: { ...activeFilters.priceRange, min: e.target.value ? parseFloat(e.target.value) : null }
                  })}
                  className="w-full"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={activeFilters.priceRange.max || ''}
                  onChange={(e) => handleFilterChange({
                    priceRange: { ...activeFilters.priceRange, max: e.target.value ? parseFloat(e.target.value) : null }
                  })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Sort Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort By
              </label>
              <div className="flex flex-wrap gap-2">
                {(['name', 'price', 'stock', 'createdAt', 'updatedAt'] as const).map((field) => (
                  <Button
                    key={field}
                    variant={currentSort.field === field ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSortChange(field)}
                    className="h-7"
                  >
                    {field === 'name' ? 'Name' :
                     field === 'price' ? 'Price' :
                     field === 'stock' ? 'Stock' :
                     field === 'createdAt' ? 'Created' : 'Updated'}
                    {currentSort.field === field && (
                      <span className="ml-1">{currentSort.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Created Date
              </label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  placeholder="After"
                  value={activeFilters.dateRange.createdAfter || ''}
                  onChange={(e) => handleFilterChange({
                    dateRange: { ...activeFilters.dateRange, createdAfter: e.target.value }
                  })}
                  className="w-full"
                />
                <Input
                  type="date"
                  placeholder="Before"
                  value={activeFilters.dateRange.createdBefore || ''}
                  onChange={(e) => handleFilterChange({
                    dateRange: { ...activeFilters.dateRange, createdBefore: e.target.value }
                  })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {totalItems} products found
              {activeFilterCount > 0 && ` with ${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}`}
            </div>
            
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="w-3 h-3 mr-1" />
                  Clear All
                </Button>
              )}
              <Button onClick={handleSearch} disabled={loading} variant='gradient' style={{ color: 'white' }}>
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
