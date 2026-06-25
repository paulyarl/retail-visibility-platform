'use client';

import { ProductRecommendations } from '@/components/products/ProductRecommendations';

interface ProductRecommendationsSectionProps {
  product: any;
  tenantId: string;
  tenantSlug: string;
  productOptFlags?: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
  storefrontType?: string;
}

export function ProductRecommendationsSection({
  product,
  tenantId,
  tenantSlug,
  productOptFlags: _productOptFlags,
  layoutVariant = 'classic',
  storefrontType,
}: ProductRecommendationsSectionProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <ProductRecommendations
        productId={product.id}
        tenantId={tenantId}
        tenantSlug={tenantSlug}
        priority={storefrontType === 'social' ? 'trending' : undefined}
      />
    </div>
  );
}
