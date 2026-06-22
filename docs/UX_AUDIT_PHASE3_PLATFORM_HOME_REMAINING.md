# Platform Home Page — Remaining Phase 3/4 Issues

> File: `apps/web/src/app/(platform)/page.tsx`
> Context: Phase 3 layout-stability cleanup removed the dead embedded header and the unreachable "authenticated badges" visitor block. The remaining items below are intentionally left for a later focused pass.

## 1. Public vs Authenticated Content Split

**Issue:** A single 1200+ line component renders both the marketing landing page and the authenticated platform dashboard. The two experiences share only `max-w-7xl` layout and the public footer.

**Risk:**
- Conditional blocks are easy to break when editing one audience.
- Bundle includes landing-page animations, marketing CTAs, and directory promos for every authenticated dashboard load.
- Future A/B tests or SEO changes on the landing page can leak into the dashboard.

**Recommended fix:**
Split into two route-level components:
- `app/(platform)/page.tsx` → authenticated dashboard only (move to `PlatformDashboard.tsx`).
- `app/(platform)/page.tsx` (or a dedicated `/landing` route) → public landing page (move to `PlatformLandingPage.tsx`).

## 2. `selectedTenantId` is Hard-Coded to `null`

**Issue:** `const selectedTenantId = null` (line 95 before cleanup) makes several authenticated sections unreachable:
- Banner hero section (`tenantData?.bannerUrl`) is never fetched.
- Business Hours card is never rendered because it requires `selectedTenantId`.
- Value Showcase "View Storefront" button is never rendered.
- `HoursStatusBadge` in the welcome section uses public scope only.

**Risk:**
- Authenticated users see a generic dashboard with no tenant context even when they have a current tenant.
- `useStoreStatus`, `tenantData`, `hoursInfo`, and related effects are effectively dead code.

**Recommended fix:**
- Resolve `selectedTenantId` from the current tenant context/hook (`useCurrentTenant` or similar), or
- Remove all `selectedTenantId`-dependent sections if the platform home is truly tenant-agnostic.

## 3. Fake / Derived Public Metrics

**Issue:** The visitor stats section still contains derived or hard-coded values:
- `storefrontsLive: Math.floor(activeTenants * 0.5)` — a made-up ratio.
- "Storefronts Live" label is paired with "total products" sub-label (mismatch).
- `platformUptime` falls back to `99.9` if not provided by the API.
- `active` items are computed as `Math.floor(platformStats.productsListed * 0.9)` — an estimate.

**Risk:**
- Misleading numbers for visitors and trust erosion.
- SEO/social proof claims may be inaccurate.

**Recommended fix:**
- Ask the backend to return only real, labeled metrics.
- Remove any derived metrics or clearly label them as estimates.
- Fix the visitor grid layout: `grid-cols-2 md:grid-cols-2 lg:grid-cols-4` is redundant; use `grid-cols-2 lg:grid-cols-4`.

## 4. Chain / Organization Overview Never Renders

**Issue:** `stats.isChain` is computed as `false` (line ~100) and `stats.organizationName` is `null` because `usePlatformComplete` platform data is not used.

**Risk:**
- The multi-location organization overview is dead code for all users.
- `stats` is built from the public `platformStats` state, not the user's organization context.

**Recommended fix:**
- Source `isChain` and `organizationName` from the authenticated user or tenant profile.
- Or remove the block if platform home is not the organization dashboard.

## 5. `usePlatformComplete` Under-Utilized

**Issue:** Only `loading` is consumed from `usePlatformComplete`. `data`, `error`, and `metrics` were previously ignored and are now dropped entirely.

**Risk:**
- The hook may be doing unnecessary work if the dashboard doesn't use its data.
- `metrics` is likely intended to populate the authenticated hero cards.

**Recommended fix:**
- Decide whether the platform dashboard should use `usePlatformComplete` data (and render real metrics) or remove the hook.
- If kept, render `metrics` in the authenticated KPI cards instead of `useCountUp` on the visitor stats.

## 6. Authenticated Dashboard Feels Empty

**Issue:** After removing the dead blocks, the authenticated view is: welcome header + generic KPIs + quick actions + getting started + directory promo + value showcase. There is no real tenant/platform context.

**Risk:**
- Users may not see why they are on this page versus the Tenant Dashboard.
- The "Platform Overview" value proposition is weak for authenticated users.

**Recommended fix:**
- If authenticated users should land here, show actionable platform-level items: recent tenants, pending alerts, system notices, or a quick tenant switcher.
- Consider redirecting authenticated users to `/tenants` or their last active tenant dashboard instead.

## 7. Mantine + Tailwind Mix Remains

**Issue:** The page still uses `@mantine/core` `Button` and `Card` alongside Tailwind classes.

**Risk:**
- Styling inconsistencies, especially with `variant="gradient"` and custom colors that override Tailwind tokens.
- SSR/CSR mismatch guard (`mounted` spinner) is still needed because of Mantine.

**Recommended fix:**
- Migrate to `shadcn/ui` or Tailwind-only buttons/cards during the next design-system pass.

## 8. Accessibility

**Issue:**
- Inline SVG icons have no accessible labels.
- Many cards use motion-only entrance animations; reduced-motion preferences are not respected.
- Marketing CTAs use only `motion` emphasis without visible focus rings in some gradients.

**Recommended fix:**
- Add `aria-hidden` or `title` to decorative SVGs.
- Wrap `framer-motion` in a `prefers-reduced-motion` check.
- Audit focus styles on gradient buttons.
