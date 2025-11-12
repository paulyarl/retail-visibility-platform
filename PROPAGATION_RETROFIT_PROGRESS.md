# Propagation Tier Retrofit - Implementation Progress

**Strategy:** Tiered propagation with Products/User Roles on Starter tier

**Started:** November 12, 2025 5:47am

---

## ✅ Completed (7/10)

### 1. Feature Catalog ✅
**File:** `apps/web/src/lib/features/feature-catalog.ts`
- Changed tier: `organization` → `starter`
- Updated name: "Chain-Wide Updates" → "Multi-Location Updates"
- Updated description to mention tiered strategy
- **Status:** DONE

### 2. Tier Features Configuration ✅
**File:** `apps/web/src/lib/tiers/tier-features.ts`
- Starter: `propagation_products`, `propagation_user_roles`
- Professional: `propagation_hours`, `propagation_profile`, `propagation_categories`, `propagation_gbp_sync`, `propagation_feature_flags`
- Organization: `propagation_brand_assets`, `propagation_selective`, `propagation_scheduling`, `propagation_rollback`
- **Status:** DONE

### 3. Features Marketing Page ✅
**File:** `apps/web/src/app/features/page.tsx`
- Updated title, description, benefits
- Changed badge: "ENTERPRISE" → "STARTER+"
- Changed color: emerald/teal → blue/indigo
- **Status:** DONE

---

### 4. Offerings/Pricing Page ✅
**File:** `apps/web/src/app/(platform)/settings/offerings/page.tsx`
- Changed badge: "ENTERPRISE" → "STARTER+"
- Changed color: emerald/teal → blue/indigo
- Updated messaging to show tiered features
- **Status:** DONE

### 5. Propagation Settings Page ✅
**File:** `apps/web/src/app/t/[tenantId]/settings/propagation/page.tsx`
- Updated access denied message
- Updated "not part of organization" message
- Changed from Organization-only to Starter+ with 2+ locations
- **Status:** DONE

### 6. Propagate Item Modal ✅
**File:** `apps/web/src/components/items/PropagateItemModal.tsx`
- Updated error message to mention Starter tier
- Changed from "chain organization" to "2+ locations"
- **Status:** DONE

### 7. Permission System Documentation ✅
**File:** `apps/web/src/hooks/dashboard/PERMISSION_SYSTEM.md`
- Updated propagation example
- Added tiered feature notes
- Updated all test cases
- **Status:** DONE

## 🔄 Remaining (3/10)

### 8. Dashboard Showcase Component
**File:** `apps/web/src/components/dashboard/WhatYouCanDo.tsx`
- Update tier requirement display
- **Status:** PENDING (Optional - auto-updates from feature catalog)

### 9. Organization Settings Page
**File:** `apps/web/src/app/(platform)/settings/organization/page.tsx`
- Clarify tier requirements
- **Status:** PENDING (Low priority)

### 10. Access Control Documentation
**Files:** Multiple docs in `apps/web/src/lib/auth/`
- Update all references
- **Status:** PENDING (Low priority - docs only)

---

## Tier Strategy Summary

| Tier | Price | Propagation Types | Advanced Features |
|------|-------|-------------------|-------------------|
| **Starter** | $49 | Products, User Roles | - |
| **Professional** | $499 | + Hours, Profile, Categories, GBP, Flags | - |
| **Organization** | $999 | + Brand Assets | Selective, Scheduling, Rollback |

---

## Next Steps

1. Update offerings page
2. Update dashboard showcase
3. Update propagation settings page
4. Update modals and error messages
5. Update documentation
6. Test all tiers
7. Deploy

**Estimated Time Remaining:** ~2 hours
