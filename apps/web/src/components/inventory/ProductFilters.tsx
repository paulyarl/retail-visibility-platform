/**
 * Product Filters Component
 * 
 * Provides advanced filtering options for inventory:
 * - Category filtering
 * - Status filtering
 * - Price range filtering
 * - Stock level filtering
 * - Date range filtering
 * - Variant filtering
 * 
 * Shop management-inspired UX patterns
 */

'use client';

import { useState, useEffect } from 'react';
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

type CheckedState = CheckboxPrimitive.CheckedState;
import { 
  Filter, 
  X, 
  Calendar,
  DollarSign,
  Package,
  Star,
  StarOff,
  Image,
  ImageOff,
  Camera
} from 'lucide-react';

import { Button } from '@mantine/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';
import { Input } from '@/components/ui/Input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn-select';

interface ProductFiltersProps {
  tenantId: string;
  onFilterChange: () => void;
  onClose: () => void;
}

interface FilterState {
  categories: string[];
  statuses: string[];
  priceRange: [number, number];
  stockRange: [number, number];
  dateRange: {
    start: string;
    end: string;
  };
  hasVariants: boolean | null;
  featuring: {
    isFeatured: boolean | null;
    featuredStatus: 'active' | 'expired' | 'all';
    featuredPriority: [number, number];
    featuredBuckets: string[];
  };
  media: {
    hasImage: boolean | null;
    imageStatus: 'has_image' | 'no_image' | 'all';
    imageQuality: 'high' | 'medium' | 'low' | 'all';
    hasGallery: boolean | null;
    galleryCount: [number, number];
  };
}

const DEFAULT_FILTERS: FilterState = {
  categories: [],
  statuses: [],
  priceRange: [0, 10000],
  stockRange: [0, 1000],
  dateRange: {
    start: '',
    end: ''
  },
  hasVariants: null,
  featuring: {
    isFeatured: null,
    featuredStatus: 'all',
    featuredPriority: [0, 100],
    featuredBuckets: []
  },
  media: {
    hasImage: null,
    imageStatus: 'all',
    imageQuality: 'all',
    hasGallery: null,
    galleryCount: [0, 50]
  }
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'low_stock', label: 'Low Stock' }
];

