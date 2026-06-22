# UX Phase 5 — Accessibility & Interaction Polish

> **Date:** 2026-06-21  
> **Scope:** Keyboard focus, visible focus styles, hover-vs-touch, and safe action placement for all screens touched in Phases 3–4.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Accessible |
| ⚠️ | Needs improvement |
| ❌ | Missing — accessibility barrier |

---

## 1. Focus Styles

### Button Component (`ui/Button.tsx`)
- **Status:** ✅ — Has `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` in the base variant. Visible focus ring on keyboard navigation.
- **Note:** `focus-visible:ring-1` is a thin ring. Consider `ring-2` for better visibility on small screens.

### Modal Component (`ui/Modal.tsx`)
- **Status:** ⚠️ — Escape key closes modal ✅. Body scroll locked ✅. But:
  - **No focus trap:** Tab key can move focus to elements behind the modal. Should trap focus within the modal while open.
  - **No autofocus:** Focus is not moved to the modal on open. Focus stays on the triggering element.
  - **No focus restore:** Focus is not returned to the triggering element when modal closes.
  - **Close button** has no `aria-label` — uses only an SVG icon.

### Dialog Component (`ui/Dialog.tsx` — Radix-based)
- **Status:** ✅ — Radix UI handles focus trap, focus restore, and escape key automatically. Close button has `sr-only` "Close" label.

### ConfirmDialog (`ui/ConfirmDialog.tsx`)
- **Status:** ⚠️ — Uses the custom `Modal` component, so inherits its focus trap issues. Cancel and Confirm buttons are keyboard-focusable ✅.

### Checkout Payment Selector (`checkout/page.tsx`)
- **Status:** ⚠️ — Payment method buttons are `<button>` elements, so keyboard-focusable ✅. But:
  - **No `aria-pressed` or `role="radio"`:** Selected state is only visual. Screen readers can't determine which payment method is selected.
  - **No `aria-label`:** Buttons rely on visible text only, which is fine for screen readers but the selection state is not announced.

### Items List/Grid — Clickable Divs
- **Status:** ❌ — Product images and titles in both `ItemsList.tsx` and `EnhancedProductCard.tsx` use `<div>` and `<h3>`/`<h4>` with `onClick` handlers but **no `role="button"`, no `tabIndex`, no keyboard handler**. These are not keyboard accessible.
  - `ItemsList.tsx` line 103–112: `<div onClick={...}>` for image
  - `ItemsList.tsx` line 146–150: `<h3 onClick={...}>` for title
  - `EnhancedProductCard.tsx` line 180–188: `<div onClick={...}>` for image
  - `EnhancedProductCard.tsx` line 220–224: `<h4 onClick={...}>` for title

### Items List — `confirm()` for Delete/Purge
- **Status:** ⚠️ — `ItemsList.tsx` lines 404 and 436 use `confirm()` for delete and purge confirmations. While `confirm()` is keyboard accessible, it's inconsistent with the `ConfirmDialog` pattern used in `ItemsPageClient.tsx`. Should use `ConfirmDialog` for consistency.

---

## 2. Hover-Only Actions on Touch Layouts

### Items List (`ItemsList.tsx`)
- **Status:** ✅ — All action buttons (Edit, Clone, Photos, Category, Enrich, QR, Propagate, Status, Visibility, Trash, Restore, Purge) are always visible in a flex-wrap row. No hover-only actions.

### Enhanced Product Card (`EnhancedProductCard.tsx`)
- **Status:** ⚠️ — Let me check the "More Actions" menu...

### Tenant Dashboard Quick Links
- **Status:** ✅ — Quick links in `TenantDashboardV2.tsx` are always visible `<Link>` elements with hover color transitions. No actions hidden behind hover.

### Checkout Payment Selector
- **Status:** ✅ — All payment method buttons are always visible. No hover-only actions.

---

## 3. Keyboard Focus Order

### Checkout Page
- **Status:** ⚠️ — Focus order is generally logical (Back button → Edit Cart → step content → order summary), but:
  - When step changes (e.g., review → fulfillment), focus is not moved to the new step content. Keyboard users have to Tab through the previous step's content (which is no longer rendered) or manually find the new content.
  - No `aria-live` region to announce step changes.

### Inventory Items Page
- **Status:** ⚠️ — Focus order is logical (search → refresh → filters → bulk actions → item list), but:
  - When dropdowns (Status, Visibility, Category) open, focus is not moved to the first option.
  - When dropdowns close, focus is not returned to the trigger button.
  - When bulk mode is toggled, focus is not moved to the first item checkbox.

### Settings Pages
- **Status:** ✅ — Settings cards are `<Link>` or `<button>` elements in logical order. Focus follows visual order.

---

## 4. Dialog/Modal Focus Behavior

### Custom Modal (`ui/Modal.tsx`)
- **Status:** ❌ — Missing focus trap, autofocus, and focus restore. Used by `ConfirmDialog`, `EditItemModal`, `QRCodeModal`, `CategoryAssignmentModal`, `BulkUploadModal`, `PropagationModal`, `BulkPropagationModal`, `ItemPhotoGallery`.

### Radix Dialog (`ui/Dialog.tsx`)
- **Status:** ✅ — Full focus management via Radix UI primitives.

### Guest Save Payment Method Prompt (`checkout/page.tsx`)
- **Status:** ❌ — Uses a custom `<div>` overlay with no focus trap, no autofocus, no escape key handler. Keyboard users can Tab behind the overlay.

---

## Summary — Prioritized Action Items

### High Priority (Keyboard accessibility barriers)

| # | Component | Issue | Fix |
|---|---|---|---|
| 1 | `ui/Modal.tsx` | No focus trap, autofocus, or focus restore | Add focus trap, autofocus on open, restore focus on close |
| 2 | `ItemsList.tsx` / `EnhancedProductCard.tsx` | Clickable divs/h-tags for product images and titles — not keyboard accessible | Add `role="button"`, `tabIndex={0}`, `onKeyDown` handler |
| 3 | `checkout/page.tsx` | Guest save prompt overlay has no focus trap or escape handler | Add focus trap and escape key handler |
| 4 | `ItemsList.tsx` | Uses `confirm()` for delete/purge — inconsistent with `ConfirmDialog` | Replace with `ConfirmDialog` |

### Medium Priority (Screen reader / ARIA)

| # | Component | Issue | Fix |
|---|---|---|---|
| 5 | `checkout/page.tsx` | Payment selector buttons lack `aria-pressed` | Add `aria-pressed={paymentMethod === 'square'}` etc. |
| 6 | `ui/Modal.tsx` | Close button has no `aria-label` | Add `aria-label="Close"` |
| 7 | `checkout/page.tsx` | No `aria-live` for step changes | Add `aria-live="polite"` region for step announcements |

### Low Priority (Polish)

| # | Component | Issue | Fix |
|---|---|---|---|
| 8 | `ui/Button.tsx` | Focus ring is `ring-1` — thin on small screens | Consider `ring-2` for better visibility |
| 9 | `ItemsPageClient.tsx` | Dropdown focus not moved to first option on open | Add autofocus to first dropdown item |
| 10 | `checkout/page.tsx` | Focus not moved to new step content on step change | Move focus to step heading on change |
