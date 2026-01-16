'use client';

import { useState, useEffect } from 'react';
import VariantSelector, { ProductVariant } from './VariantSelector';
import { AddToCartButton } from './AddToCartButton';
import { PriceDisplay } from './PriceDisplay';

interface ProductWithVariantsProps {
  product: {
    id: string;
    sku: string;
    name: string;
    priceCents: number;
    salePriceCents?: number;
    stock: number;
    imageUrl?: string;
    tenantId: string;
    payment_gateway_type?: string | null;
    payment_gateway_id?: string | null;
    has_variants?: boolean;
  };
  tenantName: string;
  tenantLogo?: string;
  defaultGatewayType?: string;
  className?: string;
  showImage?: boolean;
  onImageChange?: (imageUrl: string | undefined) => void;
}

export default function ProductWithVariants({
  product,
  tenantName,
  tenantLogo,
  defaultGatewayType,
  className = '',
  showImage = false,
  onImageChange,
}: ProductWithVariantsProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | undefined>(product.imageUrl);
  const [variantPhotos, setVariantPhotos] = useState<Record<string, string[]>>({});

  // Fetch variants if product has them
  useEffect(() => {
    if (!product.has_variants) return;

    const fetchVariants = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/items/${product.id}/variants`);
        
        if (response.ok) {
          const data = await response.json();
          setVariants(data.variants || []);
        }
      } catch (error) {
        console.error('Failed to fetch variants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVariants();
  }, [product.id, product.has_variants]);

  // Fetch photos for all variants
  useEffect(() => {
    if (!product.has_variants || variants.length === 0) return;

    const fetchAllPhotos = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/items/${product.id}/photos`);
        
        if (response.ok) {
          const photos = await response.json();
          
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

  return (
    <div className={className}>
      {/* Optional Image Display */}
      {showImage && currentImage && (
        <div className="mb-4">
          <img
            src={currentImage}
            alt={selectedVariant?.variant_name || product.name}
            className="w-full h-auto rounded-lg"
          />
        </div>
      )}

      {/* Price Display */}
      <div className="mb-4">
        <PriceDisplay
          priceCents={effectivePrice}
          salePriceCents={effectiveSalePrice}
          variant="large"
        />
        {effectiveStock !== undefined && (
          <p className="text-sm text-gray-600 mt-1">
            {effectiveStock > 0 ? `${effectiveStock} in stock` : 'Out of stock'}
          </p>
        )}
      </div>

      {/* Variant Selector */}
      {product.has_variants && variants.length > 0 && (
        <div className="mb-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading options...</div>
          ) : (
            <VariantSelector
              variants={variants}
              onVariantSelect={setSelectedVariant}
              selectedVariantId={selectedVariant?.id}
            />
          )}
        </div>
      )}

      {/* Add to Cart Button */}
      <AddToCartButton
        product={{
          ...product,
          sku: effectiveSku,
          priceCents: effectivePrice,
          salePriceCents: effectiveSalePrice,
          stock: effectiveStock,
        }}
        variant={selectedVariant}
        tenantName={tenantName}
        tenantLogo={tenantLogo}
        defaultGatewayType={defaultGatewayType}
        className="w-full"
      />
    </div>
  );
}
