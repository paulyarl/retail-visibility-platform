"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PriceDisplay } from './PriceDisplay';
import ProductWithVariants from './ProductWithVariants';
import { AddToCartButton } from './AddToCartButton';
import { useTenantPaymentOptional } from '@/contexts/TenantPaymentContext';

interface ProductData {
  id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  description?: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  imageUrl?: string;
  tenantId: string;
  payment_gateway_type?: string | null;
  payment_gateway_id?: string | null;
  has_variants?: boolean;
  has_active_payment_gateway?: boolean;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface SmartProductCardProps {
  product: ProductData;
  tenantName?: string;
  tenantLogo?: string;
  variant?: 'grid' | 'list' | 'compact' | 'featured';
  showCategory?: boolean;
  showDescription?: boolean;
  className?: string;
}

export default function SmartProductCard({
  product,
  tenantName,
  tenantLogo,
  variant = 'grid',
  showCategory = true,
  showDescription = true,
  className = '',
}: SmartProductCardProps) {
  // Debug logging for featured products
  /* console.log('[SmartProductCard] Rendering product:', {
    id: product.id,
    name: product.name,
    variant,
    hasImage: !!product.imageUrl,
    priceCents: product.priceCents
  }); */

  // Try to use context first (performance optimization)
  const contextPayment = useTenantPaymentOptional();
  
  // Fallback state for when context is not available
  const [canPurchase, setCanPurchase] = useState(false);
  const [defaultGatewayType, setDefaultGatewayType] = useState<string | undefined>();

  // Priority: product data (from MV) > context > individual API fetch
  const effectiveCanPurchase = product.has_active_payment_gateway ?? contextPayment?.canPurchase ?? canPurchase;
  const effectiveGatewayType = product.payment_gateway_type ?? contextPayment?.defaultGatewayType ?? defaultGatewayType;

  useEffect(() => {
    // Skip individual fetch if context is available
    if (contextPayment) {
      return;
    }

    // Skip if MV data is available
    if (product.has_active_payment_gateway !== undefined) {
      return;
    }

    const checkPurchaseAbility = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/tenants/${product.tenantId}/payment-gateway`);
        
        if (response.ok) {
          const data = await response.json();
          setCanPurchase(data.hasActiveGateway || false);
          setDefaultGatewayType(data.defaultGatewayType || undefined);
        } else {
          setCanPurchase(false);
        }
      } catch (error) {
        console.error('Failed to check payment gateway:', error);
        setCanPurchase(false);
      }
    };

    checkPurchaseAbility();
  }, [product.tenantId, contextPayment, product.has_active_payment_gateway]);

  const displayTitle = product.title || product.name;
  const displayBrand = product.brand || '';

  // Featured variant - Prominent styling for conversion optimization
  if (variant === 'featured') {
    return (
      <div className={`group relative bg-white dark:bg-neutral-800 rounded-xl overflow-hidden hover:shadow-2xl transition-all duration-300 ${className}`}>
        {/* Featured Badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            FEATURED
          </span>
        </div>

        {/* Gradient Border Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-400 to-pink-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ padding: '2px' }}>
          <div className="w-full h-full bg-white dark:bg-neutral-800 rounded-xl"></div>
        </div>

        <div className="relative">
          {/* Featured Image - Larger */}
          <Link href={`/products/${product.id}`} className="relative block aspect-square bg-neutral-100 dark:bg-neutral-700">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={displayTitle}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {product.availability === 'out_of_stock' && (
              <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-3 py-1.5 rounded-full font-semibold">
                Out of Stock
              </div>
            )}
            {product.availability === 'preorder' && (
              <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-full font-semibold">
                Pre-order
              </div>
            )}
          </Link>

          {/* Featured Info - Enhanced */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              {displayBrand && (
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                  {displayBrand}
                </p>
              )}
              {showCategory && product.tenantCategory && (
                <span className="text-xs px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full font-medium">
                  {product.tenantCategory.name}
                </span>
              )}
            </div>
            
            <Link href={`/products/${product.id}`}>
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white line-clamp-2 mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {displayTitle}
              </h3>
            </Link>

            {showDescription && product.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-4">
                {product.description}
              </p>
            )}

            <div className="flex items-center justify-between mb-4">
              <PriceDisplay
                priceCents={product.priceCents}
                salePriceCents={product.salePriceCents}
                variant="large"
                showSavingsBadge={true}
              />
              <div className="text-right">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  SKU: {product.sku}
                </p>
                <p className={`text-xs font-semibold ${
                  product.stock === 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : product.stock < 10 
                    ? 'text-amber-600 dark:text-amber-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  Stock: {product.stock}
                </p>
              </div>
            </div>

            {/* Purchase UI - Prominent */}
            {effectiveCanPurchase && (
              <div className="mt-4">
                {product.has_variants ? (
                  <ProductWithVariants
                    product={product}
                    tenantName={tenantName || ''}
                    tenantLogo={tenantLogo}
                    defaultGatewayType={effectiveGatewayType}
                    className="w-full"
                  />
                ) : (
                  <AddToCartButton
                    product={product}
                    tenantName={tenantName || ''}
                    tenantLogo={tenantLogo}
                    hasActivePaymentGateway={effectiveCanPurchase}
                    defaultGatewayType={effectiveGatewayType}
                    className="w-full"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 hover:shadow-md transition-shadow ${className}`}>
        <div className="flex gap-3">
          {/* Compact Image */}
          <Link href={`/products/${product.id}`} className="relative w-16 h-16 shrink-0 bg-neutral-100 dark:bg-neutral-700 rounded">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={displayTitle}
                fill
                className="object-cover rounded"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </Link>

          {/* Compact Info */}
          <div className="flex-1 min-w-0">
            <Link href={`/products/${product.id}`}>
              <h4 className="font-medium text-sm text-neutral-900 dark:text-white truncate">
                {displayTitle}
              </h4>
            </Link>
            
            {/* Brand if available */}
            {product.brand && product.brand !== tenantName && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                by {product.brand}
              </p>
            )}
            
            <div className="flex items-center gap-1 mt-0.5">
              <PriceDisplay
                priceCents={product.priceCents}
                salePriceCents={product.salePriceCents}
                variant="compact"
              />
              {product.salePriceCents && (
                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 px-1.5 py-0.5 rounded">
                  Sale
                </span>
              )}
            </div>
            
            {/* Category and Stock Status */}
            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {showCategory && product.tenantCategory && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {typeof product.tenantCategory === 'string' ? product.tenantCategory : product.tenantCategory?.name || ''}
                </span>
              )}
              {product.stock !== undefined && product.stock !== null && (
                <>
                  {showCategory && product.tenantCategory && <span>•</span>}
                  <span className={`flex items-center gap-1 ${
                    product.stock === 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : product.stock <= 5 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-green-600 dark:text-green-400'
                  }`}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    {product.stock === 0 
                      ? 'Out of Stock' 
                      : product.stock <= 5 
                        ? `Only ${product.stock} left` 
                        : 'In Stock'
                    }
                  </span>
                </>
              )}
              {product.has_variants && (
                <>
                  {(showCategory && product.tenantCategory) || (product.stock !== undefined && product.stock !== null) ? <span>•</span> : null}
                  <span className="text-blue-600 dark:text-blue-400">
                    Multiple options
                  </span>
                </>
              )}
            </div>
            
            {effectiveCanPurchase && (
              <div className="mt-2">
                {product.has_variants ? (
                  <Link
                    href={`/products/${product.id}`}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    View Options →
                  </Link>
                ) : (
                  <AddToCartButton
                    product={product}
                    tenantName={tenantName || ''}
                    tenantLogo={tenantLogo}
                    hasActivePaymentGateway={effectiveCanPurchase}
                    defaultGatewayType={effectiveGatewayType}
                    className="text-xs py-1"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow flex ${className}`}>
        {/* List Image */}
        <Link href={`/products/${product.id}`} className="relative w-48 h-48 shrink-0 bg-neutral-100 dark:bg-neutral-700 block">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={displayTitle}
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
        </Link>

        {/* List Info */}
        <div className="p-6 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  {displayBrand && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {displayBrand}
                    </p>
                  )}
                  {showCategory && product.tenantCategory && (
                    <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
                      {product.tenantCategory.name}
                    </span>
                  )}
                </div>
                <Link href={`/products/${product.id}`}>
                  <h3 className="font-semibold text-lg text-neutral-900 dark:text-white mb-2 hover:text-primary-600 dark:hover:text-primary-400">
                    {displayTitle}
                  </h3>
                </Link>
              </div>
              <div className="ml-4">
                <PriceDisplay
                  priceCents={product.priceCents}
                  salePriceCents={product.salePriceCents}
                  variant="default"
                  showSavingsBadge={true}
                />
              </div>
            </div>
            {showDescription && product.description && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {product.description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              <span>SKU: {product.sku}</span>
              <span className={`ml-4 font-medium ${
                product.stock === 0 
                  ? 'text-red-600 dark:text-red-400' 
                  : product.stock < 10 
                  ? 'text-amber-600 dark:text-amber-400' 
                  : 'text-green-600 dark:text-green-400'
              }`}>
                Stock: {product.stock}
              </span>
            </div>
            {effectiveCanPurchase && (
              product.has_variants ? (
                <ProductWithVariants
                  product={product}
                  tenantName={tenantName || ''}
                  tenantLogo={tenantLogo}
                  defaultGatewayType={effectiveGatewayType}
                />
              ) : (
                <AddToCartButton
                  product={product}
                  tenantName={tenantName || ''}
                  tenantLogo={tenantLogo}
                  hasActivePaymentGateway={effectiveCanPurchase}
                  defaultGatewayType={effectiveGatewayType}
                />
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid variant (default)
  return (
    <div className={`group bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow ${className}`}>
      {/* Grid Image */}
      <Link href={`/products/${product.id}`} className="block relative aspect-square bg-neutral-100 dark:bg-neutral-700">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={displayTitle}
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
      </Link>

      {/* Grid Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          {displayBrand && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {displayBrand}
            </p>
          )}
          {showCategory && product.tenantCategory && (
            <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
              {product.tenantCategory.name}
            </span>
          )}
        </div>
        <Link href={`/products/${product.id}`}>
          <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-2 mb-2 hover:text-primary-600 dark:hover:text-primary-400">
            {displayTitle}
          </h3>
        </Link>
        {showDescription && product.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}
        <div className="flex items-center justify-between mb-3">
          <PriceDisplay
            priceCents={product.priceCents}
            salePriceCents={product.salePriceCents}
            variant="default"
            showSavingsBadge={true}
          />
          <div className="text-right">
            <p className="text-xs text-neutral-500">
              SKU: {product.sku}
            </p>
            <p className={`text-xs font-medium ${
              product.stock === 0 
                ? 'text-red-600 dark:text-red-400' 
                : product.stock < 10 
                ? 'text-amber-600 dark:text-amber-400' 
                : 'text-green-600 dark:text-green-400'
            }`}>
              Stock: {product.stock}
            </p>
          </div>
        </div>

        {effectiveCanPurchase && (
            product.has_variants ? (
              <ProductWithVariants
                product={product}
                tenantName={tenantName || ''}
                tenantLogo={tenantLogo}
                defaultGatewayType={effectiveGatewayType}
                className="w-full"
              />
            ) : (
              <AddToCartButton
                product={product}
                tenantName={tenantName || ''}
                tenantLogo={tenantLogo}
                hasActivePaymentGateway={effectiveCanPurchase}
                defaultGatewayType={effectiveGatewayType}
                className="w-full"
              />
            )
          )}
      </div>
    </div>
  );
}
