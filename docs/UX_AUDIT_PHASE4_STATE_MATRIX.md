# UX Phase 4 — State & Copy Validation Matrix

> **Date:** 2026-06-21  
> **Scope:** Per-screen audit of loading, empty, error, disabled, success, pending, destructive confirmation, and copy quality for all screens touched in Phase 3.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Present and actionable |
| ⚠️ | Present but needs improvement |
| ❌ | Missing — user gets no feedback |
| N/A | Not applicable for this screen |

---

## 1. Tenant Dashboard (`TenantDashboardV2.tsx`)

| State | Status | Notes |
|---|---|---|
| Loading | ✅ | `DashboardSkeleton` component shown |
| Error | ✅ | Centered error card with message |
| Empty | ⚠️ | No explicit empty state — dashboard renders with zero values (e.g. "0" orders, "0" products). Task checklist guides next steps, but no "welcome" empty state for brand-new tenants |
| Disabled | N/A | |
| Success | N/A | |
| Pending | ⚠️ | Refresh button has no loading spinner — `refreshTenantData()` called but no visual feedback while fetching |
| Destructive | N/A | |

### Copy Issues
- **Line 189:** `"Store dashboard"` — generic fallback. Should use tenant name or "Your dashboard" if name is missing.
- **Line 192:** `"Welcome back, {firstName}. Here's what's happening today."` — apostrophe encoded correctly via `&apos;`. OK.
- **Line 49–51:** Demo sparkline data (`DEMO_ORDERS`, `DEMO_PRODUCTS`) still hardcoded — labels say "Orders" and "Products Live" but sparklines show fake trends. Misleading.

### Action Items
1. **Add refresh loading state:** Disable refresh button and show spinner while `refreshTenantData()` is in flight.
2. **Remove demo sparkline data:** Either remove sparklines entirely or wire to real historical data.
3. **Add empty state for new tenants:** When `usage?.orders === 0 && usage?.activeItems === 0`, show a welcome onboarding card instead of zero-value KPIs.

---

## 2. Platform Home (`(platform)/page.tsx`)

| State | Status | Notes |
|---|---|---|
| Loading | ✅ | Full-page spinner with "Loading..." text while mounting |
| Error | ❌ | No error state — if `platformStats` fetch fails, all stats show "0" silently |
| Empty | N/A | Marketing page — always has content |
| Disabled | N/A | |
| Success | N/A | |
| Pending | ⚠️ | Stats fetch has no loading indicator — numbers pop in after fetch completes |
| Destructive | N/A | |

### Copy Issues
- **Line 90:** `Math.floor(platformStats.productsListed * 0.9)` — fake "active" estimate. Comment says "Estimate active items". Misleading metric.
- **Line 96:** `//console.log('Platform stats:', stats);` — commented-out console log left in code.

### Action Items
1. **Add error state for stats fetch:** If fetch fails, show a subtle "Stats temporarily unavailable" message instead of zeros.
2. **Remove fake active estimate:** Remove the `* 0.9` calculation or label it clearly as an estimate.
3. **Remove commented-out console.log** on line 96.

---

## 3. Checkout (`checkout/page.tsx`)

| State | Status | Notes |
|---|---|---|
| Loading | ✅ | Suspense fallback with spinner and "Loading checkout..." text |
| Error | ⚠️ | Payment gateway fetch failure silently falls through to disabled checkout. No user-visible error message — just shows "Online Checkout Unavailable" which is misleading if it's a temporary error vs. a tier restriction |
| Empty | ✅ | No-cart case redirects to `/carts` after 300ms timeout |
| Disabled | ✅ | "Online Checkout Unavailable" panel with contact info and alternative actions |
| Success | ✅ | Redirects to `/account/orders` or `/my-orders` after payment |
| Pending | ⚠️ | No visual indicator while payment is processing — depends on individual payment form components (Square/PayPal/Stripe) to show their own loading states |
| Destructive | N/A | |

### Copy Issues
- **Line 611:** `"This store is currently unable to process online payments. However, you can still contact them directly to place your order!"` — Good, actionable.
- **Line 754–755:** `"No payment methods are configured"` / `"Please contact the store to set up payment options"` — Good, but should also show contact info if available (currently only shown in disabled mode).
- **Line 979:** `"Loading checkout..."` — OK, but could be more descriptive: "Preparing your checkout..."

### Action Items
1. **Distinguish error from disabled:** If payment gateway fetch fails (catch block), show a retry option instead of the "unavailable" panel.
2. **Add contact info to no-gateways state:** When `availableGateways.length === 0` but `checkoutMode !== 'disabled'`, show tenant contact info alongside the message.

---

## 4. Inventory Items (`ItemsPageClient.tsx`)

| State | Status | Notes |
|---|---|---|
| Loading | ⚠️ | Plain text "Loading items…" — no skeleton, no spinner |
| Empty (global) | ✅ | `QuickStartEmptyState` component shown when no items exist at all |
| Empty (filtered) | ⚠️ | "No items found." — no next step (e.g., "Try clearing filters" or "Create your first item") |
| Error | ✅ | Red banner with error message at top of list area |
| Disabled | ✅ | Create button disabled when `isProductEnabled` is false |
| Success | ❌ | Uses `alert()` for all success messages — should use toast notifications |
| Pending | ⚠️ | Refresh button shows "Refreshing…" text but no spinner |
| Selected | ✅ | Bulk selection count shown in real-time with proper singular/plural |
| Destructive | ✅ | `ConfirmDialog` used for delete, purge, and bulk trash with clear warning text and "cannot be undone" messaging |

