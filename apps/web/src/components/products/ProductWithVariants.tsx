'use client';

import { useState, useEffect } from 'react';
import VariantSelector, { ProductVariant } from './VariantSelector';
import VariantAttributeDisplay, { VariantComparisonGrid } from './VariantAttributeDisplay';
import { AddToCartButton } from './AddToCartButton';
import { SalePrice } from './SalePrice';
import { FeaturedTypeBadges } from './FeaturedTypeBadges';
import { Badge } from '@/components/ui/Badge';
import { getFeaturedTypeDisplay, FeaturedType } from '@/types/product-display';
import { useVariantsSingleton } from '@/lib/singletons/VariantsSingleton';
import { getEnhancedTenantFeaturedProductsSingleton } from '@/lib/singletons/EnhancedTenantFeaturedProductsSingleton';

interface ProductWithVariantsProps {
  product: {
    id: string;
    sku: string;
    name: string;
    priceCents: number;
    salePriceCents?: number;
    stock: number;
    imageUrl?: string;
    description?: string;
    has_variants?: boolean;
    featuredType?: string;
    featuredPriority?: number;
    isFeaturedActive?: boolean;
    has_active_payment_gateway?: boolean;
    payment_gateway_type?: string | null;
  };
  tenantId: string;
  tenantName: string;
  tenantLogo?: string;
  defaultGatewayType?: string;
  hasActivePaymentGateway?: boolean;
  className?: string;
  showImage?: boolean;
  onImageChange?: (imageUrl: string | undefined) => void;
  /** When true, skip rendering product name/price/stock/SKU (parent card already shows them) */
  compact?: boolean;
}

