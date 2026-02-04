/**
 * Shop Filters Component
 * Provides filtering options for shop directory
 */

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@mantine/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Filter, X, Search, MapPin, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHOP_CATEGORIES } from '@/constants/shop';

interface ShopFiltersProps {
  filters: {
    search: string;
    category: string;
    region: string;
    verified: boolean;
    active: boolean;
  };
  onFiltersChange: (filters: Partial<ShopFiltersProps['filters']>) => void;
  categories: Array<{
    id: string;
    name: string;
    count: number;
    color: string;
    icon: string;
  }>;
  className?: string;
}

export function ShopFilters({ filters, onFiltersChange, categories, className }: ShopFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSearchChange = (value: string) => {
    onFiltersChange({ search: value });
  };

  const handleCategoryChange = (value: string) => {
    onFiltersChange({ category: value });
  };

  const handleRegionChange = (value: string) => {
    onFiltersChange({ region: value });
  };

  const handleVerifiedToggle = () => {
    onFiltersChange({ verified: !filters.verified });
  };

  const handleActiveToggle = () => {
    onFiltersChange({ active: !filters.active });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      category: '',
      region: '',
      verified: false,
      active: true
    });
  };

  const hasActiveFilters = filters.search || filters.category || filters.region || filters.verified || !filters.active;

  const activeFilterCount = [
    filters.search,
    filters.category,
    filters.region,
    filters.verified ? 'verified' : null,
    !filters.active ? 'inactive' : null
  ].filter(Boolean).length;

  return (
    <Card className={cn('mb-6', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="info" className="text-xs">
                {activeFilterCount} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? '−' : '+'}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Shops
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name or description..."
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <Select
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((category) => ({
                  value: category.id,
                  label: `${category.icon} ${category.name} (${category.count})`
                }))
              ]}
            />
          </div>

          {/* Region Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Region
            </label>
            <Input
              placeholder="Enter city or region"
              value={filters.region}
              onChange={(e) => handleRegionChange(e.target.value)}
            />
          </div>

          {/* Status Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant={filters.verified ? 'default' : 'outline'}
                size="sm"
                onClick={handleVerifiedToggle}
                className={cn(
                  'flex items-center gap-2',
                  filters.verified && 'bg-green-100 text-green-800 border-green-200'
                )}
              >
                <CheckCircle className="w-4 h-4" />
                Verified Shops Only
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={filters.active ? 'default' : 'outline'}
                size="sm"
                onClick={handleActiveToggle}
                className={cn(
                  'flex items-center gap-2',
                  filters.active ? 'bg-green-100 text-green-800 border-green-200' : ''
                )}
              >
                <CheckCircle className="w-4 h-4" />
              Active Shops Only
              </Button>
            </div>
          </div>

          {/* Filter Summary */}
          {hasActiveFilters && (
            <div className="pt-4 border-t">
              <div className="flex flex-wrap gap-2">
                {filters.search && (
                  <Badge variant="default" className="flex items-center gap-1">
                    Search: "{filters.search}"
                    <button
                      onClick={() => handleSearchChange('')}
                      className="ml-1 text-xs hover:text-gray-700"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {filters.category && (
                  <Badge variant="default" className="flex items-center gap-1">
                    Category: {categories.find(c => c.id === filters.category)?.name}
                    <button
                      onClick={() => handleCategoryChange('')}
                      className="ml-1 text-xs hover:text-gray-700"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {filters.region && (
                  <Badge variant="default" className="flex items-center gap-1">
                    Region: "{filters.region}"
                    <button
                      onClick={() => handleRegionChange('')}
                      className="ml-1 text-xs hover:text-gray-700"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {filters.verified && (
                  <Badge variant="success" className="flex items-center gap-1">
                      Verified Only
                      <button
                        onClick={handleVerifiedToggle}
                        className="ml-1 text-xs hover:text-gray-700"
                      >
                        ×
                      </button>
                    </Badge>
                )}
                {!filters.active && (
                  <Badge variant="warning" className="flex items-center gap-1">
                      Active Only
                      <button
                        onClick={handleActiveToggle}
                        className="ml-1 text-xs hover:text-gray-700"
                      >
                        ×
                      </button>
                    </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
