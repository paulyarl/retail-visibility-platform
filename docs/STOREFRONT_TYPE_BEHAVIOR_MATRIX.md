# Storefront Type Behavior Matrix

This document describes how each storefront type renders across all surfaces. Established through Storefront Phases 0-4.

## Type Values

| Type | Description | Tier Feature |
|------|-------------|--------------|
| `retail` | Physical retail store with product catalog | `storefront_retail` |
| `online` | Online-only store, no physical location emphasis | `storefront_online` |
| `service` | Service-based business with booking CTAs | `storefront_service` |
| `social` | Social commerce storefront (TikTok/Instagram) | `storefront_social` |
| `flexible` | All types enabled (retail + online + service + social) | `storefront_flexible` |
| `none` | Storefront disabled or minimal placeholder | (no feature) |

## Type Flag Derivation

All type flags are derived in `useStorefrontState.ts` and `storefront-sections.ts`:

```typescript
const isRetailStore  = type === 'retail'  || type === 'flexible';
const isOnlineStore  = type === 'online'  || type === 'flexible';
const isServiceStore = type === 'service' || type === 'flexible';
const isSocialStore  = type === 'social'  || type === 'flexible';
```

`flexible` enables ALL type flags. `none` enables NONE.

## Section Visibility Matrix

| Section | Gate | retail | online | service | social | flexible | none |
|---------|------|--------|--------|---------|--------|----------|------|
| ProductSection | `isStorefrontEnabled` | Yes | Yes | Yes | Yes | Yes | Yes* |
| ServiceSection | `product_service_enabled` | If enabled | If enabled | Yes | If enabled | If enabled | If enabled |
| SocialProofSection | `showSocialProof` | No | No | No | Yes | Yes | No |
| StoreInfo | `isRetailStore` | Yes | No | No | No | Yes | No |
| Reviews | Always | Yes | Yes | Yes | Yes | Yes | Yes |
| FAQ | `faq_enabled && faq_display_storefront_accordion` | If enabled | If enabled | If enabled | If enabled | If enabled | If enabled |
| InquiryForm | `crm_enabled && crm_inquiry_storefront_enabled` | If enabled | If enabled | If enabled | If enabled | If enabled | If enabled |
| Recommendations | `isRetailStore && showRecommendStore` | Yes | No | No | No | Yes | No |
| CatalogSidebar | `isRetailStore && showCategoryProduct` | Yes | No | No | No | Yes | No |
| FeaturedBuckets | `isStorefrontEnabled` | Yes | Yes | Yes | Yes | Yes | Yes* |

*When `none`, `isStorefrontEnabled` may still be true — sections render but type-specific emphasis is off.

## Behavior Overlay Matrix (Social Commerce)

| Behavior | Gate | retail | online | service | social | flexible | none |
|----------|------|--------|--------|---------|--------|----------|------|
| Share buttons in ProductSection | `socialCommerceFlags.enabled && canUseShareButtons && isSocialStore` | No | No | No | Yes | Yes | No |
| Share buttons in ServiceSection | `socialCommerceFlags.enabled && canUseShareButtons && isSocialStore` | No | No | No | Yes | Yes | No |
| Social proof badges (product detail) | `showSocialProof` | No | No | No | Yes | Yes | No |
| Trending sort in recommendations | `storefrontType === 'social'` | No | No | No | Yes | No* | No |

*`flexible` does not trigger trending sort because `storefrontType` is `'flexible'`, not `'social'`. This is intentional — flexible stores show all features but don't override product sorting.

## SEO Metadata Matrix

### Tenant Storefront Page (`/tenant/[id]`)

| Type | Page Title | Meta Description | Schema.org Type |
|------|-----------|------------------|----------------|
| `retail` | `{businessName} - Store Catalog` | Browse products from {businessName} | `Store` |
| `online` | `{businessName} - Online Store` | Shop online from {businessName} | `OnlineStore` |
| `service` | `{businessName} - Services` | Book professional services from {businessName} | `Service` |
| `social` | `{businessName} - Shop` | Discover and shop from {businessName} | `Store` |
| `flexible` | `{businessName} - Store & Services` | Browse products and services from {businessName} | `Store` |
| `none` | `{businessName} - Storefront` | View store from {businessName} | `Store` |

### Product Detail Page (`/products/[id]`)

| Type | Title Format | OG Description Verb |
|------|-------------|---------------------|
| `service` | `{product} - {business}` | Book |
| `social` | `{product} \| {business}` | Discover |
| Other | `{product} - {business}` | Buy |

## Analytics Events

| Event | Trigger | Surface | Context Fields |
|-------|---------|---------|----------------|
| `storefront_viewed` | Storefront page load | Tenant page | `storefront_type`, `categories_viewed`, `is_storefront` |
| `social_share_clicked` | Click on share button | Storefront sections (ProductSection, ServiceSection) | `platform`, `shared_url`, `shared_title`, `layout_variant` |
| `category_browsed` | Category filter click | Tenant page | `category_id`, `category_slug` |
| `product_viewed` | Product detail page load | Product page | `product_id`, standard product fields |

## Surface Coverage Audit

| Surface | Type-aware? | Files |
|---------|-------------|-------|
| Storefront (Classic) | Yes — all types | `StorefrontClientWrapper.tsx` |
| Storefront (Editorial) | Yes — all types | `StorefrontEditorialLayout.tsx` |
| Storefront (Immersive) | Yes — all types | `StorefrontImmersiveLayout.tsx` |
| Product Detail (Showcase) | Yes — social overlay | `ProductShowcaseLayout.tsx` |
| Product Detail (QuickCommerce) | Yes — social overlay | `ProductQuickCommerceLayout.tsx` |
| Directory Page | Partial — retail/online/service only | `app/directory/[slug]/page.tsx` |
| Landing Page | Yes — all types | `TierBasedLandingPage.tsx` |
| SEO (Tenant) | Yes — type-specific metadata | `app/tenant/[id]/page.tsx` `generateMetadata()` |
| SEO (Product) | Yes — type-specific OG | `app/products/[id]/page.tsx` `generateMetadata()` |
| Analytics | Yes — `storefront_type` in events | `behaviorTracking.ts`, `SocialShareButtons.tsx` |

## Capability Flag Systems

Two independent flag chains control storefront behavior:

| System | Interface | Fetcher | Controls |
|--------|-----------|---------|----------|
| Product Options | `ProductOptionFlags` | `getProductOptionFlags()` | Section visibility (services, gallery, etc.) |
| Social Commerce | `SocialCommerceOptionsState` | `getSocialCommerceOptionsState()` | Share buttons, social proof |

Both follow the same prop chain: `page.tsx (server fetch) → layout props → useStorefrontState hook → section components`.
