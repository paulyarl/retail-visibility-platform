"use client";

import React, { useState } from 'react';
import { ProductCard, ProductData } from '@/components/products/ProductCardLayouts';
import { useProductLayout, layoutVariantDescriptions } from '@/contexts/ProductLayoutContext';

interface FeaturedBucketSimpleProps {
  title: string;
  description: string;
  products: any[];
  totalCount: number;
  bucketType: string;
  tenantId: string;
  tenantName?: string;
  tenantLogo?: string;
  shops?: Array<{
    id: string;
    name: string;
    slug: string;
    logo?: string;
    tier: string;
  }>;
  initialLimit?: number;
  showLayoutSelector?: boolean;
}

/**
 * Simple Featured Bucket with Pagination and Layout Variants
 * 
 * Uses ProductCardLayouts for consistent product display across all variants
 * All variants maintain the same data integrity while offering different visual presentations
 * Layout preference is saved and persisted across sessions
 */
export default function FeaturedBucketSimple({ 
  title, 
  description, 
  products, 
  totalCount, 
  bucketType,
  tenantId,
  tenantName,
  tenantLogo,
  shops,
  initialLimit = 3,
  showLayoutSelector = true
}: FeaturedBucketSimpleProps) {
  const { variant, setVariant } = useProductLayout();
  const [currentPage, setCurrentPage] = useState(1);
  
  // Helper function to get default gateway type for a tenant
  const getDefaultGatewayType = (tenantId: string): string => {
    // Find a product from this tenant to get its default gateway type
    const tenantProduct = products.find(p => p.tenantId === tenantId);
    return tenantProduct?.defaultGatewayType || 'stripe';
  };
  
  const productsPerPage = initialLimit;
  
  // Calculate pagination
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  
  // Filter out products with missing required data
  const validProducts = products.filter(product => 
    product && 
    product.id && 
    product.name && 
    product.priceCents
  );
  
  const currentProducts = validProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(validProducts.length / productsPerPage);
  
  // Log if we filtered out any products
  if (validProducts.length !== products.length) {
    console.warn(`[FeaturedBucketSimple] ${bucketType} - Filtered out ${products.length - validProducts.length} products with missing data`);
  }
  
  // Don't render if no valid products
  if (validProducts.length === 0) {
    console.log(`[FeaturedBucketSimple] ${bucketType} - No valid products to render`);
    return null;
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of bucket
    const element = document.getElementById(`${bucketType}-section`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Layout Selector Component
  const LayoutSelector = () => (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Product Layout</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Current: {layoutVariantDescriptions[variant as keyof typeof layoutVariantDescriptions].name}
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(layoutVariantDescriptions) as [keyof typeof layoutVariantDescriptions, typeof layoutVariantDescriptions[keyof typeof layoutVariantDescriptions]][]).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setVariant(key)}
            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
              variant === key
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{config.icon}</span>
              <span className={`text-sm font-medium ${
                variant === key
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {config.name}
              </span>
            </div>
            
            <div className="space-y-1">
              {config.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    variant === key
                      ? 'bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
      
      <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          {layoutVariantDescriptions[variant as keyof typeof layoutVariantDescriptions].description}
        </p>
      </div>
    </div>
  );

  return (
    <div id={`${bucketType}-section`} className="featured-bucket mb-12">
       {/* Gradient border line */}
          <div className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
         
          <p className="text-gray-600">{description}</p>
          <p className="text-sm text-gray-500">
            {validProducts.length} {validProducts.length === 1 ? 'product' : 'products'}
            {totalCount > validProducts.length && (
              <span className="text-xs text-amber-600 ml-2">
                ({totalCount - validProducts.length} unavailable)
              </span>
            )}
          </p>
        </div>
        
        {/* View More Link */}
        {validProducts.length > productsPerPage && (
          <a
            href={`/tenant/${tenantId}?featured=${bucketType}&products_only=true`}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View All →
          </a>
        )}
      </div>

      {/* Layout Selector */}
      {showLayoutSelector && <LayoutSelector />}

      {/* Products Grid */}
      <div className={`grid gap-6 mb-6 ${
        variant === 'compact' 
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {currentProducts.map((product: any) => (
          <ProductCard
            key={product.id}
            product={product as ProductData}
            variant={variant}
            tenantId={product.tenantId || tenantId}
            tenantName={product.tenantName || tenantName}
            tenantLogo={product.tenantLogo || tenantLogo}
            defaultGatewayType={product.defaultGatewayType || getDefaultGatewayType(product.tenantId)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
