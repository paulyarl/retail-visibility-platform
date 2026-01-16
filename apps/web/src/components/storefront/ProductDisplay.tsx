"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import SmartProductCard from '@/components/products/SmartProductCard';
import { TenantPaymentProvider } from '@/contexts/TenantPaymentContext';

interface Product {
  id: string;
  sku: string;
  name: string;
  title: string;
  brand: string;
  description?: string;
  price: number;
  priceCents?: number;
  salePriceCents?: number;
  currency: string;
  stock: number;
  imageUrl?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  payment_gateway_type?: string | null;
  payment_gateway_id?: string | null;
  has_variants?: boolean;
  has_active_payment_gateway?: boolean;
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface ProductDisplayProps {
  products: Product[];
  tenantId: string;
  tenantName?: string;
  tenantLogo?: string;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ProductDisplay({ products, tenantId, tenantName, tenantLogo }: ProductDisplayProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'gallery'>('grid'); // Default to grid for SSR
  const [mounted, setMounted] = useState(false);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Initialize view mode on client-side only
  useEffect(() => {
    setMounted(true);
    try {
      const qs = new URLSearchParams(window.location.search);
      const q = qs.get('view');
      if (q === 'grid' || q === 'list' || q === 'gallery') {
        setViewMode(q);
        return;
      }
      const saved = localStorage.getItem('storefront_view_mode');
      if (saved === 'grid' || saved === 'list' || saved === 'gallery') {
        setViewMode(saved as 'grid' | 'list' | 'gallery');
      }
    } catch (e) {
      // Ignore URL parsing errors on server
    }
  }, []);

  // Persist on change and sync URL without navigation
  useEffect(() => {
    if (!mounted) return; // Only update after initial mount
    try {
      localStorage.setItem('storefront_view_mode', viewMode);
      const url = new URL(window.location.href);
      url.searchParams.set('view', viewMode);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [viewMode, mounted]);

  // Handle ESC key to close zoom
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomed) {
        setIsZoomed(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isZoomed]);

  // Don't render view toggle until client-side state is initialized
  if (!mounted) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: Product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Product Image */}
              <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-700">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* Stock Badge */}
                {product.availability === 'out_of_stock' && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    Out of Stock
                  </div>
                )}
                {product.availability === 'preorder' && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    Pre-order
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {product.brand}
                  </p>
                  {product.tenantCategory && (
                    <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
                      {product.tenantCategory.name}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-2 mb-2">
                  {product.title}
                </h3>
                {product.description && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
                    {product.description}
                  </p>
                )}
                <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                  ${((product.priceCents || Math.round(product.price * 100)) / 100).toFixed(2)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Check if any products have photos
  const hasPhotos = products.some(product => product.imageUrl);
  
  // Filter products with photos for gallery view
  const productsWithPhotos = products.filter(product => product.imageUrl);

  return (
    <TenantPaymentProvider tenantId={tenantId}>
      <div>
      {/* View Toggle */}
      <div className="flex justify-end mb-6">
        <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-600 p-1 bg-white dark:bg-neutral-800">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary-600 text-white'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            aria-label="Grid view"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            aria-label="List view"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* Only show gallery view if products have photos */}
          {hasPhotos && (
            <button
              onClick={() => setViewMode('gallery')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'gallery'
                  ? 'bg-primary-600 text-white'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
              aria-label="Gallery view"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Grid View - Self-Aware Products! */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: Product) => (
            <SmartProductCard
              key={product.id}
              product={{
                id: product.id,
                sku: product.sku,
                name: product.name,
                title: product.title,
                brand: product.brand,
                description: product.description,
                priceCents: product.priceCents || Math.round(product.price * 100),
                salePriceCents: product.salePriceCents,
                stock: product.stock,
                imageUrl: product.imageUrl,
                tenantId: tenantId,
                payment_gateway_type: product.payment_gateway_type,
                payment_gateway_id: product.payment_gateway_id,
                has_variants: product.has_variants,
                has_active_payment_gateway: product.has_active_payment_gateway,
                availability: product.availability,
                tenantCategory: product.tenantCategory,
              }}
              tenantName={tenantName}
              tenantLogo={tenantLogo}
              variant="grid"
              showCategory={true}
              showDescription={true}
            />
          ))}
        </div>
      )}

      {/* Gallery View */}
      {viewMode === 'gallery' && productsWithPhotos.length > 0 && (
        <div className="space-y-6">
          {/* Product Navigation */}
          <div className="flex items-center justify-between bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            <button
              onClick={() => {
                setCurrentProductIndex((prev) => (prev > 0 ? prev - 1 : productsWithPhotos.length - 1));
                setCurrentPhotoIndex(0);
              }}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              aria-label="Previous product"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Product {currentProductIndex + 1} of {productsWithPhotos.length}
              </p>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                {productsWithPhotos[currentProductIndex].title}
              </h2>
            </div>
            <button
              onClick={() => {
                setCurrentProductIndex((prev) => (prev < productsWithPhotos.length - 1 ? prev + 1 : 0));
                setCurrentPhotoIndex(0);
              }}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              aria-label="Next product"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Photo Gallery */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {/* Main Photo Display - Reduced size with hover zoom */}
            <div 
              className="relative w-full max-w-2xl mx-auto aspect-square bg-neutral-100 dark:bg-neutral-700 group cursor-zoom-in"
              onClick={() => setIsZoomed(true)}
            >
              <Image
                src={productsWithPhotos[currentProductIndex].imageUrl!}
                alt={productsWithPhotos[currentProductIndex].title}
                fill
                className="object-contain transition-transform duration-300 group-hover:scale-110"
              />
              {/* Stock Badge */}
              {productsWithPhotos[currentProductIndex].availability === 'out_of_stock' && (
                <div className="absolute top-4 right-4 bg-red-500 text-white text-sm px-3 py-1.5 rounded z-10">
                  Out of Stock
                </div>
              )}
              {productsWithPhotos[currentProductIndex].availability === 'preorder' && (
                <div className="absolute top-4 right-4 bg-blue-500 text-white text-sm px-3 py-1.5 rounded z-10">
                  Pre-order
                </div>
              )}
              {/* Hover to Zoom Hint */}
              <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Click for full view
              </div>
            </div>
          </div>

          {/* Full Screen Zoom Modal */}
          {isZoomed && (
            <div 
              className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
              onClick={() => setIsZoomed(false)}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsZoomed(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                aria-label="Close zoom"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* ESC to close hint */}
              <div className="absolute top-4 left-4 bg-black/70 text-white text-sm px-3 py-2 rounded">
                Press ESC or click to close
              </div>

              {/* Top Navigation Controls */}
              <div className="w-full max-w-7xl flex items-center justify-between mb-4 px-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentProductIndex((prev) => (prev > 0 ? prev - 1 : productsWithPhotos.length - 1));
                  }}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  aria-label="Previous product"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-center">
                  <p className="text-sm text-white/60">
                    Product {currentProductIndex + 1} of {productsWithPhotos.length}
                  </p>
                  <h3 className="text-lg font-semibold text-white">
                    {productsWithPhotos[currentProductIndex].title}
                  </h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentProductIndex((prev) => (prev < productsWithPhotos.length - 1 ? prev + 1 : 0));
                  }}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  aria-label="Next product"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Zoomed Image */}
              <div className="relative w-full flex-1 max-w-7xl">
                <Image
                  src={productsWithPhotos[currentProductIndex].imageUrl!}
                  alt={productsWithPhotos[currentProductIndex].title}
                  fill
                  className="object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Bottom Navigation Controls */}
              <div className="w-full max-w-7xl flex items-center justify-between mt-4 px-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentProductIndex((prev) => (prev > 0 ? prev - 1 : productsWithPhotos.length - 1));
                  }}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  aria-label="Previous product"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-4 text-white/80">
                    <span>{productsWithPhotos[currentProductIndex].brand}</span>
                    <span className="text-white font-semibold">
                      {productsWithPhotos[currentProductIndex].currency} {typeof productsWithPhotos[currentProductIndex].price === 'number' ? productsWithPhotos[currentProductIndex].price.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentProductIndex((prev) => (prev < productsWithPhotos.length - 1 ? prev + 1 : 0));
                  }}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  aria-label="Next product"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Product Details Below Gallery */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {productsWithPhotos[currentProductIndex].brand}
                  </p>
                  {productsWithPhotos[currentProductIndex].tenantCategory && (
                    <span className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
                      {productsWithPhotos[currentProductIndex].tenantCategory.name}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
                  {productsWithPhotos[currentProductIndex].title}
                </h3>
                {productsWithPhotos[currentProductIndex].description && (
                  <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                    {productsWithPhotos[currentProductIndex].description}
                  </p>
                )}
              </div>
              <div className="text-right ml-6">
                <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                  {productsWithPhotos[currentProductIndex].currency} {typeof productsWithPhotos[currentProductIndex].price === 'number' ? productsWithPhotos[currentProductIndex].price.toFixed(2) : '0.00'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-6 text-sm text-neutral-500">
                <span>SKU: {productsWithPhotos[currentProductIndex].sku}</span>
                <span className={`font-medium ${
                  productsWithPhotos[currentProductIndex].stock === 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : productsWithPhotos[currentProductIndex].stock < 10 
                    ? 'text-amber-600 dark:text-amber-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  Stock: {productsWithPhotos[currentProductIndex].stock}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/products/${productsWithPhotos[currentProductIndex].id}`}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-center"
                >
                  View Full Details
                </Link>
                {/* Self-Aware Purchase UI */}
                <SmartProductCard
                  product={{
                    id: productsWithPhotos[currentProductIndex].id,
                    sku: productsWithPhotos[currentProductIndex].sku,
                    name: productsWithPhotos[currentProductIndex].name,
                    title: productsWithPhotos[currentProductIndex].title,
                    brand: productsWithPhotos[currentProductIndex].brand,
                    description: productsWithPhotos[currentProductIndex].description,
                    priceCents: productsWithPhotos[currentProductIndex].priceCents || Math.round(productsWithPhotos[currentProductIndex].price * 100),
                    salePriceCents: productsWithPhotos[currentProductIndex].salePriceCents,
                    stock: productsWithPhotos[currentProductIndex].stock,
                    imageUrl: productsWithPhotos[currentProductIndex].imageUrl,
                    tenantId: tenantId,
                    payment_gateway_type: productsWithPhotos[currentProductIndex].payment_gateway_type,
                    payment_gateway_id: productsWithPhotos[currentProductIndex].payment_gateway_id,
                    has_variants: productsWithPhotos[currentProductIndex].has_variants,
                    availability: productsWithPhotos[currentProductIndex].availability,
                    tenantCategory: productsWithPhotos[currentProductIndex].tenantCategory,
                  }}
                  tenantName={tenantName}
                  tenantLogo={tenantLogo}
                  variant="compact"
                  showCategory={false}
                  showDescription={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List View - Self-Aware Products! */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {products.map((product: Product) => (
            <SmartProductCard
              key={product.id}
              product={{
                id: product.id,
                sku: product.sku,
                name: product.name,
                title: product.title,
                brand: product.brand,
                description: product.description,
                priceCents: product.priceCents || Math.round(product.price * 100),
                salePriceCents: product.salePriceCents,
                stock: product.stock,
                imageUrl: product.imageUrl,
                tenantId: tenantId,
                payment_gateway_type: product.payment_gateway_type,
                payment_gateway_id: product.payment_gateway_id,
                has_variants: product.has_variants,
                has_active_payment_gateway: product.has_active_payment_gateway,
                availability: product.availability,
                tenantCategory: product.tenantCategory,
              }}
              tenantName={tenantName}
              tenantLogo={tenantLogo}
              variant="list"
              showCategory={true}
              showDescription={true}
            />
          ))}
        </div>
      )}
      </div>
    </TenantPaymentProvider>
  );
}
