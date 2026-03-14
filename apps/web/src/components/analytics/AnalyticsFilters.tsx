/**
 * Analytics Filters Component
 * Provides filtering options for analytics data
 */

'use client';

import { useState } from 'react';
import { Calendar, Filter, ChevronDown, X } from 'lucide-react';

interface AnalyticsFiltersProps {
  initialFilters: {
    period?: string;
    startDate?: string;
    endDate?: string;
    pageType?: string;
    entityType?: string;
    region?: string;
  };
  onFiltersChange?: (filters: FilterOptions) => void;
}

interface FilterOptions {
  period: string;
  startDate: string;
  endDate: string;
  pageType: string;
  entityType: string;
  region: string;
}

export default function AnalyticsFilters({ initialFilters, onFiltersChange }: AnalyticsFiltersProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    period: initialFilters.period || 'week',
    startDate: initialFilters.startDate || '',
    endDate: initialFilters.endDate || '',
    pageType: initialFilters.pageType || 'all',
    entityType: initialFilters.entityType || 'all',
    region: initialFilters.region || 'all'
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const periodOptions = [
    { value: 'day', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last Quarter' },
    { value: 'year', label: 'Last Year' }
  ];

  const pageTypeOptions = [
    { value: 'all', label: 'All Pages' },
    { value: 'shop_directory', label: 'Shops Directory' },
    { value: 'storefront', label: 'Storefronts' },
    { value: 'directory', label: 'Directory' },
    { value: 'product_detail', label: 'Product Pages' },
    { value: 'search', label: 'Search Results' }
  ];

  const entityTypeOptions = [
    { value: 'all', label: 'All Entities' },
    { value: 'store', label: 'Stores' },
    { value: 'product', label: 'Products' },
    { value: 'category', label: 'Categories' },
    { value: 'user', label: 'Users' }
  ];

  const regionOptions = [
    { value: 'all', label: 'All Regions' },
    { value: 'north_america', label: 'North America' },
    { value: 'europe', label: 'Europe' },
    { value: 'asia', label: 'Asia' },
    { value: 'australia', label: 'Australia' },
    { value: 'south_america', label: 'South America' },
    { value: 'africa', label: 'Africa' }
  ];

  const updateFilter = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      onFiltersChange?.(newFilters);
      return newFilters;
    });
  };

  const clearFilters = () => {
    setFilters({
      period: 'week',
      startDate: '',
      endDate: '',
      pageType: 'all',
      entityType: 'all',
      region: 'all'
    });
  };

  const hasActiveFilters = filters.pageType !== 'all' || 
                          filters.entityType !== 'all' || 
                          filters.region !== 'all' ||
                          filters.startDate !== '' ||
                          filters.endDate !== '';

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Period:</label>
          <select
            value={filters.period}
            onChange={(e) => updateFilter('period', e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {periodOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
            hasActiveFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Advanced Filters
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs px-1.5 rounded-full">
              {[filters.pageType, filters.entityType, filters.region, filters.startDate, filters.endDate].filter(f => f !== 'all' && f !== '').length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <X className="w-4 h-4" />
          Clear Filters
        </button>
      )}

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => updateFilter('startDate', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Start date"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => updateFilter('endDate', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="End date"
                />
              </div>
            </div>

            {/* Page Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Page Type</label>
              <select
                value={filters.pageType}
                onChange={(e) => updateFilter('pageType', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {pageTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
              <select
                value={filters.entityType}
                onChange={(e) => updateFilter('entityType', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {entityTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Region Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
              <select
                value={filters.region}
                onChange={(e) => updateFilter('region', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {regionOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Apply Button */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setShowAdvanced(false);
                  onFiltersChange?.(filters);
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
