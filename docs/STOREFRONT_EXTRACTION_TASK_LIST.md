# Storefront Section Extraction — Task List for Completion

## Background

Three monolithic storefront layout files (2,982 lines total) are being refactored into composition-based architecture using extracted section components. The extraction phase is complete; the integration (composition) phase remains.

## Current State Audit

### Extracted Components (READY — do not modify)

All components live in `apps/web/src/components/storefront/sections/`.

| Component | File | Lines | Variants | Status |
|-----------|------|-------|----------|--------|
| `StorefrontHeader` | `StorefrontHeader.tsx` | 453 | classic, editorial, immersive | DONE |
| `ProductSection` | `ProductSection.tsx` | 764 | classic, editorial, immersive | DONE |
| `StoreInfoSection` | `StoreInfoSection.tsx` | ~530 | classic (info card), editorial, immersive | DONE |
| `StoreAboutSection` | `StoreInfoSection.tsx` (same file) | — | classic (about section, pre-products) | DONE |
| `FAQSection` | `FAQSection.tsx` | 60 | classic, editorial, immersive | DONE |
| `InquirySection` | `InquirySection.tsx` | 79 | classic, editorial, immersive | DONE |
| `ReviewsSection` | `ReviewsSection.tsx` | 45 | classic, editorial, immersive (null) | DONE |

### Shared Infrastructure (READY — do not modify)

| File | Purpose | Status |
|------|---------|--------|
| `apps/web/src/lib/storefront-sections.ts` | `resolveStorefrontSections()` — single source of truth for section visibility | DONE |
| `apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts` | Shared hook deriving all state (flags, contact, featured, etc.) | DONE |
| `apps/web/src/app/products/[id]/layouts/types.ts` | `StorefrontLayoutKey` type ('classic' \| 'editorial' \| 'immersive') | DONE |

### Layout Files (NEED REFACTORING)

| File | Lines | Status |
|------|-------|--------|
| `StorefrontClientWrapper.tsx` | 1262 | **PARTIAL** — imports added (lines 59-65) but body not yet refactored |
| `StorefrontEditorialLayout.tsx` | 1102 | **NOT STARTED** — fully inline |
| `StorefrontImmersiveLayout.tsx` | 618 | **NOT STARTED** — fully inline |

### Page Router (NO CHANGES NEEDED)

`apps/web/src/app/tenant/[id]/page.tsx` already routes to the correct layout component based on `storefrontLayout`. No changes needed here — the layout files themselves are what need refactoring.

---

## Tasks

### Task 1: Refactor `StorefrontClientWrapper.tsx` (Classic Layout)

**File:** `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx` (1262 lines → target ~250 lines)

**Current state:** Import statements for all 6 section components are already added (lines 59-65). The body still contains all inline markup.

**What to do:**

Replace the inline markup in the `return (...)` block with composition calls to the extracted components. The classic layout has this section order:

1. `<StorefrontHeader layoutVariant="classic" ... />`
2. `<SubscriptionStatusPanel ... />` (keep inline — not extracted)
3. `<StoreAboutSection layoutVariant="classic" ... />` (About the Store + social links, BEFORE products)
4. `<ProductSection layoutVariant="classic" ... />` (Featured nav + product catalog + featured showcase + products-only view)
5. `<StoreInfoSection layoutVariant="classic" ... />` (Hours + Contact + Map + Fulfillment, AFTER products)
6. `<CollapsibleCatalogSidebar ... />` (keep inline — not extracted)
7. `<FAQSection layoutVariant="classic" ... />`
8. `<InquirySection layoutVariant="classic" ... />`
9. `<ReviewsSection layoutVariant="classic" ... />`
10. `<StorefrontRecommendations ... />` (keep inline)
11. `<LastViewed />` (keep inline)
12. `<footer>...</footer>` (keep inline)

**Props to pass:** All props are already computed in the component body (logoUrl, storefrontStatus, hoursStatus, contactInfo, showsHours, showsMap, etc.). Pass them directly to the section components.