export default function ProductWithVariants({
  product,
  tenantId,
  tenantName,
  tenantLogo,
  defaultGatewayType,
  hasActivePaymentGateway,
  className = '',
  showImage = false,
  onImageChange,
  compact = false,
}: ProductWithVariantsProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | undefined>(product.imageUrl);
  const [variantPhotos, setVariantPhotos] = useState<Record<string, string[]>>({});
  const [variantFeaturedTypes, setVariantFeaturedTypes] = useState<Record<string, any>>({});

  // Initialize VariantsSingleton
  const { actions: variantsActions } = useVariantsSingleton(tenantId);

  // Fetch variants if product has them
  useEffect(() => {
    if (!product.has_variants) return;

    const fetchVariants = async () => {
      setLoading(true);
      try {
        const result = await variantsActions.fetchItemVariants(product.id);
        
        if (result.success && result.variants) {
          setVariants(result.variants);
          
          // Fetch featured types for each variant
          if (result.variants.length > 0) {
            await fetchVariantFeaturedTypes(result.variants);
          }
        }
      } catch (error) {
        console.error('Failed to fetch variants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVariants();
  }, [product.id, product.has_variants]);

  // Fetch featured types for variants
  const fetchVariantFeaturedTypes = async (variants: ProductVariant[]) => {
    try {
      const featuredTypesMap: Record<string, any> = {};
      const featuredManager = getEnhancedTenantFeaturedProductsSingleton('default');
      
      for (const variant of variants) {
        const featuredData = await featuredManager.getFeaturedTypes(variant.id);
        if (featuredData) {
          featuredTypesMap[variant.id] = featuredData.featuredTypes || [];
        }
      }
      
      setVariantFeaturedTypes(featuredTypesMap);
    } catch (error) {
      console.error('Failed to fetch variant featured types:', error);
    }
  };

  // Fetch photos for all variants
  useEffect(() => {
    if (!product.has_variants || variants.length === 0) return;

    const fetchAllPhotos = async () => {
      try {
        const featuredManager = getEnhancedTenantFeaturedProductsSingleton('default');
        const photos = await featuredManager.getProductPhotos(product.id);
        
        if (photos) {
          // Group photos by variant_id
          const photosByVariant: Record<string, string[]> = {};
          const parentPhotos: string[] = [];
          
          photos.forEach((photo: any) => {
            if (photo.variant_id) {
              if (!photosByVariant[photo.variant_id]) {
                photosByVariant[photo.variant_id] = [];
              }
              photosByVariant[photo.variant_id].push(photo.url);
            } else {
              parentPhotos.push(photo.url);
            }
          });
          
          // Store parent photos under 'parent' key
          if (parentPhotos.length > 0) {
            photosByVariant['parent'] = parentPhotos;
          }
          
          setVariantPhotos(photosByVariant);
        }
      } catch (error) {
        console.error('Failed to fetch photos:', error);
      }
    };

    fetchAllPhotos();
  }, [product.id, product.has_variants, variants.length]);

  // Update current image when variant is selected
  useEffect(() => {
    if (selectedVariant?.id && variantPhotos[selectedVariant.id]?.length > 0) {
      // Use first photo from variant's photos
      setCurrentImage(variantPhotos[selectedVariant.id][0]);
    } else if (selectedVariant?.image_url) {
      // Fallback to variant's image_url field
      setCurrentImage(selectedVariant.image_url);
    } else if (variantPhotos['parent']?.length > 0) {
      // Fallback to parent photos
      setCurrentImage(variantPhotos['parent'][0]);
    } else {
      // Final fallback to product imageUrl
      setCurrentImage(product.imageUrl);
    }
  }, [selectedVariant, variantPhotos, product.imageUrl]);

  // Notify parent component when image changes
  useEffect(() => {
    if (onImageChange) {
      onImageChange(currentImage);
    }
  }, [currentImage, onImageChange]);

  // Get effective price and stock based on variant selection
  const effectivePrice = selectedVariant?.price_cents || product.priceCents;
  const effectiveSalePrice = selectedVariant?.sale_price_cents || product.salePriceCents;
  const effectiveStock = selectedVariant?.stock ?? product.stock;
  const effectiveSku = selectedVariant?.sku || product.sku;

  // Get effective featured type (variant takes precedence over parent)
  const getEffectiveFeaturedType = () => {
    if (selectedVariant?.id && variantFeaturedTypes[selectedVariant.id]) {
      return variantFeaturedTypes[selectedVariant.id];
    }
    if (product.featuredType) {
      return getFeaturedTypeDisplay(product.featuredType as FeaturedType);
    }
    return [];
  };

  const effectiveFeaturedTypes = getEffectiveFeaturedType();

  // Check if product/variant is on sale
  const isOnSale = !!(effectiveSalePrice && effectiveSalePrice < effectivePrice);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Optional Image Display */}
      {!compact && showImage && currentImage && (
        <div className="relative">
          <img
            src={currentImage}
            alt={selectedVariant?.variant_name || product.name}
            className="w-full h-auto rounded-lg"
          />
          {isOnSale && (
            <div className="absolute top-4 left-4">
              <Badge variant="error" className="text-sm font-bold">
                SALE
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Product Name and Featured Types - skip in compact mode (parent card shows these) */}
      {!compact && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {product.name}
          </h1>
          {effectiveFeaturedTypes.length > 0 && (
            <div className="mb-3">
              <FeaturedTypeBadges 
                featuredTypes={effectiveFeaturedTypes}
                maxVisible={3}
                size="sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Price Display with Smart Sale Tagging - skip in compact mode */}
      {!compact && (
        <div className="space-y-2">
          <SalePrice 
            product={{
              price: {
                cents: effectivePrice,
                currency: 'USD',
                formatted: `$${(effectivePrice / 100).toFixed(2)}`
              },
              salePrice: effectiveSalePrice ? {
                cents: effectiveSalePrice,
                currency: 'USD',
                formatted: `$${(effectiveSalePrice / 100).toFixed(2)}`
              } : undefined
            }}
            variant="detail"
            showOriginalPrice={true}
            showDiscountPercentage={true}
            showDiscountAmount={true}
          />
          
          {/* Stock Status */}
          <div className="flex items-center gap-2">
            {effectiveStock !== undefined && (
              <Badge variant={effectiveStock > 0 ? 'success' : 'error'}>
                {effectiveStock > 0 ? `${effectiveStock} in stock` : 'Out of stock'}
              </Badge>
            )}
            
            {/* SKU */}
            <span className="text-sm text-gray-500">
              SKU: {effectiveSku}
            </span>
            
            {/* Variant Name */}
            {selectedVariant?.variant_name && (
              <Badge variant="default" className="text-xs">
                {selectedVariant.variant_name}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Selected variant info in compact mode */}
      {compact && selectedVariant?.variant_name && (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs">
            {selectedVariant.variant_name}
          </Badge>
        </div>
      )}

      {/* Variant Selector */}
      {product.has_variants && variants.length > 0 && (
        <div className={compact ? '' : 'border-t pt-6'}>
          {!compact && <h3 className="text-lg font-semibold mb-4">Select Options</h3>}
          {loading ? (
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">Loading options...</div>
            </div>
          ) : (
            <VariantSelector
              variants={variants}
              onVariantSelect={setSelectedVariant}
              selectedVariantId={selectedVariant?.id}
            />
          )}
        </div>
      )}

      {/* Variant Comparison - skip in compact mode */}
      {!compact && product.has_variants && variants.length > 1 && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Available Variants</h3>
          <VariantComparisonGrid
            variants={variants}
            onVariantSelect={setSelectedVariant}
            selectedVariantId={selectedVariant?.id}
          />
          
          {variants.length > 6 && (
            <p className="text-sm text-gray-500 text-center mt-4">
              Showing {Math.min(6, variants.length)} of {variants.length} variants. Select options above to see all.
            </p>
          )}
        </div>
      )}

      {/* Add to Cart Button */}
      <div className={compact ? '' : 'border-t pt-6'}>
        {loading && compact ? (
          <div className="text-center py-2">
            <div className="text-sm text-gray-500">Loading options...</div>
          </div>
        ) : (
          <>
            <AddToCartButton
              product={{
                ...product,
                sku: effectiveSku,
                priceCents: effectivePrice,
                salePriceCents: effectiveSalePrice,
                stock: effectiveStock,
                tenantId,
              }}
              variant={selectedVariant}
              tenantName={tenantName}
              tenantLogo={tenantLogo}
              defaultGatewayType={defaultGatewayType}
              hasActivePaymentGateway={hasActivePaymentGateway}
              className="w-full"
              layout="stacked"
            />
            
            {effectiveStock <= 0 && (
              <p className="text-sm text-red-600 text-center mt-2">
                This item is currently out of stock
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
