'use client';

/**
 * Global Catalog Browser Component
 * 
 * Allows merchants to browse, search, and adopt products from the global catalog.
 * Features:
 * - Category and brand filtering
 * - Search by name, brand, UPC
 * - Pagination
 * - Product adoption flow
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Grid,
  List,
  Package,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { Button } from '@mantine/core';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { globalCatalogService, GlobalProduct } from '@/services/GlobalCatalogService';
import ProductAdoptionModal from './ProductAdoptionModal';
import { clientLogger } from '@/lib/client-logger';

type ViewMode = 'grid' | 'list';

interface GlobalCatalogBrowserProps {
  tenantId: string;
  onProductAdopted?: (product: GlobalProduct) => void;
  maxProducts?: number;
  currentProductCount?: number;
}

export default function GlobalCatalogBrowser({
  tenantId,
  onProductAdopted,
  maxProducts = 500,
  currentProductCount = 0
}: GlobalCatalogBrowserProps) {
  const [products, setProducts] = useState<GlobalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;
  
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [adoptionModalProduct, setAdoptionModalProduct] = useState<GlobalProduct | null>(null);
  
  const [showFilters, setShowFilters] = useState(false);

  // Load catalog data
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await globalCatalogService.browseCatalog({
        category: selectedCategory || undefined,
        brand: selectedBrand || undefined,
        page,
        limit,
        sortBy: 'name',
        sortOrder: 'asc'
      });
      
      setProducts(result.products);
      setTotalProducts(result.total);
      setHasMore(result.hasMore);
      
      if (page === 1) {
        setCategories(result.categories);
        setBrands(result.brands);
      }
    } catch (err) {
      clientLogger.error('[GlobalCatalogBrowser] Error loading catalog:', { detail: err });
      setError('Failed to load catalog. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedBrand, page, limit]);

  // Search catalog
  const searchCatalog = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadCatalog();
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await globalCatalogService.searchCatalog(
        searchQuery,
        {
          category: selectedCategory || undefined,
          brand: selectedBrand || undefined
        },
        page,
        limit
      );
      
      setProducts(result.products);
      setTotalProducts(result.total);
      setHasMore(result.hasMore);
    } catch (err) {
      clientLogger.error('[GlobalCatalogBrowser] Error searching catalog:', { detail: err });
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedBrand, page, limit]);

  // Initial load
  useEffect(() => {
    if (searchQuery) {
      searchCatalog();
    } else {
      loadCatalog();
    }
  }, [searchQuery, selectedCategory, selectedBrand, page]);

  // Handle search with debounce
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  // Handle category filter
  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
    setSelectedBrand(null);
    setPage(1);
  };

  // Handle brand filter
  const handleBrandSelect = (brand: string | null) => {
    setSelectedBrand(brand);
    setPage(1);
  };

  // Handle adoption
  const handleAdoptProduct = (product: GlobalProduct) => {
    setAdoptionModalProduct(product);
  };

  const handleAdoptionComplete = (product: GlobalProduct) => {
    setAdoptionModalProduct(null);
    onProductAdopted?.(product);
  };

  // Pagination
  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (hasMore) setPage(page + 1);
  };

  // Calculate remaining product slots
  const remainingSlots = maxProducts - currentProductCount;
  const canAddProducts = remainingSlots > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Global Catalog</h2>
          <p className="text-sm text-gray-500">
            Browse and adopt products from the platform-wide catalog
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={canAddProducts ? 'success' : 'error'}>
            {currentProductCount}/{maxProducts} products
          </Badge>
          <Button
            variant="subtle"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List size={18} /> : <Grid size={18} />}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, brand, or UPC..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} className="mr-2" />
            Filters
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <select
                    value={selectedCategory || ''}
                    onChange={(e) => handleCategorySelect(e.target.value || null)}
                    className="w-full border rounded-md p-2"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Brand Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Brand</label>
                  <select
                    value={selectedBrand || ''}
                    onChange={(e) => handleBrandSelect(e.target.value || null)}
                    className="w-full border rounded-md p-2"
                  >
                    <option value="">All Brands</option>
                    {brands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Filters */}
              {(selectedCategory || selectedBrand) && (
                <div className="flex gap-2 mt-3">
                  {selectedCategory && (
                    <Badge variant="secondary" className="gap-1">
                      {selectedCategory}
                      <X
                        size={14}
                        className="cursor-pointer"
                        onClick={() => handleCategorySelect(null)}
                      />
                    </Badge>
                  )}
                  {selectedBrand && (
                    <Badge variant="secondary" className="gap-1">
                      {selectedBrand}
                      <X
                        size={14}
                        className="cursor-pointer"
                        onClick={() => handleBrandSelect(null)}
                      />
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
            <Button variant="subtle" onClick={loadCatalog}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-32 w-full mb-3" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Products Grid/List */}
      {!loading && products.length > 0 && (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
            : 'space-y-2'
        }>
          {products.map(product => (
            <Card
              key={product.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                viewMode === 'list' ? 'flex' : ''
              }`}
            >
              <CardContent className={`p-4 ${viewMode === 'list' ? 'flex flex-1' : ''}`}>
                {/* Product Image */}
                <div className={`bg-gray-100 rounded-md overflow-hidden ${
                  viewMode === 'grid' ? 'h-32 mb-3' : 'w-20 h-20 mr-4'
                }`}>
                  {product.images?.[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1">
                  <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{product.brand}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {product.category_path?.[0] || 'General'}
                    </Badge>
                    {product.gtin_upc && (
                      <Badge variant="secondary" className="text-xs">
                        UPC: {product.gtin_upc}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Adopt Button */}
                <div className={viewMode === 'grid' ? 'mt-3' : 'ml-4 flex items-center'}>
                  <Button
                    size="sm"
                    disabled={!canAddProducts}
                    onClick={() => handleAdoptProduct(product)}
                  >
                    <Plus size={16} className="mr-1" />
                    Adopt
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <h3 className="font-medium text-lg">No products found</h3>
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search or filters
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && totalProducts > 0 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, totalProducts)} of {totalProducts}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={handlePreviousPage}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={handleNextPage}
            >
              Next
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Adoption Modal */}
      {adoptionModalProduct && (
        <ProductAdoptionModal
          product={adoptionModalProduct}
          tenantId={tenantId}
          onClose={() => setAdoptionModalProduct(null)}
          onAdopted={handleAdoptionComplete}
        />
      )}
    </div>
  );
}