**Key gotchas:**
- The classic layout has a `StoreAboutSection` rendered BEFORE products and `StoreInfoSection` rendered AFTER. This split is intentional — see the `StoreAboutSection` export from `StoreInfoSection.tsx`.
- The `SubscriptionStatusPanel` stays inline (not a storefront section).
- The "Featured Navigation Controls" (Quick Jump buttons) at lines ~688-828 are part of `ProductSection`'s classic variant — they should be removed from the wrapper.
- The footer stays inline.
- `CollapsibleCatalogSidebar` at lines ~1104-1122 stays inline (not extracted).
- Remove now-unused imports (HoursStatusBadge, BusinessHoursCollapsible, GoogleMapEmbed, StorefrontMap, TenantMapSection, EnhancedProductDisplay, FeaturedBucketsShowcase, ProductSearch, ProductCategorySidebar, CategoryMobileDropdown, GBPCategoryBadges, DirectoryActions, FulfillmentOptionsPane, FaqStorefrontDisplay, PublicInquiryForm, StoreRatingDisplay, TenantQRCode, etc.) — only keep imports for components that remain inline.

**Verification:** After refactoring, the page at `/tenant/[id]` (default classic layout) should look identical. Check: header with logo/name/nav, about section, product catalog with sidebar + search, featured products, store hours card, contact card, map, FAQ accordion, inquiry form, reviews, recommendations, recently viewed, footer.

---

### Task 2: Refactor `StorefrontEditorialLayout.tsx` (Editorial Layout)

**File:** `apps/web/src/app/tenant/[id]/StorefrontEditorialLayout.tsx` (1102 lines → target ~200 lines)

**Current state:** Fully inline, no extracted component imports.

**What to do:**

1. Add imports for all section components:
```typescript
import { StorefrontHeader } from '@/components/storefront/sections/StorefrontHeader';
import { ProductSection } from '@/components/storefront/sections/ProductSection';
import { StoreInfoSection } from '@/components/storefront/sections/StoreInfoSection';
import { FAQSection } from '@/components/storefront/sections/FAQSection';
import { InquirySection } from '@/components/storefront/sections/InquirySection';
import { ReviewsSection } from '@/components/storefront/sections/ReviewsSection';
```

2. Replace inline markup with composition calls. The editorial layout has this section order:

1. `<StorefrontHeader layoutVariant="editorial" ... />`
2. Hero banner section (keep inline — not extracted, includes full-width image/gradient with store name)
3. Featured spotlight (keep inline — editorial-specific asymmetric grid, not extracted)
4. `<ProductSection layoutVariant="editorial" ... />` (product collection + search + category pills + product grid + pagination + products-only view + featured buckets)
5. `<StoreInfoSection layoutVariant="editorial" ... />` (editorial story section with about + social links + contact + 3-col store info cards with map/hours/contact)
6. `<ReviewsSection layoutVariant="editorial" ... />`
7. `<FAQSection layoutVariant="editorial" ... />`
8. `<InquirySection layoutVariant="editorial" ... />`
9. `<StorefrontRecommendations ... />` (keep inline)
10. `<LastViewed />` (keep inline)
11. `<StorefrontFooter ... />` (keep inline — editorial uses a shared footer component)

**Key gotchas:**
- The editorial layout uses `useStorefrontState` hook already — check if it's already imported and used. If so, use its returned values as props. If not, wire it up.
- The editorial hero banner and featured spotlight are editorial-specific and NOT extracted — keep them inline.
- The editorial layout may use a `StorefrontFooter` component — keep that inline.
- `primaryColor` prop defaults to `'#6366f1'` in the section components — pass the editorial layout's primary color if different.
- Remove now-unused imports after replacing inline markup.

**Verification:** After refactoring, the page at `/tenant/[id]?view=editorial` should look identical.

---

### Task 3: Refactor `StorefrontImmersiveLayout.tsx` (Immersive Layout)

**File:** `apps/web/src/app/tenant/[id]/StorefrontImmersiveLayout.tsx` (618 lines → target ~150 lines)

**Current state:** Fully inline, no extracted component imports.

**What to do:**

1. Add imports for all section components (same as Task 2).

2. Replace inline markup with composition calls. The immersive layout has this section order:

1. `<StorefrontHeader layoutVariant="immersive" ... />` (includes sticky search bar + trust signals bar)
2. Hero product strip (keep inline — immersive-specific, not extracted)
3. `<ProductSection layoutVariant="immersive" ... />` (filter bar with category chips + sort/view toggles + product grid + pagination + tabbed featured sections)
4. `<StoreInfoSection layoutVariant="immersive" ... />` (collapsible quick store info row with expandable details)
5. `<ReviewsSection layoutVariant="immersive" ... />` (returns null — immersive doesn't show reviews inline)
6. `<FAQSection layoutVariant="immersive" ... />`
7. `<InquirySection layoutVariant="immersive" ... />` (rendered in a side column layout)
8. `<LastViewed />` (keep inline)
9. Footer (keep inline)

**Key gotchas:**
- The immersive layout uses `SectionDivider` components between sections — check if these are in the extracted components or need to stay inline. The `ProductSection` immersive variant includes its own `SectionDivider` usage, but verify.
- The immersive `StoreInfoSection` is a collapsible card, not a full section — make sure the `infoExpanded` state is handled inside the component (it is — the component has its own `useState`).
- The immersive layout may use `StickySearchBar` and `TrustSignalsBar` — these are part of the extracted `StorefrontHeader` immersive variant, so remove them from the layout.
- `primaryColor` and `shippingText` props should be passed to `StorefrontHeader` for the immersive variant.
- Remove now-unused imports after replacing inline markup.

**Verification:** After refactoring, the page at `/tenant/[id]?view=immersive` should look identical.

---

### Task 4: TypeScript Check

**Command:** `cd apps/web && npx tsc --noEmit 2>&1 | head -50`

**What to check:**
- No type errors in any of the three refactored layout files
- No type errors in the section components
- No unused import warnings (the refactored files should have cleaned up imports)
- If there are errors, fix them. Common issues:
  - Missing props on section components (check the interface in each section file)
  - Type mismatches on `layoutVariant` (must be `StorefrontLayoutKey`)
  - `storefrontStatus` shape mismatch (must be `{ shouldShowPanel: boolean; tenant?: any }`)

---

### Task 5: Runtime Visual Verification

**What to check (manual browser testing):**

1. **Classic layout** (`/tenant/[id]`):
   - Header: logo, store name, category, nav pills, hours badge, directory actions
   - About section: description + social links + logo image
   - Product catalog: search bar, category sidebar, product grid, pagination
   - Featured products showcase
   - Store info: hours card, contact card, map, fulfillment options
   - FAQ accordion (if enabled)
   - Inquiry form (if enabled)
   - Reviews section with write review button
   - Recommendations + Recently viewed
   - Footer with quick links + platform branding

2. **Editorial layout** (`/tenant/[id]?view=editorial`):
   - Header: compact sticky bar with logo, name, cart, directory actions
   - Hero banner: full-width image/gradient with store name + CTA
   - Featured spotlight: asymmetric 2-col grid
   - Product collection: inline search, horizontal category pills, product grid, pagination
   - Featured buckets showcase
   - Editorial story section: 2-col with image + about text + social links + contact
   - Store info: 3-col cards (Visit Us with map, Hours, Get in Touch with fulfillment)
   - Reviews, FAQ, Inquiry, Recommendations, Recently viewed, Footer

3. **Immersive layout** (`/tenant/[id]?view=immersive`):
   - Header: sticky with search bar, cart, trust signals bar
   - Hero product strip
   - Filter bar with category chips + sort/view toggles
   - Product grid with list/grid views
   - Tabbed featured sections
   - Collapsible store info card (click to expand: about, hours, contact, social)
   - FAQ, Inquiry (side column), Recently viewed, Footer

---

## Summary Checklist

| Task | File | Target Lines | Status |
|------|------|-------------|--------|
| 1 | `StorefrontClientWrapper.tsx` | ~250 | PENDING |
| 2 | `StorefrontEditorialLayout.tsx` | ~200 | PENDING |
| 3 | `StorefrontImmersiveLayout.tsx` | ~150 | PENDING |
| 4 | TypeScript check | — | PENDING |
| 5 | Visual verification | — | PENDING |

## Rules for the Junior Agent

1. **Do NOT modify** any file in `apps/web/src/components/storefront/sections/` — these are complete.
2. **Do NOT modify** `apps/web/src/lib/storefront-sections.ts` or `apps/web/src/app/tenant/[id]/layouts/hooks/useStorefrontState.ts` — these are complete.
3. **Only modify** the three layout files listed in Tasks 1-3.
4. **Preserve all existing UI, UX, and conditional logic.** The goal is pure mechanical extraction — no visual or behavioral changes.
5. **Remove unused imports** after replacing inline markup — this keeps the diff clean and avoids lint warnings.
6. **Run `npx tsc --noEmit`** after each file refactoring to catch errors early.
7. **Test in the browser** after each layout refactoring — visual regressions are the primary risk.
8. **One file at a time** — complete and verify Task 1 before starting Task 2, etc.
9. **Use `edit` or `multi_edit` tools** for refactoring — never rewrite the entire file from scratch, as that risks losing subtle conditional logic.
10. **When in doubt about a prop**, check the section component's interface definition.
