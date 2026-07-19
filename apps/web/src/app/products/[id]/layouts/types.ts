/**
 * Shared types for product page layout system.
 *
 * These types define the layout routing, the props passed to layout wrappers,
 * and the mapping between storefront layouts and product page layouts.
 */

import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';
import { ProductOptionFlags } from '@/services/CapabilityResolutionService';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';
import { PublicCrmOptionsFlags } from '@/services/CapabilityResolutionService';

// ---------------------------------------------------------------------------
// Layout identifiers
// ---------------------------------------------------------------------------

/** Storefront layout identifiers (set by merchant in settings) */
export type StorefrontLayoutKey = 'classic' | 'editorial' | 'immersive';

/** Product page layout identifiers (derived from storefront layout) */
export type ProductLayoutKey = 'classic' | 'showcase' | 'quick-commerce';

/** Maps storefront layout → product page layout */
export const PRODUCT_LAYOUT_MAP: Record<StorefrontLayoutKey, ProductLayoutKey> = {
  classic: 'classic',
  editorial: 'showcase',
  immersive: 'quick-commerce',
} as const;

/** Maps storefront layout key → human-readable label */
export const STOREFRONT_LAYOUT_LABELS: Record<StorefrontLayoutKey, string> = {
  classic: 'Classic',
  editorial: 'Modern Editorial',
  immersive: 'Immersive Commerce',
} as const;

/** Maps product layout key → human-readable label */
export const PRODUCT_LAYOUT_LABELS: Record<ProductLayoutKey, string> = {
  classic: 'Classic',
  showcase: 'Product Showcase',
  'quick-commerce': 'Quick Commerce',
} as const;

// ---------------------------------------------------------------------------
// Layout props (shared by all product layout wrappers)
// ---------------------------------------------------------------------------

export interface GalleryImage {
  url: string;
  alt: string;
  caption: string | null;
  position: number;
}

/**
 * Props passed from page.tsx to each product layout wrapper.
 *
 * All three layouts receive exactly the same props — they just compose
 * the data differently.
 */
export interface ProductLayoutProps {
  // Product data
  product: any; // Full ProductData from page.tsx
  productWithGallery: any;
  gallery: GalleryImage[];

  // Tenant data
  tenantProfile: any;
  tenant: any;
  businessName: string;

  // Categories & navigation
  storefrontCategories: any;
  totalProducts: number;

  // Featured products
  merchantFilteredFeaturedTypes: string[];
  merchantFilteredGroupedProducts: Record<string, any[]>;
  bucketCounts?: Record<string, number>;

  // Capability flags
  optFlags: StorefrontOptionFlags | null;
  faqOptionsFlags: PublicFaqOptionsFlags | null;
  crmOptionsFlags: PublicCrmOptionsFlags | null;

  // Computed values
  currentUrl: string;
  isPubliclyAccessible: boolean;
  statusLabel: string;
  visibilityLabel: string;
  tenantInfoForStatus: any;
  structuredData: any;

  // Layout hint
  layoutVariant: ProductLayoutKey;
  spotlightCoupon?: any;
}

// ---------------------------------------------------------------------------
// Storefront layout props (shared by all storefront layout wrappers)
// ---------------------------------------------------------------------------

/**
 * Props passed from the storefront page.tsx to each storefront layout wrapper.
 *
 * Mirrors the StorefrontClientWrapperProps but with the addition of
 * layoutVariant for the new layout system.
 */
export interface StorefrontLayoutProps {
  tenantId: string;
  tenant: any;
  platformSettings: any;
  mapLocation: any;
  hasBranding: boolean;
  storeStatus: any;
  categories: any[];
  productCategories: any[];
  storeCategories: any[];
  uncategorizedCount: number;
  paymentGateways?: any[];
  businessName: string;
  businessHours?: any;
  search?: string;
  category?: string;
  featured?: string;
  view?: string;
  isProductsOnly: boolean;
  directoryPublished: boolean;
  tenantSlug: string;
  primaryGBPCategory: any;
  secondaryGBPCategories: any[];
  tier: string;
  features: any;
  totalAllProducts: number;
  fullWidthLayout?: boolean;
  products?: any[];
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  locationStatus?: string | null;
  statusInfo?: any;
  initialStorefrontOptionFlags?: StorefrontOptionFlags | null;
  initialCommerceSettings?: any;
  initialPaymentGatewaySettings?: any;
  initialStorefrontTypeSettings?: any;
  initialFaqFlags?: PublicFaqOptionsFlags | null;
  initialCrmFlags?: PublicCrmOptionsFlags | null;
  initialProductOptionFlags?: ProductOptionFlags | null;
  initialSocialCommerceFlags?: { enabled?: boolean; canUseShareButtons?: boolean; canUseSocialProof?: boolean } | null;

  // Layout hint
  layoutVariant: StorefrontLayoutKey;
  spotlightCoupon?: any;
}

// ---------------------------------------------------------------------------
// Utility: resolve product layout from storefront layout
// ---------------------------------------------------------------------------

export function resolveProductLayout(
  storefrontLayout?: string | null,
  previewLayout?: string | null,
): ProductLayoutKey {
  // Direct product layout preview (e.g. ?layout_preview=quick-commerce)
  const productLayouts: ProductLayoutKey[] = ['classic', 'showcase', 'quick-commerce'];
  if (previewLayout && productLayouts.includes(previewLayout as ProductLayoutKey)) {
    return previewLayout as ProductLayoutKey;
  }
  // Storefront layout preview (e.g. ?layout_preview=immersive → quick-commerce)
  if (previewLayout && previewLayout in PRODUCT_LAYOUT_MAP) {
    return PRODUCT_LAYOUT_MAP[previewLayout as StorefrontLayoutKey];
  }
  if (storefrontLayout && storefrontLayout in PRODUCT_LAYOUT_MAP) {
    return PRODUCT_LAYOUT_MAP[storefrontLayout as StorefrontLayoutKey];
  }
  return 'classic';
}

export function resolveStorefrontLayout(
  storefrontLayout?: string | null,
  previewLayout?: string | null,
): StorefrontLayoutKey {
  const valid: StorefrontLayoutKey[] = ['classic', 'editorial', 'immersive'];
  if (previewLayout && valid.includes(previewLayout as StorefrontLayoutKey)) {
    return previewLayout as StorefrontLayoutKey;
  }
  if (storefrontLayout && valid.includes(storefrontLayout as StorefrontLayoutKey)) {
    return storefrontLayout as StorefrontLayoutKey;
  }
  return 'classic';
}
