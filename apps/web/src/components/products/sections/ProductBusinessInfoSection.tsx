'use client';

import { AvailableNearby } from '@/components/products/AvailableNearby';
import ProductBusinessInfoWrapper from '@/components/products/ProductBusinessInfoWrapper';
import { ProductOptionFlags, StorefrontOptionFlags } from '@/services/CapabilityResolutionService';

interface ProductBusinessInfoSectionProps {
  product: any;
  tenantProfile: any;
  productOptFlags?: ProductOptionFlags | null;
  optFlags?: StorefrontOptionFlags | null;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ProductBusinessInfoSection({
  product,
  tenantProfile,
  productOptFlags,
  optFlags,
  layoutVariant = 'classic',
}: ProductBusinessInfoSectionProps) {
  return (
    <>
      {/* Available Nearby - Cross-Tenant Product Discovery */}
      {productOptFlags?.showsLocationAvailability !== false && product.productSlug && product.otherTenantsCount && product.otherTenantsCount > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <AvailableNearby
            productSlug={product.productSlug}
            currentTenantId={product.tenantId}
            className="w-full max-w-md mx-auto"
          />
        </div>
      )}

      {/* Business Information - Contact Us - Full Width */}
      {product.productType != 'digital' ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ProductBusinessInfoWrapper
            product={product}
            tenant={{
              id: product.tenantId || tenantProfile?.id || '',
              name: tenantProfile?.profileData?.businessName || tenantProfile?.profileData?.business_name || product.tenant?.name || '',
              metadata: {
                businessName: tenantProfile?.profileData?.businessName || tenantProfile?.profileData?.business_name,
                businessDescription: tenantProfile?.profileData?.business_description || tenantProfile?.profileData?.businessDescription,
                phone: tenantProfile?.profileData?.phone_number,
                email: tenantProfile?.profileData?.email,
                website: tenantProfile?.profileData?.website,
                address: tenantProfile?.profileData?.state == null ? '' : `${tenantProfile?.profileData?.address_line1}, ${tenantProfile?.profileData?.city}, ${tenantProfile?.profileData?.state} ${tenantProfile?.profileData?.postal_code}`,
                logoUrl: tenantProfile?.profileData?.logo_url,
                socialLinks: tenantProfile?.profileData?.social_links || undefined,
              }
            }}
            initialOptFlags={optFlags}
          />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Digital Product
          </h2>
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
            Download link will be available after successful checkout.
          </p>
        </div>
      )}
    </>
  );
}
