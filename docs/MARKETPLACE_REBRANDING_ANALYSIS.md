# Directory → Marketplace Reframing Analysis

**Date:** 2026-07-19
**Status:** Sprint Planning Document
**Decision:** Reframe customer-facing "directory" language as "marketplace" where appropriate, while retaining "directory" for code identifiers and internal admin surfaces.

---

## 1. Strategic Rationale

### Why "Marketplace" is the correct frame

The platform has marketplace capabilities — not just directory capabilities:

| Capability | Directory (Yelp-like) | Marketplace (Etsy-like) | Our Platform |
|---|---|---|---|
| Store profiles with browse/search | ✅ | ✅ | ✅ |
| Category browsing + GPS-aware discovery | ✅ | ✅ | ✅ |
| Product catalogs visible to shoppers | ❌ | ✅ | ✅ |
| Single shopper cart with multi-tenant items | ❌ | ✅ | ✅ |
| Per-tenant checkout (split per seller) | ❌ | ✅ | ✅ |
| Coupons redeemable per tenant | ❌ | ✅ | ✅ |
| Funnels / upsells per tenant | ❌ | ✅ | ✅ |
| Store reviews | ✅ | ✅ | ✅ |
| Promotion tiers, badges, featured placement | Partial | ✅ | ✅ |
| Social commerce integrations (Meta, TikTok) | ❌ | ✅ | ✅ |

**Conclusion:** The platform clears the marketplace bar. The per-tenant checkout model (single cart, split transactions per seller) is a proven marketplace pattern used by Etsy, Amazon Marketplace, and Tictail.

### Positioning statement

> "A GPS-aware local marketplace where shoppers discover and buy from nearby retailers in one cart."

The "local" + "GPS-aware" angle is the differentiator. Most marketplaces are national/global. This platform surfaces the toy store 3 blocks away with the item in stock.

---

## 2. Naming Strategy

### Three tiers of language

| Tier | Term | Where | Rationale |
|---|---|---|---|
| **Customer-facing marketing** | "Marketplace" | Landing pages, pitch decks, feature store, onboarding, SEO meta | Implies revenue opportunity, not just a listing |
| **Customer-facing product UI** | "Marketplace" (primary) / "Directory" (browse page only) | Shopper-facing headings, nav labels | "Marketplace" for the concept, "Directory" retained for the browse/discover page URL and breadcrumb |
| **Internal/admin/code** | "Directory" (unchanged) | Code identifiers, DB tables, admin panel labels, API routes | No churn, no functional benefit to renaming |

### Key principle

**Do NOT rename code-level identifiers.** Variables, services, routes, DB tables, Prisma models, component names — all stay "directory." Only user-visible text strings change.

---

## 3. Audit: Current "Directory" Usage in Customer-Facing Copy

### 3A. High-impact marketing surfaces (CHANGE to "marketplace")

These are first-impression surfaces where "marketplace" framing matters most:

