/**
 * Product Display Component
 * Enforces required fields: name, stock, sku, featured type, price, category
 * Handles missing category and featured type gracefully
 */

'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { 
  ProductDisplay, 
  ProductDisplayVariant, 
  FeaturedType
} from '@/types/product-display';
import { 
  getFeaturedTypeDisplay,
  getCategoryDisplay,
  getStockStatus,
  formatPrice,
  validateProductDisplay
} from '@/types/product-display';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FeaturedTypeBadges } from './FeaturedTypeBadges';
import { SalePrice } from './SalePrice';
import { cn } from '@/lib/utils';

interface ProductDisplayProps {
  product: ProductDisplay;
  variant?: ProductDisplayVariant;
  showStock?: boolean;
  showSKU?: boolean;
  showFeaturedType?: boolean;
  showCategory?: boolean;
  className?: string;
  onClick?: () => void;
  href?: string;
}

export function ProductDisplay({
  product,
  variant = 'card',
  showStock = true,
  showSKU = false,
  showFeaturedType = true,
  showCategory = true,
  className,
  onClick,
  href
}: ProductDisplayProps) {
  // Validate required fields
  const validatedProduct = validateProductDisplay(product);
  
  // Get display helpers
  const stockStatus = getStockStatus(validatedProduct.stock);
  const featuredTypeDisplays = getFeaturedTypeDisplay(validatedProduct.featuredType);
  const categoryDisplay = getCategoryDisplay(validatedProduct.category);
  const formattedPrice = formatPrice(validatedProduct.price);

  // Handle click behavior
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      // Navigate will be handled by Link wrapper
    }
  };

  const content = (
    <div className={cn('product-display', className)}>
      {variant === 'card' && <ProductCard {...validatedProduct} 
        stockStatus={stockStatus}
        featuredTypeDisplays={featuredTypeDisplays}
        categoryDisplay={categoryDisplay}
        formattedPrice={formattedPrice}
        showStock={showStock}
        showSKU={showSKU}
        showFeaturedType={showFeaturedType}
        showCategory={showCategory}
        onClick={handleClick}
      />}
      
      {variant === 'list' && <ProductListItem {...validatedProduct}
        stockStatus={stockStatus}
        featuredTypeDisplays={featuredTypeDisplays}
        categoryDisplay={categoryDisplay}
        formattedPrice={formattedPrice}
        showStock={showStock}
        showSKU={showSKU}
        showFeaturedType={showFeaturedType}
        showCategory={showCategory}
        onClick={handleClick}
      />}
      
      {variant === 'compact' && <ProductCompact {...validatedProduct}
        stockStatus={stockStatus}
        featuredTypeDisplays={featuredTypeDisplays}
        categoryDisplay={categoryDisplay}
        formattedPrice={formattedPrice}
        onClick={handleClick}
      />}
      
      {variant === 'featured' && <ProductFeatured {...validatedProduct}
        stockStatus={stockStatus}
        featuredTypeDisplays={featuredTypeDisplays}
        categoryDisplay={categoryDisplay}
        formattedPrice={formattedPrice}
        showStock={showStock}
        showSKU={showSKU}
        showFeaturedType={showFeaturedType}
        showCategory={showCategory}
        onClick={handleClick}
      />}
      
      {variant === 'grid' && <ProductGrid {...validatedProduct}
        stockStatus={stockStatus}
        featuredTypeDisplays={featuredTypeDisplays}
        categoryDisplay={categoryDisplay}
        formattedPrice={formattedPrice}
        showStock={showStock}
        showSKU={showSKU}
        showFeaturedType={showFeaturedType}
        showCategory={showCategory}
        onClick={handleClick}
      />}
      
      {variant === 'detail' && <ProductDetail {...validatedProduct}
        stockStatus={stockStatus}
        featuredTypeDisplays={featuredTypeDisplays}
        categoryDisplay={categoryDisplay}
        formattedPrice={formattedPrice}
        showStock={showStock}
        showSKU={showSKU}
        showFeaturedType={showFeaturedType}
        showCategory={showCategory}
        onClick={handleClick}
      />}
    </div>
  );

  // Wrap with Link if href is provided
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

