/**
 * Quick Actions Section Component
 * 
 * Shop management-inspired quick actions with:
 * - Bulk selection with "select all" functionality
 * - Bulk operations toolbar
 * - Quick add new product button
 * - Import/export buttons
 * - Filter and sort controls
 * - Search bar with advanced options
 */

'use client';

import { useState, useCallback } from 'react';
import { Button, Input, Badge, Tooltip } from '@/components/ui';
import { 
  Search, 
  Filter, 
  Plus, 
  Upload, 
  Download, 
  CheckSquare, 
  Square, 
  MoreHorizontal,
  Grid3X3,
  List,
  ArrowUpDown,
  ChevronDown
} from 'lucide-react';

interface QuickActionsProps {
  totalItems: number;
  selectedCount: number;
  bulkMode: boolean;
  onToggleBulkMode: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkEdit: () => void;
  onBulkExport: () => void;
  onBulkImport: () => void;
  onCreateItem: () => void;
  onSearch: (query: string) => void;
  onFilter: (filters: ItemFilters) => void;
  onSort: (sort: SortOption) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  loading?: boolean;
}

interface ItemFilters {
  status: 'all' | 'active' | 'inactive' | 'archived';
  category: string | null;
  stockLevel: 'all' | 'inStock' | 'lowStock' | 'outOfStock';
  priceRange: 'all' | 'free' | 'paid' | 'premium';
}

interface SortOption {
  field: 'name' | 'price' | 'stock' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}

/**
 * Quick Actions Section with bulk operations and search
 */
export default function QuickActions({
  totalItems,
  selectedCount,
  bulkMode,
  onToggleBulkMode,
  onSelectAll,
  onClearSelection,
  onBulkDelete,
  onBulkEdit,
  onBulkExport,
  onBulkImport,
  onCreateItem,
  onSearch,
  onFilter,
  onSort,
  viewMode,
  onViewModeChange,
  loading = false,
}: QuickActionsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<ItemFilters>({
    status: 'all',
    category: null,
    stockLevel: 'all',
    priceRange: 'all',
  });
  const [currentSort, setCurrentSort] = useState<SortOption>({
    field: 'name',
    direction: 'asc',
  });

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // Simple debounce - in production use proper debounce hook
    const timeoutId = setTimeout(() => {
      onSearch(query);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [onSearch]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<ItemFilters>) => {
    const updatedFilters = { ...currentFilters, ...newFilters };
    setCurrentFilters(updatedFilters);
    onFilter(updatedFilters);
  }, [currentFilters, onFilter]);

  // Handle sort changes
  const handleSortChange = useCallback((field: SortOption['field']) => {
    const newDirection: 'asc' | 'desc' = currentSort.field === field && currentSort.direction === 'asc' ? 'desc' : 'asc';
    const newSort = { field, direction: newDirection };
    setCurrentSort(newSort);
    onSort(newSort);
  }, [currentSort, onSort]);

  // Get sort label
  const getSortLabel = (sort: SortOption) => {
    const fieldLabels = {
      name: 'Name',
      price: 'Price',
      stock: 'Stock',
      createdAt: 'Created',
      updatedAt: 'Updated',
    };
    return `${fieldLabels[sort.field]} ${sort.direction === 'asc' ? '↑' : '↓'}`;
  };

  // Count active filters
  const activeFilterCount = Object.values(currentFilters).filter(
    value => value !== 'all' && value !== null
  ).length;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
      {/* Top Row - Search and Primary Actions */}
      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        {/* Search Bar */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search products by name, SKU, or description..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4"
            />
          </div>
        </div>

        {/* Primary Actions */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => onViewModeChange('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => onViewModeChange('list')}
              className="h-8 w-8 p-0"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          {/* Create New Item */}
          <Button
            onClick={onCreateItem}
            className="bg-primary-600 hover:bg-primary-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Product
          </Button>

          {/* Bulk Mode Toggle */}
          <Button
            variant={bulkMode ? 'default' : 'outline'}
            onClick={onToggleBulkMode}
            className="relative"
          >
            {bulkMode ? (
              <>
                <CheckSquare className="w-4 h-4 mr-2" />
                Bulk Mode ({selectedCount})
              </>
            ) : (
              <>
                <Square className="w-4 h-4 mr-2" />
                Select
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Second Row - Filters and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Filters Section */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              const statuses: ItemFilters['status'][] = ['all', 'active', 'inactive', 'archived'];
              const currentIndex = statuses.indexOf(currentFilters.status);
              const nextStatus = statuses[(currentIndex + 1) % statuses.length];
              handleFilterChange({ status: nextStatus });
            }}
          >
            <Filter className="w-3 h-3 mr-1" />
            Status: {currentFilters.status.charAt(0).toUpperCase() + currentFilters.status.slice(1)}
            {currentFilters.status !== 'all' && (
              <Badge variant="info" className="ml-1 h-4 px-1 text-xs">
                1
              </Badge>
            )}
          </Button>

          {/* Stock Level Filter */}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              const stockLevels: ItemFilters['stockLevel'][] = ['all', 'inStock', 'lowStock', 'outOfStock'];
              const currentIndex = stockLevels.indexOf(currentFilters.stockLevel);
              const nextLevel = stockLevels[(currentIndex + 1) % stockLevels.length];
              handleFilterChange({ stockLevel: nextLevel });
            }}
          >
            Stock: {currentFilters.stockLevel === 'all' ? 'All' : 
                   currentFilters.stockLevel === 'inStock' ? 'In Stock' :
                   currentFilters.stockLevel === 'lowStock' ? 'Low Stock' : 'Out of Stock'}
            {currentFilters.stockLevel !== 'all' && (
              <Badge variant="info" className="ml-1 h-4 px-1 text-xs">
                1
              </Badge>
            )}
          </Button>

          {/* Sort */}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              const fields: SortOption['field'][] = ['name', 'price', 'stock', 'createdAt', 'updatedAt'];
              const currentIndex = fields.indexOf(currentSort.field);
              const nextField = fields[(currentIndex + 1) % fields.length];
              handleSortChange(nextField);
            }}
          >
            <ArrowUpDown className="w-3 h-3 mr-1" />
            {getSortLabel(currentSort)}
          </Button>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleFilterChange({
                status: 'all',
                category: null,
                stockLevel: 'all',
                priceRange: 'all',
              })}
              className="h-8 text-gray-500"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Secondary Actions */}
        <div className="flex items-center gap-2">
          <Tooltip content="Import products from CSV">
            <Button variant="outline" size="sm" onClick={onBulkImport} className="h-8">
              <Upload className="w-3 h-3 mr-1" />
              Import
            </Button>
          </Tooltip>

          <Tooltip content="Export selected products">
            <Button variant="outline" size="sm" onClick={onBulkExport} className="h-8">
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Bulk Actions Toolbar - Only show when bulk mode is active */}
      {bulkMode && (
        <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {selectedCount} of {totalItems} selected
              </span>

              {/* Selection Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSelectAll}
                  disabled={selectedCount === totalItems}
                  className="h-7"
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClearSelection}
                  disabled={selectedCount === 0}
                  className="h-7"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Bulk Operations */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkEdit}
                disabled={selectedCount === 0}
                className="h-7"
              >
                Edit Selected
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkExport}
                disabled={selectedCount === 0}
                className="h-7"
              >
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={onBulkDelete}
                disabled={selectedCount === 0}
                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Delete Selected
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        Showing {totalItems} products
        {searchQuery && ` matching "${searchQuery}"`}
        {activeFilterCount > 0 && ` with ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
