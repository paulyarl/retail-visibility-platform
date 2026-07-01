/**
 * Feature Flag Type Definitions
 *
 * Flag state is server-authoritative. Use useFeatureFlag() hook from
 * @/hooks/useFeatureFlag to check flags in React components.
 * For non-react contexts, use NEXT_PUBLIC_FF_* env vars.
 */

export type FeatureFlag =
  | 'FF_MAP_CARD'
  | 'FF_SWIS_PREVIEW'
  | 'FF_BUSINESS_PROFILE'
  | 'FF_DARK_MODE'
  | 'FF_GOOGLE_CONNECT_SUITE'
  | 'FF_APP_SHELL_NAV'
  | 'FF_TENANT_URLS'
  | 'FF_CATEGORY_MANAGEMENT_PAGE'
  | 'FF_CATEGORY_QUICK_ACTIONS'
  | 'FF_ITEMS_V2_GRID'
  | 'FF_TENANT_GBP_CATEGORY_SYNC'
  | 'FF_CATEGORY_MIRRORING'
  | 'FF_SUPPLIER_CATALOG_IMPORT';
