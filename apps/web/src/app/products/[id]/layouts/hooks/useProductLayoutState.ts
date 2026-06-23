'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useProductDetailState } from './useProductDetailState';
import { StorefrontOptionFlags, ProductOptionFlags } from '@/services/CapabilityResolutionService';

interface UseProductLayoutStateArgs {
  product: any;
  tenant: any;
  initialOptFlags?: StorefrontOptionFlags | null;
  currentUrl?: string;
  productOptFlags?: ProductOptionFlags | null;
}

export function useProductLayoutState({
  product,
  tenant,
  initialOptFlags,
  currentUrl,
  productOptFlags,
}: UseProductLayoutStateArgs) {
  const detailState = useProductDetailState({
    product,
    tenant,
    initialOptFlags,
    currentUrl,
    productOptFlags,
  });

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const cartButtonRef = useRef<HTMLDivElement>(null);
  const variantSelectorRef = useRef<HTMLDivElement>(null);

  const lightboxImages = useMemo(() => {
    if (product.imageGallery && product.imageGallery.length > 0) {
      return product.imageGallery.slice(0, detailState.safeFeatures.maxGalleryImages).map(
        (img: { url: string; alt?: string; caption?: string }) => ({
          url: img.url,
          alt: img.alt || product.name,
          caption: img.caption || null,
        }),
      );
    }
    if (product.imageUrl) {
      return [{ url: product.imageUrl, alt: product.name, caption: null }];
    }
    return [];
  }, [product.imageGallery, product.imageUrl, product.name, detailState.safeFeatures.maxGalleryImages]);

  const handleGalleryImageClick = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const maxQuantity = detailState.currentStock || 999;

  const handleQuantityDecrement = useCallback(() => {
    detailState.setQuantity(Math.max(1, detailState.quantity - 1));
  }, [detailState.quantity, detailState.setQuantity]);

  const handleQuantityIncrement = useCallback(() => {
    detailState.setQuantity(Math.min(detailState.quantity + 1, maxQuantity));
  }, [detailState.quantity, maxQuantity, detailState.setQuantity]);

  const handleQuantityInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value) || 1;
      detailState.setQuantity(Math.min(Math.max(1, val), maxQuantity));
    },
    [maxQuantity, detailState.setQuantity],
  );

  const scrollToVariantSelector = useCallback(() => {
    variantSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const productTitle = product.title || product.name;
  const conditionLabel =
    product.condition === 'brand_new' || product.condition === 'new'
      ? 'New'
      : product.condition === 'used'
        ? 'Used'
        : product.condition === 'refurbished'
          ? 'Refurbished'
          : null;

  const effectiveAvailability = detailState.hasVariants
    ? detailState.selectedVariant
      ? detailState.currentAvailability
      : detailState.variantStockInfo?.isAvailable
        ? 'in_stock'
        : 'out_of_stock'
    : detailState.currentAvailability;

  const effectiveStock = detailState.hasVariants
    ? detailState.selectedVariant
      ? detailState.currentStock
      : detailState.variantStockInfo?.totalStock
    : detailState.currentStock;

  const categoryName =
    typeof product.tenantCategory === 'string'
      ? product.tenantCategory
      : product.tenantCategory?.name || product.category?.name || undefined;
  const categorySlug =
    product.tenantCategory?.slug || product.category?.slug || undefined;

  const metadata = tenant.metadata as any;
  const storeLogoUrl = metadata?.logo_url || detailState.displayLogo;

  return {
    ...detailState,
    lightboxOpen,
    setLightboxOpen,
    lightboxIndex,
    lightboxImages,
    cartButtonRef,
    variantSelectorRef,
    handleGalleryImageClick,
    maxQuantity,
    handleQuantityDecrement,
    handleQuantityIncrement,
    handleQuantityInput,
    scrollToVariantSelector,
    productTitle,
    conditionLabel,
    effectiveAvailability,
    effectiveStock,
    categoryName,
    categorySlug,
    storeLogoUrl,
  };
}
