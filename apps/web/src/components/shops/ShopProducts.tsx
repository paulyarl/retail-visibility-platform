'use client';

import { useState, useEffect } from 'react';
import { shopsService, type ShopProduct, type ShopFilters } from '@/services/ShopsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@mantine/core';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  ChevronLeft, 
  ChevronRight,
  ShoppingCart,
  Heart,
  Star,
  Package
} from 'lucide-react';
import Image from 'next/image';

interface ShopProductsProps {
  tenantId: string;
  filters: ShopFilters;
  onFilterChange: (filters: Partial<ShopFilters>) => void;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function ShopProducts({
  tenantId,
  filters,
  onFilterChange,
  onPageChange,
  isLoading,
  setIsLoading
}: ShopProductsProps) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, [filters, tenantId]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const result = await shopsService.getShopProducts(tenantId, filters);
      setProducts(result.products);
      setTotalCount(result.total);
      setCategories(result.categories);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
      setTotalCount(0);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    onFilterChange({ search: value });
  };

  const handleCategoryChange = (value: string) => {
    onFilterChange({ category: value === 'all' ? undefined : value });
  };

  const handleSortChange = (value: 'name' | 'rating' | 'created' | 'default' | undefined) => {
    onFilterChange({ sort: value });
  };

  const totalPages = Math.ceil(totalCount / (filters.limit || 10));

  const formatPrice = (price: number, salePrice?: number) => {
    const hasSale = salePrice && salePrice < price;
    return (
      <div className="flex items-center gap-2">
        {hasSale ? (
          <>
            <span className="text-lg font-bold text-red-600">
              ${salePrice.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500 line-through">
              ${price.toFixed(2)}
            </span>
            <Badge variant="error" className="text-xs">
              {Math.round((1 - salePrice / price) * 100)}% OFF
            </Badge>
          </>
        ) : (
          <span className="text-lg font-bold text-gray-900">
            ${price.toFixed(2)}
          </span>
        )}
      </div>
    );
  };

  const ProductCard = ({ product }: { product: ShopProduct }) => (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <div className="relative">
        {product.imageUrl ? (
          <div className="relative h-48 overflow-hidden rounded-t-lg">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
            />
          </div>
        ) : (
          <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {/* Quick Actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="secondary" className="w-8 h-8 p-0">
            <Heart className="w-4 h-4" />
          </Button>
        </div>

        {/* Stock Badge */}
        {product.stock <= 5 && (
          <div className="absolute top-2 left-2">
            <Badge variant="error" className="text-xs">
              {product.stock === 0 ? 'Out of Stock' : `Only ${product.stock} left`}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2">
            {product.name}
          </h3>
          
          {product.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {product.description}
            </p>
          )}

          {product.category && (
            <Badge variant="default" className="text-xs">
              {product.category}
            </Badge>
          )}

          {formatPrice(product.price, product.salePrice)}

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span>{product.rating.toFixed(1)}</span>
              {product.reviewCount && (
                <span className="text-gray-500">({product.reviewCount})</span>
              )}
            </div>
          )}

          <Button 
            className="w-full mt-3" 
            disabled={product.stock === 0}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const ProductListItem = ({ product }: { product: ShopProduct }) => (
    <Card className="group hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="relative w-24 h-24 flex-shrink-0">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {product.name}
                </h3>
                
                {product.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {product.description}
                  </p>
                )}

                {product.category && (
                  <Badge variant="default" className="text-xs mt-2">
                    {product.category}
                  </Badge>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                {formatPrice(product.price, product.salePrice)}
                
                {product.rating && (
                  <div className="flex items-center gap-1 text-sm mt-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span>{product.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mt-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>SKU: {product.sku}</span>
                <Separator orientation="vertical" className="h-4" />
                <span className={product.stock <= 5 ? 'text-red-600 font-medium' : ''}>
                  {product.stock} in stock
                </span>
              </div>

              <Button 
                size="sm" 
                disabled={product.stock === 0}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search products..."
                  value={filters.search || ''}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <Select 
              value={filters.category || 'all'} 
              onChange={(e) => handleCategoryChange(e.target.value)}
              options={[
                { value: 'all', label: 'All Categories' },
                ...categories.map((category) => ({ value: category, label: category }))
              ]}
            />

            {/* Sort */}
            <Select 
              value={filters.sort || 'default'} 
              onChange={(e) => handleSortChange(e.target.value as 'name' | 'rating' | 'created' | 'default' | undefined)}
              options={[
                { value: 'default', label: 'Default' },
                { value: 'name-asc', label: 'Name (A-Z)' },
                { value: 'name-desc', label: 'Name (Z-A)' },
                { value: 'price-low', label: 'Price (Low to High)' },
                { value: 'price-high', label: 'Price (High to Low)' },
                { value: 'newest', label: 'Newest First' },
                { value: 'rating', label: 'Highest Rated' }
              ]}
            />

            {/* View Mode */}
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <p className="text-gray-600">
          Showing {products.length} of {totalCount} products
        </p>
      </div>

      {/* Products Grid/List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-t-lg" />
              <CardContent className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-6 bg-gray-200 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <ProductListItem key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange((filters.page || 1) - 1)}
            disabled={(filters.page || 1) === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="flex gap-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const page = i + 1;
              const isActive = page === (filters.page || 1);
              return (
                <Button
                  key={page}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange((filters.page || 1) + 1)}
            disabled={(filters.page || 1) === totalPages}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