### Copy Issues
- **Line 275:** `alert("✅ Item moved to trash\n\n...")` — emoji in alert, multi-line alert. Should be a toast.
- **Line 281:** `alert("⚠️ Cannot delete item\n\nTrash bin is full...")` — emoji, multi-line, includes numbered instructions in an alert. Should be a toast or inline message.
- **Line 288:** `alert("❌ Delete failed\n\n...")` — emoji in alert.
- **Line 370:** `alert("Successfully assigned category to ${itemIds.length} item(s)")` — should be toast.
- **Line 457:** `alert("✅ Product cloned successfully!\n\n...")` — emoji, multi-line alert.
- **Line 469:** `alert("Propagation is only available for organization members...")` — should be toast or inline message.
- **Line 475:** `alert("Organization data is still loading. Please try again in a moment.")` — should be toast.
- **Line 481:** `alert("Propagation requires multiple locations...")` — should be toast.
- **Lines 765, 783, 801:** Bulk status update alerts — should be toasts.
- **Lines 875, 879, 883:** Propagation alerts in bulk mode — should be toasts.
- **Lines 928, 933, 938:** Bulk trash alerts — should be toasts.
- **Lines 962, 990:** Bulk restore/purge alerts — should be toasts.
- **Line 1033:** `"No items found."` — No next step. Should suggest clearing filters or creating an item.

### Action Items
1. **Replace all `alert()` calls with toast notifications.** 15+ alert calls need to be converted. This is the largest copy/UX issue on this screen.
2. **Improve loading state:** Replace "Loading items…" text with a skeleton grid or spinner.
3. **Improve filtered empty state:** Add a "Clear filters" button or "Create your first item" CTA when `items.length === 0` but `totalItems > 0` (filtered out).
4. **Add spinner to Refresh button:** Show a spinning icon alongside "Refreshing…" text.

---

## 5. Settings (`PlatformSettings.tsx` / `UnifiedSettings.tsx`)

| State | Status | Notes |
|---|---|---|
| Loading | ✅ | Card click shows overlay spinner with `Loader2` icon |
| Error | N/A | Settings cards are static links — no fetch to fail |
| Empty | N/A | |
| Disabled | ✅ | `ProtectedCard` / `CachedProtectedCard` hides cards user doesn't have access to |
| Success | N/A | |
| Pending | ✅ | Navigation loading state shown on card while route loads |
| Destructive | N/A | |

### Copy Issues
- **UnifiedSettings line 126:** `"Tenant limits and upgrade options would be displayed here"` — placeholder text. Should be removed or replaced with actual `TenantLimitBadge` component.

### Action Items
1. **Remove placeholder text** in `UnifiedSettings.tsx` line 126 — either implement the `TenantLimitBadge` or remove the `showLimits` block entirely.

---

## 6. Navigation Sidebars

### Universal Sidebar (`UniversalNavContent.tsx`)
| State | Status | Notes |
|---|---|---|
| Loading | N/A | Static nav items |
| Error | N/A | |
| Active state | ✅ | Active route highlighted with `bg-primary-50` |
| Collapsed | ✅ | Icon-only mode with tooltips |
| Badge | ✅ | Admin badge shown with warning variant |

### Admin Sidebar (`AdminNavContent.tsx`)
| State | Status | Notes |
|---|---|---|
| Loading | N/A | Static nav items |
| Active state | ✅ | Active route highlighted |
| Permission gating | ✅ | CRM section gated by `CAN_VIEW_CRM` permission |

### Tenant Sidebar (`DynamicTenantSidebar.tsx`)
| State | Status | Notes |
|---|---|---|
| Loading | N/A | |
| Active state | ✅ | |
| Permission gating | ✅ | `IS_TENANT_MANAGER`, `IS_TENANT_ADMIN`, `CAN_MANAGE_TENANT_BILLING` etc. |
| Live badge | ✅ | "Live" badge shown on "View in Directory" when published |

---

## Summary — Prioritized Action Items

### High Priority (User-facing impact)

| # | Screen | Issue | Fix |
|---|---|---|---|
| 1 | Inventory Items | 15+ `alert()` calls for success/error | Replace with toast notifications |
| 2 | Inventory Items | "No items found." has no next step | Add "Clear filters" or "Create item" CTA |
| 3 | Inventory Items | Loading state is plain text | Add skeleton grid or spinner |
| 4 | Checkout | Error vs. disabled state indistinguishable | Add retry option for fetch errors |
| 5 | Platform Home | No error state for stats fetch | Show "Stats temporarily unavailable" on failure |

### Medium Priority (Polish)

| # | Screen | Issue | Fix |
|---|---|---|---|
| 6 | Tenant Dashboard | Demo sparkline data is misleading | Remove or wire to real data |
| 7 | Tenant Dashboard | Refresh button has no loading spinner | Add spinner during refresh |
| 8 | Tenant Dashboard | No empty state for new tenants | Show onboarding card when all metrics are zero |
| 9 | Platform Home | Fake "active" estimate (`* 0.9`) | Remove or label as estimate |
| 10 | Platform Home | Commented-out `console.log` | Remove |
| 11 | Settings | Placeholder text for tenant limits | Implement or remove |
| 12 | Inventory Items | Refresh button has no spinner | Add spinning icon |
| 13 | Checkout | No-gateways state lacks contact info | Show tenant contact info |

### Low Priority (Nice-to-have)

| # | Screen | Issue | Fix |
|---|---|---|---|
| 14 | Checkout | "Loading checkout..." could be more descriptive | "Preparing your checkout..." |