export default function ProductFilters({ tenantId, onFilterChange, onClose }: ProductFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Mock categories - in real implementation, this would come from API
  const mockCategories = [
    { value: 'electronics', label: 'Electronics' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'food', label: 'Food & Beverage' },
    { value: 'books', label: 'Books' },
    { value: 'home', label: 'Home & Garden' },
    { value: 'sports', label: 'Sports & Outdoors' },
    { value: 'toys', label: 'Toys & Games' },
    { value: 'health', label: 'Health & Beauty' },
    { value: 'automotive', label: 'Automotive' },
    { value: 'other', label: 'Other' }
  ];

  // Mock buckets - in real implementation, this would come from API
  const mockBuckets = [
    { id: 'new-arrivals', name: 'New Arrivals' },
    { id: 'best-sellers', name: 'Best Sellers' },
    { id: 'featured', name: 'Featured Products' },
    { id: 'sale-items', name: 'Sale Items' },
    { id: 'seasonal', name: 'Seasonal' },
    { id: 'trending', name: 'Trending Now' },
    { id: 'staff-picks', name: 'Staff Picks' },
    { id: 'clearance', name: 'Clearance' }
  ];

  useState(() => {
    setCategories(mockCategories);
    setLoading(false);
  });

  const handleCategoryChange = (categoryValue: string, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      categories: checked
        ? [...prev.categories, categoryValue]
        : prev.categories.filter(c => c !== categoryValue)
    }));
  };

  const handleStatusChange = (statusValue: string, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      statuses: checked
        ? [...prev.statuses, statusValue]
        : prev.statuses.filter(s => s !== statusValue)
    }));
  };

  const handlePriceRangeChange = (value: number[]) => {
    setFilters(prev => ({
      ...prev,
      priceRange: value as [number, number]
    }));
  };

  const handleStockRangeChange = (value: number[]) => {
    setFilters(prev => ({
      ...prev,
      stockRange: value as [number, number]
    }));
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [field]: value
      }
    }));
  };

  const handleHasVariantsChange = (value: boolean | null) => {
    setFilters(prev => ({
      ...prev,
      hasVariants: value
    }));
  };

  // 🌟 Featuring Filter Handlers
  const handleFeaturingChange = (field: keyof FilterState['featuring'], value: any) => {
    setFilters(prev => ({
      ...prev,
      featuring: {
        ...prev.featuring,
        [field]: value
      }
    }));
  };

  const handleFeaturedStatusChange = (status: 'active' | 'expired' | 'all') => {
    handleFeaturingChange('featuredStatus', status);
  };

  const handleFeaturedPriorityChange = (value: number[]) => {
    handleFeaturingChange('featuredPriority', value as [number, number]);
  };

  const handleFeaturedBucketChange = (bucketId: string, checked: boolean) => {
    const currentBuckets = filters.featuring.featuredBuckets;
    const newBuckets = checked
      ? [...currentBuckets, bucketId]
      : currentBuckets.filter(id => id !== bucketId);
    
    handleFeaturingChange('featuredBuckets', newBuckets);
  };

  // 🖼️ Media Filter Handlers
  const handleMediaChange = (field: keyof FilterState['media'], value: any) => {
    setFilters(prev => ({
      ...prev,
      media: {
        ...prev.media,
        [field]: value
      }
    }));
  };

  const handleImageStatusChange = (status: 'has_image' | 'no_image' | 'all') => {
    handleMediaChange('imageStatus', status);
  };

  const handleImageQualityChange = (quality: 'high' | 'medium' | 'low' | 'all') => {
    handleMediaChange('imageQuality', quality);
  };

  const handleHasGalleryChange = (value: boolean | null) => {
    handleMediaChange('hasGallery', value);
  };

  const handleGalleryCountChange = (value: number[]) => {
    handleMediaChange('galleryCount', value);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const applyFilters = () => {
    // In real implementation, this would apply filters to the parent component
    // For now, we'll just call the onFilterChange callback
    onFilterChange();
    onClose();
  };

  const hasActiveFilters = () => {
    return (
      filters.categories.length > 0 ||
      filters.statuses.length > 0 ||
      filters.priceRange[0] > 0 ||
      filters.priceRange[1] < 10000 ||
      filters.stockRange[0] > 0 ||
      filters.stockRange[1] < 1000 ||
      filters.dateRange.start ||
      filters.dateRange.end ||
      filters.hasVariants !== null ||
      filters.featuring.isFeatured !== null ||
      filters.featuring.featuredStatus !== 'all' ||
      filters.featuring.featuredPriority[0] > 0 ||
      filters.featuring.featuredPriority[1] < 100 ||
      filters.featuring.featuredBuckets.length > 0 ||
      filters.media.hasImage !== null ||
      filters.media.imageStatus !== 'all' ||
      filters.media.imageQuality !== 'all' ||
      filters.media.hasGallery !== null ||
      filters.media.galleryCount[0] > 0 ||
      filters.media.galleryCount[1] < 50
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value / 100);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 10000) count++;
    if (filters.stockRange[0] > 0 || filters.stockRange[1] < 1000) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.hasVariants !== null) count++;
    if (filters.featuring.isFeatured !== null) count++;
    if (filters.featuring.featuredStatus !== 'all') count++;
    if (filters.featuring.featuredPriority[0] > 0 || filters.featuring.featuredPriority[1] < 100) count++;
    if (filters.featuring.featuredBuckets.length > 0) count++;
    if (filters.media.hasImage !== null) count++;
    if (filters.media.imageStatus !== 'all') count++;
    if (filters.media.imageQuality !== 'all') count++;
    if (filters.media.hasGallery !== null) count++;
    if (filters.media.galleryCount[0] > 0 || filters.media.galleryCount[1] < 50) count++;
    return count;
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Filter Products</CardTitle>
        <div className="flex items-center space-x-2">
          {hasActiveFilters() && (
            <Badge variant="default" className="text-xs">
              {getActiveFilterCount()} active
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear
          </Button>
          <Button onClick={onClose} size="sm">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Categories */}
        <div>
          <Label className="text-sm font-medium">Categories</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-2">
            {categories.map((category) => (
              <div key={category.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.value}`}
                  checked={filters.categories.includes(category.value)}
                  onCheckedChange={(checked: boolean) => handleCategoryChange(category.value, checked)}
                />
                <Label 
                  htmlFor={`category-${category.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {category.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <Label className="text-sm font-medium">Status</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {STATUS_OPTIONS.map((status) => (
              <div key={status.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status.value}`}
                  checked={filters.statuses.includes(status.value)}
                  onCheckedChange={(checked: boolean) => handleStatusChange(status.value, checked)}
                />
                <Label 
                  htmlFor={`status-${status.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {status.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <Label className="text-sm font-medium">
            Price Range: {formatCurrency(filters.priceRange[0])} - {formatCurrency(filters.priceRange[1])}
          </Label>
          <div className="mt-2">
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={filters.priceRange[0]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePriceRangeChange([parseInt(e.target.value) || 0, filters.priceRange[1]])}
                  className="w-24"
                  placeholder="Min"
                />
                <span>-</span>
                <Input
                  type="number"
                  value={filters.priceRange[1]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePriceRangeChange([filters.priceRange[0], parseInt(e.target.value) || 0])}
                  className="w-24"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stock Range */}
        <div>
          <Label className="text-sm font-medium">
            Stock Range: {filters.stockRange[0]} - {filters.stockRange[1]} units
          </Label>
          <div className="mt-2">
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={filters.stockRange[0]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStockRangeChange([parseInt(e.target.value) || 0, filters.stockRange[1]])}
                  className="w-24"
                  placeholder="Min"
                />
                <span>-</span>
                <Input
                  type="number"
                  value={filters.stockRange[1]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStockRangeChange([filters.stockRange[0], parseInt(e.target.value) || 0])}
                  className="w-24"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div>
          <Label className="text-sm font-medium">Date Range</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <Label htmlFor="date-start" className="text-xs text-gray-500">From</Label>
              <input
                id="date-start"
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <Label htmlFor="date-end" className="text-xs text-gray-500">To</Label>
              <input
                id="date-end"
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Has Variants */}
        <div>
          <Label className="text-sm font-medium">Product Variants</Label>
          <div className="flex items-center space-x-4 mt-2">
            <Checkbox
              id="has-variants-true"
              checked={filters.hasVariants === true}
              onCheckedChange={(checked: CheckedState) => handleHasVariantsChange(checked === 'indeterminate' ? null : checked)}
            />
            <Label htmlFor="has-variants-true" className="text-sm font-normal cursor-pointer">
              Has variants
            </Label>
            <Checkbox
              id="has-variants-false"
              checked={filters.hasVariants === false}
              onCheckedChange={(checked: CheckedState) => handleHasVariantsChange(checked === 'indeterminate' ? null : checked)}
            />
            <Label htmlFor="has-variants-false" className="text-sm font-normal cursor-pointer">
              No variants
            </Label>
            <Checkbox
              id="has-variants-all"
              checked={filters.hasVariants === null}
              onCheckedChange={() => handleHasVariantsChange(null)}
            />
            <Label htmlFor="has-variants-all" className="text-sm font-normal cursor-pointer">
              All products
            </Label>
          </div>
        </div>

        <Separator />

        {/* 🌟 Product Featuring */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-amber-600" />
            <Label className="text-sm font-medium">Product Featuring</Label>
          </div>

          {/* Featured Status */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Featured Status</Label>
            <div className="flex items-center space-x-4 mt-2">
              <Checkbox
                id="featured-true"
                checked={filters.featuring.isFeatured === true}
                onCheckedChange={(checked) => handleFeaturingChange('isFeatured', checked)}
              />
              <Label htmlFor="featured-true" className="text-sm font-normal cursor-pointer flex items-center space-x-1">
                <Star className="h-3 w-3 text-amber-500" />
                Featured only
              </Label>
              <Checkbox
                id="featured-false"
                checked={filters.featuring.isFeatured === false}
                onCheckedChange={(checked) => handleFeaturingChange('isFeatured', checked)}
              />
              <Label htmlFor="featured-false" className="text-sm font-normal cursor-pointer flex items-center space-x-1">
                <StarOff className="h-3 w-3 text-gray-400" />
                Not featured
              </Label>
              <Checkbox
                id="featured-all"
                checked={filters.featuring.isFeatured === null}
                onCheckedChange={() => handleFeaturingChange('isFeatured', null)}
              />
              <Label htmlFor="featured-all" className="text-sm font-normal cursor-pointer">
                All products
              </Label>
            </div>
          </div>

          {/* Featured Status Filter */}
          {filters.featuring.isFeatured === true && (
            <div>
              <Label className="text-sm font-medium">Featured Status Filter</Label>
              <Select
                value={filters.featuring.featuredStatus}
                onValueChange={handleFeaturedStatusChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All featured products</SelectItem>
                  <SelectItem value="active">Active featured only</SelectItem>
                  <SelectItem value="expired">Expired featured only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Featured Priority */}
          {filters.featuring.isFeatured === true && (
            <div>
              <Label className="text-sm font-medium">
                Featured Priority: {filters.featuring.featuredPriority[0]} - {filters.featuring.featuredPriority[1]}
              </Label>
              <div className="mt-2">
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={filters.featuring.featuredPriority[0]}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFeaturedPriorityChange([parseInt(e.target.value) || 0, filters.featuring.featuredPriority[1]])}
                      className="w-24"
                      placeholder="Min"
                    />
                    <span>-</span>
                    <Input
                      type="number"
                      value={filters.featuring.featuredPriority[1]}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFeaturedPriorityChange([filters.featuring.featuredPriority[0], parseInt(e.target.value) || 0])}
                      className="w-24"
                      placeholder="Max"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low priority</span>
                  <span>High priority</span>
                </div>
              </div>
            </div>
          )}

          {/* Featured Buckets */}
          {filters.featuring.isFeatured === true && (
            <div>
              <Label className="text-sm font-medium">Featured Buckets</Label>
              <p className="text-xs text-gray-500 mb-2">
                Select which storefront buckets to include
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {mockBuckets.map((bucket) => (
                  <div key={bucket.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bucket-${bucket.id}`}
                      checked={filters.featuring.featuredBuckets.includes(bucket.id)}
                      onCheckedChange={(checked: CheckedState) => handleFeaturedBucketChange(bucket.id, checked === 'indeterminate' ? false : checked)}
                    />
                    <Label htmlFor={`bucket-${bucket.id}`} className="text-sm cursor-pointer">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-amber-100 rounded-full"></div>
                        {bucket.name}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

  {/* Featured Buckets */}
  {filters.featuring.isFeatured === true && (
    <div>
      <Label className="text-sm font-medium">Featured Buckets</Label>
      <p className="text-xs text-gray-500 mb-2">
        Select which storefront buckets to include
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {mockBuckets.map((bucket) => (
          <div key={bucket.id} className="flex items-center space-x-2">
            <Checkbox
              id={`bucket-${bucket.id}`}
              checked={filters.featuring.featuredBuckets.includes(bucket.id)}
              onCheckedChange={(checked: CheckedState) => handleFeaturedBucketChange(bucket.id, checked === 'indeterminate' ? false : checked)}
            />
            <Label htmlFor={`bucket-${bucket.id}`} className="text-sm cursor-pointer">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-amber-100 rounded-full"></div>
                {bucket.name}
              </div>
            </Label>
          </div>
        ))}
      </div>
    </div>
  )}
</div>

<Separator />

{/* 🖼️ Product Media */}
<div className="space-y-4">
  <div className="flex items-center space-x-2">
    <Camera className="h-4 w-4 text-blue-600" />
    <Label className="text-sm font-medium">Product Media</Label>
  </div>

  {/* Image Status */}
  <div className="space-y-3">
    <Label className="text-sm font-medium">Image Status</Label>
    <div className="flex items-center space-x-4 mt-2">
      <Checkbox
        id="has-image-true"
        checked={filters.media.hasImage === true}
        onCheckedChange={(checked) => handleMediaChange('hasImage', checked)}
      />
      <Label htmlFor="has-image-true" className="text-sm font-normal cursor-pointer flex items-center space-x-1">
        <Image className="h-3 w-3 text-green-500" />
        Has image
      </Label>
      <Checkbox
        id="has-image-false"
        checked={filters.media.hasImage === false}
        onCheckedChange={(checked) => handleMediaChange('hasImage', checked)}
      />
      <Label htmlFor="has-image-false" className="text-sm font-normal cursor-pointer flex items-center space-x-1">
        <ImageOff className="h-3 w-3 text-gray-400" />
        No image
      </Label>
      <Checkbox
        id="has-image-all"
        checked={filters.media.hasImage === null}
        onCheckedChange={() => handleMediaChange('hasImage', null)}
      />
      <Label htmlFor="has-image-all" className="text-sm font-normal cursor-pointer">
        All products
      </Label>
    </div>
  </div>

  {/* Image Quality */}
  {filters.media.hasImage === true && (
    <div>
      <Label className="text-sm font-medium">Image Quality</Label>
      <Select
        value={filters.media.imageQuality}
        onValueChange={handleImageQualityChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select quality" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All qualities</SelectItem>
          <SelectItem value="high">High quality only</SelectItem>
          <SelectItem value="medium">Medium quality only</SelectItem>
          <SelectItem value="low">Low quality only</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )}

  {/* Gallery Status */}
  <div className="space-y-3">
    <Label className="text-sm font-medium">Gallery Images</Label>
    <div className="flex items-center space-x-4 mt-2">
      <Checkbox
        id="has-gallery-true"
        checked={filters.media.hasGallery === true}
        onCheckedChange={(checked: CheckedState) => handleHasGalleryChange(checked === 'indeterminate' ? null : checked)}
      />
      <Label htmlFor="has-gallery-true" className="text-sm font-normal cursor-pointer flex items-center space-x-1">
        <Camera className="h-3 w-3 text-blue-500" />
        Has gallery
      </Label>
      <Checkbox
        id="has-gallery-false"
        checked={filters.media.hasGallery === false}
        onCheckedChange={(checked: CheckedState) => handleHasGalleryChange(checked === 'indeterminate' ? null : checked)}
      />
      <Label htmlFor="has-gallery-false" className="text-sm font-normal cursor-pointer flex items-center space-x-1">
        <ImageOff className="h-3 w-3 text-gray-400" />
        No gallery
      </Label>
      <Checkbox
        id="has-gallery-all"
        checked={filters.media.hasGallery === null}
        onCheckedChange={() => handleHasGalleryChange(null)}
      />
      <Label htmlFor="has-gallery-all" className="text-sm font-normal cursor-pointer">
        All products
      </Label>
    </div>
  </div>

  {/* Gallery Count */}
  {filters.media.hasGallery === true && (
    <div>
      <Label className="text-sm font-medium">
        Gallery Count: {filters.media.galleryCount[0]} - {filters.media.galleryCount[1]} images
      </Label>
      <div className="mt-2">
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={filters.media.galleryCount[0]}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleGalleryCountChange([parseInt(e.target.value) || 0, filters.media.galleryCount[1]])}
            className="w-24"
            placeholder="Min"
          />
          <span>-</span>
          <Input
            type="number"
            value={filters.media.galleryCount[1]}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleGalleryCountChange([filters.media.galleryCount[0], parseInt(e.target.value) || 0])}
            className="w-24"
            placeholder="Max"
          />
        </div>
      </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Min images</span>
          <span>Max images</span>
          </div>
      </div>
    </div>
  )}

  {/* Apply Button */}
  <div className="flex justify-end pt-4 border-t">
    <Button onClick={applyFilters} className="w-full md:w-auto" variant='gradient' style={{ color: 'white' }}>
      Apply Filters
    </Button>
  </div>
</div>
</CardContent>
</Card>
  );
}