// ====================
// CARD VARIANT
// ====================

interface ProductCardProps extends ProductDisplay {
  stockStatus: ReturnType<typeof getStockStatus>;
  featuredTypeDisplays: ReturnType<typeof getFeaturedTypeDisplay>;
  categoryDisplay: string;
  formattedPrice: string;
  showStock: boolean;
  showSKU: boolean;
  showFeaturedType: boolean;
  showCategory: boolean;
  onClick: () => void;
}

function ProductCard({
  name,
  stock,
  sku,
  price,
  featuredType,
  category,
  description,
  imageUrl,
  stockStatus,
  featuredTypeDisplays,
  categoryDisplay,
  formattedPrice,
  salePrice,
  showStock,
  showSKU,
  showFeaturedType,
  showCategory,
  onClick
}: ProductCardProps) {
  return (
    <div className="group hover:shadow-lg transition-shadow duration-200 cursor-pointer border rounded-lg" onClick={onClick}>
      <div className="p-4">
        {/* Product Image */}
        <div className="relative h-48 mb-4 bg-gray-100 rounded-lg overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
              sizes="(max-width: 300px) 100vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-4xl">📦</span>
            </div>
          )}
          
          {/* Featured Type Badges */}
          {showFeaturedType && featuredTypeDisplays.length > 0 && (
            <div className="absolute top-2 right-2">
              <FeaturedTypeBadges 
                featuredTypes={featuredTypeDisplays} 
                maxVisible={2}
                size="xs"
              />
            </div>
          )}
          
          {/* Stock Status Badge */}
          {showStock && (
            <div className="absolute top-2 left-2">
              <Badge variant={stockStatus.color as any} className="text-xs">
                {stockStatus.label}
              </Badge>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-2">
          {/* Name */}
          <h3 className="font-semibold text-lg text-gray-900 line-clamp-2">
            {name}
          </h3>

          {/* Description */}
          {description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {description}
            </p>
          )}

          {/* Category */}
          {showCategory && (
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs">
                {categoryDisplay}
              </Badge>
            </div>
          )}

          {/* SKU */}
          {showSKU && (
            <div className="text-xs text-gray-500">
              SKU: {sku}
            </div>
          )}

          {/* Price */}
          <SalePrice 
            product={{
              price: {
                cents: price,
                currency: 'USD',
                formatted: formattedPrice
              },
              salePrice: salePrice
            }}
            variant="card"
            showOriginalPrice={true}
            showDiscountPercentage={true}
            showDiscountAmount={false}
          />
        </div>
      </div>
    </div>
  );
}

// ====================
// LIST VARIANT
// ====================

