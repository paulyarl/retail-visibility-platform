"use client";

import { useState } from "react";
import SmartProductCard from '@/components/products/SmartProductCard';

interface FeaturedBucketProps {
  title: string;
  icon: string;
  gradient: string;
  products: any[];
  totalCount: number;
  bucketType: string;
  tenantId: string;
  initialLimit?: number;
  // Payment gateway status from parent page
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
  commerceDisabled?: boolean;
  /** Only show badges for these featured types (gated types filtered out) */
  allowedFeaturedTypes?: string[];
}

/**
 * Individual Featured Bucket with Pagination
 * 
 * Displays a specific featured product type (e.g., New Arrivals, Staff Picks)
 * with pagination limited to 3 products per page initially.
 */
export default function FeaturedBucket({ 
  title, 
  icon, 
  gradient, 
  products, 
  totalCount, 
  bucketType,
  tenantId,
  initialLimit = 3,
  hasActivePaymentGateway,
  defaultGatewayType,
  commerceDisabled,
  allowedFeaturedTypes,
}: FeaturedBucketProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = initialLimit;
  
  // Calculate pagination
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(products.length / productsPerPage);
  
  // Don't render if no products
  if (!products || products.length === 0) {
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

  return (
    <div id={`${bucketType}-section`} className="featured-bucket mb-12 scroll-mt-20">
      {/* Section Header */}
      
      {/* Gradient border line */}
      <div className="flex w-full bottom-0.5 top-0.5 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${gradient} flex items-center justify-center text-white`}>
            <span className="text-lg">{icon}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-gray-600">
              {totalCount} {totalCount === 1 ? 'product' : 'products'}
            </p>
          </div>
        </div>
        
        {/* View More Link */}
        {totalCount > productsPerPage && (
          <a
            href={`/tenant/${tenantId}?featured=${bucketType}&products_only=true`}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View All →
          </a>
        )}
      </div>

      {/* Products Grid — grouped by product type */}
      <div className="space-y-6 mb-6">
        {(() => {
          const productTypeOrder = ['physical', 'digital', 'service', 'hybrid'] as const;
          const productTypeLabels: Record<string, string> = {
            physical: 'Physical Products',
            digital: 'Digital Products',
            service: 'Service Products',
            hybrid: 'Hybrid Products',
          };
          const grouped = productTypeOrder.reduce((acc, pt) => {
            acc[pt] = currentProducts.filter((p: any) => (p.productType || 'physical') === pt);
            return acc;
          }, {} as Record<string, any[]>);
          const otherProducts = currentProducts.filter((p: any) => {
            const pt = p.productType || 'physical';
            return !productTypeOrder.includes(pt as any);
          });

          return (
            <>
              {productTypeOrder.map(pt => {
                const group = grouped[pt];
                if (!group || group.length === 0) return null;
                return (
                  <div key={pt}>
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">{productTypeLabels[pt]}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {group.map((product: any) => (
                        <SmartProductCard
                          key={product.id}
                          tenantId={tenantId}
                          product={{
                            id: product.id,
                            sku: product.sku,
                            name: product.name,
                            title: product.title || product.name,
                            brand: product.brand || '',
                            description: product.description || '',
                            priceCents: product.priceCents,
                            salePriceCents: product.salePriceCents,
                            stock: product.stock,
                            imageUrl: product.imageUrl,
                            tenantId: product.tenantId,
                            availability: product.availability || 'in_stock',
                            has_variants: product.hasVariants || false,
                            has_active_payment_gateway: hasActivePaymentGateway,
                            payment_gateway_type: defaultGatewayType,
                            featuredType: product.featuredType || bucketType || undefined,
                            featuredTypes: (product.featuredTypes || (product.featuredType ? [product.featuredType] : (bucketType ? [bucketType] : [])))
                              .filter((t: string) => !allowedFeaturedTypes || allowedFeaturedTypes.includes(t)),
                            productType: product.productType || 'physical',
                          }}
                          hasActivePaymentGateway={hasActivePaymentGateway}
                          defaultGatewayType={defaultGatewayType}
                          allowedFeaturedTypes={allowedFeaturedTypes}
                          variant="featured"
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {otherProducts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">Other Products</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {otherProducts.map((product: any) => (
                      <SmartProductCard
                        key={product.id}
                        tenantId={tenantId}
                        product={{
                          id: product.id,
                          sku: product.sku,
                          name: product.name,
                          title: product.title || product.name,
                          brand: product.brand || '',
                          description: product.description || '',
                          priceCents: product.priceCents,
                          salePriceCents: product.salePriceCents,
                          stock: product.stock,
                          imageUrl: product.imageUrl,
                          tenantId: product.tenantId,
                          availability: product.availability || 'in_stock',
                          has_variants: product.hasVariants || false,
                          has_active_payment_gateway: hasActivePaymentGateway,
                          payment_gateway_type: defaultGatewayType,
                          featuredType: product.featuredType || bucketType || undefined,
                          featuredTypes: (product.featuredTypes || (product.featuredType ? [product.featuredType] : (bucketType ? [bucketType] : [])))
                            .filter((t: string) => !allowedFeaturedTypes || allowedFeaturedTypes.includes(t)),
                          productType: product.productType || 'physical',
                        }}
                        hasActivePaymentGateway={hasActivePaymentGateway}
                        defaultGatewayType={defaultGatewayType}
                        allowedFeaturedTypes={allowedFeaturedTypes}
                        variant="featured"
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
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