| File | Current Text | Proposed Text | Surface |
|---|---|---|---|
| `apps/web/src/app/(platform)/page.tsx:443` | "…discoverable on Google, your storefront, and our **directory**…" | "…discoverable on Google, your storefront, and our **marketplace**…" | Landing page hero paragraph |
| `apps/web/src/app/(platform)/page.tsx:1021` | "Browse our curated **directory** of {N}+ retailers…" | "Browse our curated **marketplace** of {N}+ retailers…" | Landing page "Discover Online Presence" section |
| `apps/web/src/app/(platform)/page.tsx:1064` | "Browse **Directory**" (button) | "Browse **Marketplace**" | Landing page CTA button |
| `apps/web/src/app/features/page.tsx:225` | "Get discovered by shoppers browsing the Visible Shelf **marketplace** with enhanced **directory** listings." | "Get discovered by shoppers browsing the Visible Shelf **marketplace** with enhanced **store listings**." | Features page — already says "marketplace" but mixes in "directory" |
| `apps/web/src/app/features/page.tsx:227` | "Platform **directory** listing" | "Marketplace listing" | Features page benefit bullet |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx:19` | "Zero-Effort **Directory**" badge | "Zero-Effort **Marketplace**" badge | About page hero badge |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx:23` | "The Magic Behind This **Directory**" | "The Magic Behind Our **Marketplace**" | About page H1 |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx:35` | "Browse **Directory**" button | "Browse **Marketplace**" button | About page CTA |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx:76` | "2. This **Directory**" | "2. Our **Marketplace**" | About page "One Action, Three Benefits" |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx:147` | "**Directory** Updates Automatically" | "**Marketplace** Updates Automatically" | About page step 3 |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx:150` | "This **directory** rebuilds itself…" | "This **marketplace** rebuilds itself…" | About page step 3 description |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx:263` | "A Living, Breathing **Directory**" | "A Living, Breathing **Marketplace**" | About page result section |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx:267` | "This isn't a static list. It's a dynamic ecosystem…" | (keep — already marketplace-flavored) | About page result description |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx:275` | "Explore the **Directory**" | "Explore the **Marketplace**" | About page result CTA |
| `apps/web/src/components/directory/redesign/layouts/DirectoryDiscoveryLayout.tsx:197` | "Get your store listed in our **directory**…" | "Get your store listed in our **marketplace**…" | Directory layout merchant CTA |
| `apps/web/src/components/directory/redesign/layouts/DirectoryDiscoveryLayout.tsx:218` | "Discover the zero-effort magic behind this **directory**." | "Discover the zero-effort magic behind our **marketplace**." | Directory layout "How does this work?" |
| `apps/web/src/components/directory/redesign/layouts/DirectoryEditorialLayout.tsx:208` | "Get your store listed in our **directory**…" | "Get your store listed in our **marketplace**…" | Editorial layout merchant CTA |
| `apps/web/src/components/directory/redesign/layouts/DirectoryEditorialLayout.tsx:228` | "Discover the zero-effort magic behind this **directory**." | "Discover the zero-effort magic behind our **marketplace**." | Editorial layout "How does this work?" |

### 3B. Shopper-facing browse surfaces (CHANGE heading, KEEP breadcrumb)

| File | Current Text | Proposed Text | Notes |
|---|---|---|---|
| `apps/web/src/app/shops/directory/page.tsx:240` | "Shops **Directory**" heading | "Shop Our **Marketplace**" | Page heading |
| `apps/web/src/app/shops/directory/page.tsx:243` | "Discover amazing shops from our marketplace" | (keep — already says marketplace) | |
| `apps/web/src/app/shops/ShopsPageClient.tsx:993` | "Explore our marketplace of amazing stores" | (keep — already says marketplace) | |
| `apps/web/src/app/shops/ShopsPageClient.tsx:1199` | "Browse all stores in our marketplace" | (keep — already says marketplace) | |
| `apps/web/src/app/shops/[slug]/layout.tsx:13` | "Discover amazing shops and products from our marketplace" | (keep — already says marketplace) | Meta description |
| `apps/web/src/app/shops/featured/page.tsx:137` | "Highlighted products from our marketplace" | (keep — already says marketplace) | |
| `apps/web/src/app/shops/featured/page.tsx:144` | "Fresh products in the marketplace" | (keep — already says marketplace) | |
| `apps/web/src/app/shops/featured/page.tsx:370` | "Discover hand-picked products from our marketplace" | (keep — already says marketplace) | |
| Breadcrumb: `DirectoryEntryClassicLayout.tsx:86` | "Back to **Directory**" | "Back to **Marketplace**" | Breadcrumb link text |
| Breadcrumb: `DirectoryEntryEditorialLayout.tsx:73` | "Back to **Directory**" | "Back to **Marketplace**" | Breadcrumb link text |
| Breadcrumb: `DirectoryEntryImmersiveLayout.tsx:79` | "Back to **Directory**" | "Back to **Marketplace**" | Breadcrumb link text |
| Breadcrumb: `DirectoryEntryPremiumLayout.tsx:66` | "**Directory**" | "**Marketplace**" | Breadcrumb link text |
| Breadcrumb: `StoreTypeViewClient.tsx:225` | "**Directory**" breadcrumb | "**Marketplace**" | Category breadcrumb |
| `AllStoreTypesClient.tsx:80` | "Return to **Directory**" | "Return to **Marketplace**" | Error fallback link |
| `[slug]/page.tsx:558,784` | "Browse **Directory**" | "Browse **Marketplace**" | Back-link button on store pages |
| `t/[tenantId]/page.tsx:90` | "Browse **Directory**" | "Browse **Marketplace**" | Tenant pending page back-link |

### 3C. Merchant-facing dashboard surfaces (CHANGE to "marketplace")

| File | Current Text | Proposed Text | Notes |
|---|---|---|---|
| `apps/web/src/components/dashboard/VisibilityCards.tsx:163` | "Browse Platform **Directory**" | "Browse **Marketplace**" | Dashboard visibility card |
| `apps/web/src/components/dashboard/VisibilityCards.tsx:186` | "Your **Directory** Listing" | "Your **Marketplace** Listing" | Dashboard card heading |
| `apps/web/src/components/dashboard/VisibilityCards.tsx:128` | "Browse platform directory" (title attr) | "Browse marketplace" | Tooltip |
| `apps/web/src/components/dashboard/VisibilityCards.tsx:217` | "Browse platform directory" (title attr) | "Browse marketplace" | Tooltip |
| `apps/web/src/components/dashboard/VisibilityCards.tsx:221` | "Browse Platform **Directory**" | "Browse **Marketplace**" | Card button text |
| `apps/web/src/lib/growth-tips/tipEngine.ts:342` | "Publish your **directory** listing" | "Publish your **marketplace** listing" | Growth tip title |
| `apps/web/src/lib/growth-tips/tipEngine.ts:343` | "Your **directory** listing isn't published yet. Shoppers browsing the platform **marketplace** can't find you until it's live." | "Your **marketplace** listing isn't published yet. Shoppers browsing the **marketplace** can't find you until it's live." | Growth tip body (already uses "marketplace" in body) |
| `apps/web/src/components/storefront/sections/StorefrontHeader.tsx` | (check for "directory" references) | Update to "marketplace" | Storefront header |
| `apps/web/src/app/t/[tenantId]/settings/seo/page.tsx:167` | "**Directory** Meta Description" | "Marketplace Meta Description" | SEO settings heading |
| `apps/web/src/app/t/[tenantId]/settings/seo/page.tsx:169` | "…shown in **directory** search results…" | "…shown in **marketplace** search results…" | SEO settings description |
| `apps/web/src/app/t/[tenantId]/settings/seo/page.tsx:193` | "**Directory** Keywords" | "Marketplace Keywords" | SEO settings heading |
| `apps/web/src/app/t/[tenantId]/settings/seo/page.tsx:195` | "…find your store in the **directory** search." | "…find your store in the **marketplace** search." | SEO settings description |

### 3D. Tier/pricing surfaces (CHANGE to "marketplace")

| File | Current Text | Proposed Text | Notes |
|---|---|---|---|
| `apps/web/src/lib/tiers/tiers.ts:67,265,286,307,328` | "**Directory** listing" (tier feature bullet) | "Marketplace listing" | Repeated across 5 tier definitions |
| `apps/web/src/lib/tiers/content-consistency.ts:91` | "Platform **Directory** & Discovery" (marketing term) | "Platform **Marketplace** & Discovery" | Marketing term |
| `apps/web/src/lib/tiers/content-consistency.ts:92` | "**Directory** listing" (admin term) | (keep as "Directory listing" for admin) | Admin term stays |
| `apps/web/src/lib/tiers/content-consistency.ts:93` | "Enhanced **directory** listings with shopper inquiry system" | "Enhanced **marketplace** listings with shopper inquiry system" | Description |
| `apps/web/src/lib/tiers/chain-pricing.ts:42` | "Platform **directory** listing" | "Marketplace listing" | Chain pricing feature bullet |
| `apps/web/src/lib/tiers/chain-pricing.ts:43` | "Basic QR codes (product, storefront, **directory**)" | "Basic QR codes (product, storefront, marketplace)" | Chain pricing QR bullet |
| `apps/web/src/lib/tiers/chain-pricing.ts:69` | "Branded storefront inside Visible Shelf **marketplace** for chains" | (keep — already says marketplace) | |
| `apps/web/src/lib/tiers/chain-pricing.ts:81` | "Enhanced **directory** listing" | "Enhanced **marketplace** listing" | Chain pricing feature |
| `apps/web/src/lib/tiers/chain-pricing.ts:151` | "Priority **directory** placement" | "Priority **marketplace** placement" | Chain pricing feature |
| `apps/web/src/lib/tiers/feature-mapping.ts:141` | "Platform **Directory** & Discovery" (marketing benefit) | "Platform **Marketplace** & Discovery" | Feature mapping |
| `apps/web/src/lib/tiers/capability-display.ts:38` | "Directory Entry" (capability label) | "Marketplace Entry" | Capability display label |
| `apps/web/src/lib/tiers/capability-display.ts:40` | "Directory Promotion" (capability label) | "Marketplace Promotion" | Capability display label |
| `apps/web/src/app/features/page.tsx:32` | "Your store inside the Visible Shelf **marketplace**" | (keep — already says marketplace) | |
| `apps/web/src/app/features/page.tsx:485` | "Branded storefront inside Visible Shelf **marketplace**" | (keep — already says marketplace) | |
| `apps/web/src/app/(platform)/settings/offerings/page.tsx:325,593` | "**Directory** listing" | "Marketplace listing" | Offerings page feature bullets |

### 3E. Settings surfaces — merchant-facing (CHANGE to "marketplace")

| File | Current Text | Proposed Text | Notes |
|---|---|---|---|
| `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx:174` | "**Directory** Promotion" (h1) | "Marketplace Promotion" | Promotion settings heading |
| `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx:177` | "Stand out on the map and get more visibility for your store" | (keep) | |
| `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx:269` | "**Directory** Promotion Not Available" | "Marketplace Promotion Not Available" | Locked state heading |
| `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx:271` | "…promote your store on the **directory** map and search results." | "…promote your store on the **marketplace** map and search results." | Locked state description |
| `apps/web/src/app/t/[tenantId]/settings/promotion/analytics/PromotionAnalyticsClient.tsx:75` | "Track impressions, clicks, and ROI for your **directory** promotion" | "Track impressions, clicks, and ROI for your **marketplace** promotion" | Analytics description |
| `apps/web/src/app/t/[tenantId]/settings/products/badges/suggestions/BadgeSuggestionsClient.tsx:152` | "Promote your store on the **directory** map and search results…" | "Promote your store on the **marketplace** map and search results…" | Badge suggestion description |
| `apps/web/src/app/t/[tenantId]/settings/products/badges/suggestions/BadgeSuggestionsClient.tsx:155` | "Purchase a **directory** promotion to activate it." | "Purchase a **marketplace** promotion to activate it." | Badge suggestion note |
| `apps/web/src/app/t/[tenantId]/settings/featured-store/FeaturedStoreClient.tsx:615` | "Explore **Directory** Promotion" | "Explore **Marketplace** Promotion" | Featured store CTA |
| `apps/web/src/app/t/[tenantId]/settings/gbp-category/page.tsx:150` | "…sync to your **directory** listing" | "…sync to your **marketplace** listing" | GBP category step 3 |
| `apps/web/src/app/t/[tenantId]/settings/gbp-category/page.tsx:154` | "…which **directory** categories your GBP categories map to" | "…which **marketplace** categories your GBP categories map to" | GBP category step 4 |
| `apps/web/src/app/t/[tenantId]/settings/gbp-category/page.tsx:233` | "…which **directory** categories your store will appear in" | "…which **marketplace** categories your store will appear in" | GBP category check mappings |
| `apps/web/src/app/t/[tenantId]/settings/gbp-category/page.tsx:237` | "…won't appear in that **directory** category page" | "…won't appear in that **marketplace** category page" | GBP category unmapped warning |
| `apps/web/src/app/t/[tenantId]/settings/location-status/page.tsx:270` | "…affect storefront visibility, **directory** listings, and Google sync." | "…affect storefront visibility, **marketplace** listings, and Google sync." | Location status description |
| Storefront settings sidebar links (`StorefrontQrSettingsClient.tsx:870`, `StorefrontMapsSettingsClient.tsx:291`, `StorefrontHoursSettingsClient.tsx:285`, `StorefrontGallerySettingsClient.tsx:337`, `StorefrontLayoutsSettingsClient.tsx:304`) | "**Directory** Entry" + "View your store's public **directory** listing" | "Marketplace Entry" + "View your store's public **marketplace** listing" | Repeated across 5 settings pages |

### 3F. Admin-only surfaces (KEEP as "directory")

These are admin-internal and should NOT change:

- `apps/web/src/components/navigation/AdminNavContent.tsx:262` — "Directory" admin nav label
- `apps/web/src/components/navigation/SidebarLayout.tsx:354` — "Directory" sidebar label
- `apps/web/src/app/(platform)/settings/admin/directory/*` — All admin directory pages
- `apps/web/src/app/(platform)/settings/admin/promotion-catalog/PromotionCatalogClient.tsx:88` — "directory promotion plans" (admin description)
- `apps/web/src/app/(platform)/settings/admin/promotion-revenue/PromotionRevenueDashboard.tsx:90` — "directory promotions" (admin description)
- `apps/web/src/app/(platform)/settings/admin/page.tsx:1341,1360` — Admin cache clearing descriptions
- `apps/web/src/app/(platform)/settings/admin/limits/page.tsx:214,287` — Admin limits labels
- `apps/web/src/app/(platform)/settings/admin/featured-products/page.tsx:54` — Admin tab labels
- `apps/web/src/components/support/directory/*` — Support/troubleshooting pages
- `apps/web/src/components/tenant/ChangeLocationStatusModal.tsx:322` — "Directory" status label (admin context)

### 3G. Code identifiers (DO NOT CHANGE)

All of these stay "directory" — no functional benefit to renaming:

- Services: `DirectorySingletonService.ts`, `DirectoryService.ts`, `PublicDirectoryService.ts`, `DirectoryPromotionService.ts`, etc.
- Routes: `/api/directory/*`, `/api/promotion/*`
- DB tables: `directory_listings_list`, `mv_storefront_discovery`
- Prisma models: `DirectoryListing`, `DirectoryCategory`
- Component names: `DirectoryClient.tsx`, `DirectoryGrid.tsx`, `DirectoryMap.tsx`, etc.
- URL paths: `/directory`, `/shops/directory` (SEO equity + no redirect needed)
- Feature keys: `directory_listing`, `directory_promotion_*`, `directory_entry_*`
- Capability types: `directory_entry_options`, `directory_promotion`
- Navigation link IDs in `navigation_links` table

### 3H. Already uses "marketplace" (NO CHANGE NEEDED)

These already use marketplace language — good signal that the team has been moving in this direction:

- `apps/web/src/lib/tiers/content-consistency.ts:216` — "Your store inside the Visible Shelf marketplace"
- `apps/web/src/lib/tiers/chain-pricing.ts:69` — "Branded storefront inside Visible Shelf marketplace for chains"
- `apps/web/src/app/features/page.tsx:32,485` — "Your store inside the Visible Shelf marketplace"
- `apps/web/src/app/shops/ShopsPageClient.tsx:993,1199` — "Explore our marketplace" / "Browse all stores in our marketplace"
- `apps/web/src/app/shops/[slug]/layout.tsx:13` — "Discover amazing shops and products from our marketplace"
- `apps/web/src/app/shops/featured/page.tsx:137,144,370` — "from our marketplace" / "in the marketplace"
- `apps/web/src/app/shops/directory/page.tsx:243` — "Discover amazing shops from our marketplace"
- `apps/web/src/lib/growth-tips/tipEngine.ts:343` — "Shoppers browsing the platform marketplace"
- `apps/web/src/hooks/shops/useShopsFeaturedBuckets.ts:109` — "Fresh products just added to our marketplace"
- `apps/web/src/app/faq/page.tsx:103` — "No extra marketplace subscription"

---

## 4. Badge / Capability Label Updates

The `directory_promoted` badge and `directory_promotion` / `directory_entry_options` capability labels appear in merchant-facing UI:

| Location | Current | Proposed | Notes |
|---|---|---|---|
| `BadgeRegistryService.ts` (both frontend + backend) | label: "Directory Promoted", description: "Store is promoted on the **directory** map…" | label: "Marketplace Promoted", description: "Store is promoted on the **marketplace** map…" | Badge label shown to shoppers + merchants |
| `capability-display.ts:38` | "Directory Entry" | "Marketplace Entry" | Capability summary label |
| `capability-display.ts:40` | "Directory Promotion" | "Marketplace Promotion" | Capability summary label |
| `PlanSummaryPanel.tsx` | "Directory Entry" / "Directory Promotion" labels | "Marketplace Entry" / "Marketplace Promotion" | Plan summary display |
| `CapabilityShowcase.tsx` | "Directory Promotion" row label | "Marketplace Promotion" | Dashboard capability showcase |
| `TenantSettings.tsx` | Settings card titles with "Directory" | Update to "Marketplace" | Settings cards |
| `DynamicTenantSidebar.tsx` | Sidebar link labels with "Directory" | Update to "Marketplace" | Sidebar nav (DB-driven, may need SQL update too) |

**Note:** The badge *key* (`directory_promoted`) and capability *keys* (`directory_promotion`, `directory_entry_options`) stay unchanged in code. Only the display labels change.

---

## 5. Database Navigation Links

The `navigation_links` table drives the sidebar. Any link labels containing "Directory" need SQL updates:

```sql
-- Update navigation link labels (customer-facing only)
UPDATE navigation_links
SET label = REPLACE(label, 'Directory', 'Marketplace')
WHERE label LIKE '%Directory%'
  AND target = 'tenant';  -- Only tenant-facing links, not admin
```

**Audit needed:** Check which `navigation_links` rows contain "Directory" in their label and whether they're tenant-facing vs admin-facing before running the update.

---

## 6. SEO Considerations

### URL paths — KEEP `/directory`

- The `/directory` URL has SEO equity and inbound links
- URL paths are not user-facing in the same way as headings
- No redirects needed

### Meta descriptions — UPDATE

| File | Current | Proposed |
|---|---|---|
| `apps/web/src/app/shops/[slug]/layout.tsx:13` | "Discover amazing shops and products from our marketplace" | (keep — already marketplace) |
| `apps/web/src/app/directory/about/AboutDirectoryClient.tsx` | No meta description set | Add: "Discover how our local marketplace connects shoppers with nearby retailers automatically." |
| `apps/web/src/app/(platform)/page.tsx` | Landing page meta | Ensure "marketplace" appears in meta description |

### Structured data — UPDATE

- `LocalBusinessStructuredData` and `BreadcrumbStructuredData` in directory pages — review whether "directory" appears in any schema.org fields visible to search engines
- If the platform is being positioned as a marketplace, `schema.org/Marketplace` or related types could be considered for the root domain

---

## 7. Sprint Plan

### Sprint: Marketplace Reframing

**Goal:** Update all customer-facing text strings from "directory" to "marketplace" while leaving code identifiers, URL paths, and admin labels unchanged.

**Scope:** ~40-50 string edits across ~25 files. No backend changes. No DB migrations (except optional `navigation_links` label update).

**Tasks:**

1. **Landing page + about page** (~15 edits)
   - `(platform)/page.tsx` — hero paragraph, discover section, CTA button
   - `directory/about/AboutDirectoryClient.tsx` — all "directory" → "marketplace" in user-visible text

2. **Directory layout CTAs** (~4 edits)
   - `DirectoryDiscoveryLayout.tsx` — merchant CTA + "how does this work"
   - `DirectoryEditorialLayout.tsx` — merchant CTA + "how does this work"

3. **Shopper browse surfaces** (~8 edits)
   - `shops/directory/page.tsx` — heading
   - Breadcrumb links in 4 directory entry layouts
   - `StoreTypeViewClient.tsx` — breadcrumb
   - `AllStoreTypesClient.tsx` — error fallback
   - `[slug]/page.tsx` — back-link buttons (2x)
   - `t/[tenantId]/page.tsx` — back-link button

4. **Merchant dashboard surfaces** (~6 edits)
   - `VisibilityCards.tsx` — card heading, button text, tooltips
   - `tipEngine.ts` — growth tip title + body

5. **Tier/pricing surfaces** (~12 edits)
   - `tiers.ts` — 5 tier feature bullets
   - `content-consistency.ts` — marketing term + description
   - `chain-pricing.ts` — 4 feature bullets
   - `feature-mapping.ts` — marketing benefit
   - `capability-display.ts` — 2 capability labels
   - `offerings/page.tsx` — 2 feature bullets

6. **Merchant settings surfaces** (~15 edits)
   - `promotion/page.tsx` — heading, locked state
   - `promotion/analytics/PromotionAnalyticsClient.tsx` — description
   - `BadgeSuggestionsClient.tsx` — badge description + note
   - `FeaturedStoreClient.tsx` — CTA
   - `gbp-category/page.tsx` — 4 strings
   - `location-status/page.tsx` — 1 string
   - `seo/page.tsx` — 4 strings (headings + descriptions)
   - 5 storefront settings sidebar links — "Directory Entry" → "Marketplace Entry"

7. **Badge + capability display labels** (~6 edits)
   - `BadgeRegistryService.ts` (frontend + backend) — badge label + description
   - `PlanSummaryPanel.tsx` — capability labels
   - `CapabilityShowcase.tsx` — capability row label
   - `TenantSettings.tsx` — settings card titles
   - `DynamicTenantSidebar.tsx` — fallback sidebar labels

8. **Database navigation links** (optional SQL)
   - Audit `navigation_links` table for "Directory" labels
   - Update tenant-facing labels to "Marketplace"

9. **Verification**
   - `pnpm checkweb` — zero TS errors
   - `pnpm checkapi` — zero TS errors (badge label change only)
   - Manual visual review of landing page, about page, directory browse page, merchant dashboard, settings pages
   - Verify no admin labels were changed

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Inconsistency if some strings are missed | Medium | Low (cosmetic) | This audit is comprehensive; grep verification after sprint |
| SEO ranking fluctuation from heading changes | Low | Medium | URL paths unchanged; 301 redirects not needed; Google re-indexes headings naturally |
| Admin users confused by "Marketplace" in admin panel | Low | Low | Admin labels intentionally kept as "Directory" |
| Badge key mismatch (code uses `directory_promoted`, UI says "Marketplace Promoted") | None | None | Key is an identifier, label is display text — standard pattern in the codebase |
| Navigation links DB out of sync with fallback labels | Medium | Low | SQL update in task 8; fallback labels updated in task 7 |

---

## 9. Future Considerations (Out of Scope)

- **Unified product search across all merchants** — Currently directory search is store-level. A marketplace-level product search (like Etsy's) would further strengthen the marketplace positioning.
- **Marketplace-level buyer protections** — Return policies, dispute resolution, buyer guarantee program.
- **Cross-store "Add to cart" from directory** — Currently shoppers visit individual store pages. Allowing add-to-cart directly from directory cards would enhance marketplace feel.
- **Marketplace review system for buyers** — Buyer profiles with review history (currently only store reviews exist).
- **`schema.org/Marketplace` structured data** — For the root domain, once marketplace positioning is live.
