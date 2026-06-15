/**
 * Re-export layout types from the canonical source.
 *
 * The canonical type definitions live in app/products/[id]/layouts/types.ts.
 * Both product and storefront layouts share the same type system.
 */
export {
  type StorefrontLayoutKey,
  type ProductLayoutKey,
  PRODUCT_LAYOUT_MAP,
  STOREFRONT_LAYOUT_LABELS,
  PRODUCT_LAYOUT_LABELS,
  type GalleryImage,
  type ProductLayoutProps,
  type StorefrontLayoutProps,
  resolveProductLayout,
  resolveStorefrontLayout,
} from '@/app/products/[id]/layouts/types';
