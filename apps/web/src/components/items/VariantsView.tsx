/**
 * Variants View Component
 * 
 * Beautiful, comprehensive display of product variants on item detail page
 * Features:
 * - Variant cards with images, prices, and attributes
 * - Attribute filtering and search
 * - Stock status indicators
 * - Price range display
 * - Responsive grid layout
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, Badge, Button, Input } from '@/components/ui';
import { 
  Package, 
  Search, 
  Filter, 
  X, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  Box,
  Tag
} from 'lucide-react';
import { Item, ProductVariant } from '@/services/itemsDataService';

interface VariantsViewProps {
  item: Item;
  onEditVariant?: (variant: any) => void;
  onAddVariant?: () => void;
}

export default function VariantsView({ item, onEditVariant, onAddVariant }: VariantsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  // Check if item has variants
  if (!item.has_variants || !item.variants || item.variants.length === 0) {
    return null;
  }

  const variants = item.variants;

  // Extract all unique attribute types and values
  const attributeFilters = useMemo(() => {
    const filters: Record<string, Set<string>> = {};
    variants.forEach((variant: ProductVariant) => {
      if (variant.attributes && typeof variant.attributes === 'object') {
        Object.entries(variant.attributes).forEach(([key, value]) => {
          if (!filters[key]) {
            filters[key] = new Set();
          }
          if (value) filters[key].add(String(value));
        });
      }
    });
    return filters;
  }, [variants]);

  // Filter variants based on search and selected attributes
  const filteredVariants = useMemo(() => {
    return variants.filter((variant: ProductVariant) => {
      // Search filter
      const searchMatch = searchTerm === '' || 
        variant.variant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        variant.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        Object.values(variant.attributes || {}).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );

      // Attribute filter
      const attributeMatch = Object.entries(selectedAttributes).every(([key, value]) => {
        return !value || variant.attributes?.[key] === value;
      });

      return searchMatch && attributeMatch;
    });
  }, [variants, searchTerm, selectedAttributes]);

  // Clear attribute filter
  const clearAttributeFilter = (attributeType: string) => {
    const newFilters = { ...selectedAttributes };
    delete newFilters[attributeType];
    setSelectedAttributes(newFilters);
  };

  // Get stock status
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { status: 'out', color: 'text-red-600 bg-red-50', label: 'Out of Stock', icon: AlertCircle };
    if (stock < 5) return { status: 'low', color: 'text-orange-600 bg-orange-50', label: 'Low Stock', icon: AlertCircle };
    return { status: 'good', color: 'text-green-600 bg-green-50', label: 'In Stock', icon: CheckCircle };
  };

  // Calculate price statistics
  const priceStats = useMemo(() => {
    const prices = variants.map((v: ProductVariant) => v.price_cents).filter((p: number) => p > 0);
    if (prices.length === 0) return null;
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const hasRange = min !== max;
    
    return {
      min: min / 100,
      max: max / 100,
      hasRange,
      display: hasRange ? `$${min/100} - $${max/100}` : `$${min/100}`
    };
  }, [variants]);

  return (
    <Card data-section="variants">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Product Variants
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {variants.length} variant{variants.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {priceStats && (
              <div className="text-right mr-4">
                <p className="text-sm text-neutral-500">Price Range</p>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {priceStats.display}
                </p>
              </div>
            )}
            {onAddVariant && (
              <Button onClick={onAddVariant} size="sm">
                <Package className="w-4 h-4 mr-1" />
                Add Variant
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Search variants by name, SKU, or attributes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Attribute Filters */}
          {Object.entries(selectedAttributes).length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-neutral-500">Filters:</span>
              {Object.entries(selectedAttributes).map(([attrType, value]) => (
                <Badge
                  key={attrType}
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200"
                >
                  {attrType}: {value}
                  <button
                    onClick={() => clearAttributeFilter(attrType)}
                    className="ml-1 hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAttributes({})}
                className="text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Attribute Type Filters */}
        {Object.entries(attributeFilters).length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <Filter className="w-4 h-4" />
              Filter by attributes:
            </div>
            <div className="space-y-2">
              {Object.entries(attributeFilters).map(([attrType, values]) => (
                <div key={attrType} className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize w-20">{attrType}:</span>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant={!selectedAttributes[attrType] ? "default" : "outline"}
                      size="sm"
                      onClick={() => clearAttributeFilter(attrType)}
                      className="text-xs"
                    >
                      All
                    </Button>
                    {Array.from(values).map(value => (
                      <Button
                        key={value}
                        variant={selectedAttributes[attrType] === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedAttributes(prev => ({
                          ...prev,
                          [attrType]: value
                        }))}
                        className="text-xs"
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Variants Grid */}
        {filteredVariants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVariants.map((variant: ProductVariant) => {
              const stockStatus = getStockStatus(variant.stock || 0);
              const StatusIcon = stockStatus.icon;
              
              return (
                <Card key={variant.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    {/* Variant Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-neutral-900 dark:text-white mb-1">
                          {variant.variant_name || `Variant ${variant.sort_order + 1}`}
                        </h3>
                        <p className="text-sm text-neutral-500 font-mono">{variant.sku}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <StatusIcon className={`w-4 h-4 ${stockStatus.color.split(' ')[0]}`} />
                      </div>
                    </div>

                    {/* Variant Image */}
                    {variant.image_url && (
                      <div className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden mb-3">
                        <img
                          src={variant.image_url}
                          alt={variant.variant_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-neutral-400" />
                        <span className="font-bold text-lg text-neutral-900 dark:text-white">
                          ${(variant.price_cents || 0) / 100}
                        </span>
                      </div>
                      <Badge className={stockStatus.color}>
                        {stockStatus.label}
                      </Badge>
                    </div>

                    {/* Attributes */}
                    {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                      <div className="space-y-2 mb-3">
                        {Object.entries(variant.attributes).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <Tag className="w-3 h-3 text-neutral-400" />
                            <span className="text-sm font-medium capitalize text-neutral-600 dark:text-neutral-400">
                              {key}:
                            </span>
                            <span className="text-sm text-neutral-900 dark:text-white">
                              {String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stock */}
                    <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center gap-1">
                        <Box className="w-4 h-4 text-neutral-400" />
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          Stock: {variant.stock || 0}
                        </span>
                      </div>
                      {onEditVariant && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditVariant(variant)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
              <Search className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
              No variants found
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400">
              Try adjusting your search or filters
            </p>
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                {variants.length}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Total Variants
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {variants.filter((v: ProductVariant) => (v.stock || 0) > 0).length}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                In Stock
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {variants.filter((v: ProductVariant) => (v.stock || 0) > 0 && (v.stock || 0) < 5).length}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Low Stock
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {variants.filter((v: ProductVariant) => (v.stock || 0) === 0).length}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Out of Stock
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