function ProductListItem({
  name,
  stock,
  sku,
  price,
  featuredType,
  category,
  imageUrl,
  stockStatus,
  featuredTypeDisplays,
  categoryDisplay,
  formattedPrice,
  salePrice,
  showStock,
  showSKU,
  showFeaturedType,
  showCategory,
  onClick
}: ProductCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={onClick}>
      {/* Product Image */}
      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={80}
            height={80}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-2xl">📦</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Name */}
            <h3 className="font-semibold text-gray-900 truncate">
              {name}
            </h3>

            {/* Category and Featured Types */}
            <div className="flex items-center gap-2 mt-1">
              {showCategory && (
                <Badge variant="default" className="text-xs">
                  {categoryDisplay}
                </Badge>
              )}
              {showFeaturedType && featuredTypeDisplays.length > 0 && (
                <FeaturedTypeBadges 
                  featuredTypes={featuredTypeDisplays}
                  maxVisible={1}
                  size="xs"
                />
              )}
            </div>

            {/* SKU */}
            {showSKU && (
              <div className="text-xs text-gray-500 mt-1">
                SKU: {sku}
              </div>
            )}
          </div>

          {/* Price and Stock */}
          <div className="text-right flex-shrink-0">
            <SalePrice 
              product={{
                price: {
                  cents: price,
                  currency: 'USD',
                  formatted: formattedPrice
                },
                salePrice: salePrice
              }}
              variant="compact"
              showOriginalPrice={false}
              showDiscountPercentage={true}
              showDiscountAmount={false}
            />
            {showStock && (
              <Badge variant={stockStatus.color as any} className="text-xs mt-1">
                {stockStatus.label}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================
// COMPACT VARIANT
// ====================

function ProductCompact({
  name,
  stock,
  price,
  featuredType,
  imageUrl,
  stockStatus,
  featuredTypeDisplays,
  categoryDisplay,
  formattedPrice,
  salePrice,
  onClick
}: Omit<ProductCardProps, 'sku' | 'category' | 'description' | 'showSKU' | 'showCategory' | 'showFeaturedType' | 'showStock'>) {
  return (
    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={onClick}>
      {/* Product Image */}
      <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={48}
            height={48}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-lg">📦</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900 truncate text-sm">
            {name}
          </h4>
          <div className="text-sm font-bold text-gray-900 ml-2">
            {formattedPrice}
          </div>
        </div>
        
        {/* Featured Types */}
        {featuredTypeDisplays.length > 0 && (
          <FeaturedTypeBadges 
            featuredTypes={featuredTypeDisplays}
            maxVisible={1}
            size="xs"
          />
        )}
      </div>
      
      {/* Price */}
      <SalePrice 
        product={{
          price: {
            cents: price,
            currency: 'USD',
            formatted: formattedPrice
          },
          salePrice: salePrice
        }}
        variant="compact"
        showOriginalPrice={false}
        showDiscountPercentage={true}
        showDiscountAmount={false}
      />
    </div>
  );
}

// ====================
// FEATURED VARIANT
// ====================

function ProductFeatured({
  name,
  stock,
  sku,
  price,
  featuredType,
  category,
  description,
  imageUrl,
  stockStatus,
  featuredTypeDisplays,
  categoryDisplay,
  formattedPrice,
  salePrice,
  showStock,
  showSKU,
  showFeaturedType,
  showCategory,
  onClick
}: ProductCardProps) {
  return (
    <div className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-blue-200" onClick={onClick}>
      <div className="p-6">
        {/* Featured Header */}
        {showFeaturedType && featuredTypeDisplays.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <FeaturedTypeBadges 
              featuredTypes={featuredTypeDisplays}
              maxVisible={3}
              size="sm"
            />
            {showStock && (
              <Badge variant={stockStatus.color as any} className="text-sm">
                {stockStatus.label}
              </Badge>
            )}
          </div>
        )}

        {/* Product Image */}
        <div className="relative h-64 mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 400px) 100vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-6xl">📦</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-3">
          {/* Name */}
          <h3 className="text-xl font-bold text-gray-900 line-clamp-2">
            {name}
          </h3>

          {/* Description */}
          {description && (
            <p className="text-gray-600 line-clamp-3">
              {description}
            </p>
          )}

          {/* Category */}
          {showCategory && (
            <Badge variant="default" className="text-sm">
              {categoryDisplay}
            </Badge>
          )}

          {/* SKU */}
          {showSKU && (
            <div className="text-sm text-gray-500">
              SKU: {sku}
            </div>
          )}

          {/* Price */}
          <div className="flex items-center justify-between pt-4 border-t">
            <SalePrice 
              product={{
                price: {
                  cents: price,
                  currency: 'USD',
                  formatted: formattedPrice
                },
                salePrice: salePrice
              }}
              variant="featured"
              showOriginalPrice={true}
              showDiscountPercentage={true}
              showDiscountAmount={true}
            />
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================
// GRID VARIANT
// ====================

function ProductGrid({
  name,
  stock,
  sku,
  price,
  featuredType,
  category,
  imageUrl,
  stockStatus,
  featuredTypeDisplays,
  categoryDisplay,
  formattedPrice,
  salePrice,
  showStock,
  showSKU,
  showFeaturedType,
  showCategory,
  onClick
}: ProductCardProps) {
  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className="relative h-40 bg-gray-100 rounded-lg overflow-hidden mb-3">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            sizes="(max-width: 200px) 100vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-3xl">📦</span>
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {showFeaturedType && featuredTypeDisplays.length > 0 && (
            <FeaturedTypeBadges 
              featuredTypes={featuredTypeDisplays}
              maxVisible={1}
              size="xs"
            />
          )}
          {showStock && (
            <Badge variant={stockStatus.color as any} className="text-xs">
              {stockStatus.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="space-y-1">
        <h4 className="font-medium text-gray-900 text-sm line-clamp-2">
          {name}
        </h4>
        
        {showCategory && (
          <Badge variant="default" className="text-sm">
            {categoryDisplay}
          </Badge>
        )}
        
        <div className="font-bold text-gray-900 text-sm">
          <SalePrice 
            product={{
              price: {
                cents: price,
                currency: 'USD',
                formatted: formattedPrice
              },
              salePrice: salePrice
            }}
            variant="compact"
            showOriginalPrice={false}
            showDiscountPercentage={true}
            showDiscountAmount={false}
          />
        </div>
      </div>
    </div>
  );
}

// ====================
// DETAIL VARIANT
// ====================

function ProductDetail({
  name,
  stock,
  sku,
  price,
  featuredType,
  category,
  description,
  imageUrl,
  brand,
  weight,
  dimensions,
  tags,
  createdAt,
  updatedAt,
  stockStatus,
  featuredTypeDisplays,
  categoryDisplay,
  formattedPrice,
  salePrice,
  showStock,
  showSKU,
  showFeaturedType,
  showCategory
}: ProductCardProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {name}
          </h1>
          
          <div className="flex items-center gap-3">
            {showCategory && (
              <Badge variant="default" className="text-sm">
                {categoryDisplay}
              </Badge>
            )}
            {showFeaturedType && featuredTypeDisplays.length > 0 && (
              <FeaturedTypeBadges 
                featuredTypes={featuredTypeDisplays}
                maxVisible={5}
                size="sm"
              />
            )}
            {showStock && (
              <Badge variant={stockStatus.color as any} className="text-sm">
                {stockStatus.label}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <SalePrice 
            product={{
              price: {
                cents: price,
                currency: 'USD',
                formatted: formattedPrice
              },
              salePrice: salePrice
            }}
            variant="detail"
            showOriginalPrice={true}
            showDiscountPercentage={true}
            showDiscountAmount={true}
          />
          {showSKU && (
            <div className="text-sm text-gray-500 mt-1">
              SKU: {sku}
            </div>
          )}
        </div>
      </div>

      {/* Product Image */}
      {imageUrl && (
        <div className="relative h-96 bg-gray-100 rounded-xl overflow-hidden">
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 800px) 100vw"
          />
        </div>
      )}

      {/* Description */}
      {description && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-gray-600 whitespace-pre-wrap">
            {description}
          </p>
        </div>
      )}

      {/* Product Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Product Details</h2>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-600">SKU:</dt>
              <dd className="font-medium">{sku}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Stock:</dt>
              <dd className="font-medium">{stock} units</dd>
            </div>
            {brand && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Brand:</dt>
                <dd className="font-medium">{brand}</dd>
              </div>
            )}
            {weight && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Weight:</dt>
                <dd className="font-medium">{weight}g</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Dimensions */}
        {dimensions && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Dimensions</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-600">Length:</dt>
                <dd className="font-medium">{dimensions.length}cm</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Width:</dt>
                <dd className="font-medium">{dimensions.width}cm</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Height:</dt>
                <dd className="font-medium">{dimensions.height}cm</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <Badge key={index} variant="default" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      {(createdAt || updatedAt) && (
        <div className="text-sm text-gray-500 border-t pt-4">
          {createdAt && <div>Created: {new Date(createdAt).toLocaleDateString()}</div>}
          {updatedAt && <div>Updated: {new Date(updatedAt).toLocaleDateString()}</div>}
        </div>
      )}
    </div>
  );
}
