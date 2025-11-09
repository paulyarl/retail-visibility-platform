# Migration Guide: Tier-Only → Multi-Level Permission System

## 🎯 Overview

**Current State:** Most pages use tier-only checks (`hasFeature`, `getFeatureBadge`)  
**Target State:** Use multi-level checks (`canAccess`, `getFeatureBadgeWithPermission`)

**Why Migrate:**
- ✅ Enforces role-based permissions (VIEWER can't edit)
- ✅ Context-aware messages ("scan" not "edit")
- ✅ Prevents security gaps
- ✅ Better UX with specific error messages

---

## 📊 Files That Need Migration

### **High Priority (Security Risk)**

| File | Current Issue | Impact |
|------|--------------|--------|
| `scan/page.tsx` | Uses `hasFeature` only | ❌ VIEWER can scan |
| `quick-start/page.tsx` | Uses `hasFeature` only | ❌ MEMBER can use wizard |
| `ItemsClient.tsx` | Uses `hasFeature` only | ❌ VIEWER can propagate |
| `ItemsHeader.tsx` | Uses `getFeatureBadge` only | ⚠️ Wrong tooltip for VIEWER |
| `categories/quick-start/page.tsx` | Uses `getFeatureBadge` only | ❌ MANAGER can generate |

### **Medium Priority (UX Issue)**

| File | Current Issue | Impact |
|------|--------------|--------|
| `PropagationHub.tsx` | Uses `hasFeature` only | ⚠️ Shows locked features to MEMBER |
| `AccessGate.tsx` | Already uses multi-level | ✅ Good (but could add actionLabel) |

### **Low Priority (Examples/Demos)**

| File | Current Issue | Impact |
|------|--------------|--------|
| `TierGateExample.tsx` | Demo component | 📚 Educational only |
| `TierGate.tsx` | Legacy component | 📚 May not be used |

---

## 🔧 Migration Steps

### **Step 1: Update Scan Page**

**File:** `app/t/[tenantId]/scan/page.tsx`

**Before:**
```typescript
const { hasFeature } = useTenantTier(tenantId);
const hasScannerAccess = hasFeature('barcode_scan');
// ❌ VIEWER on Pro tier can scan!
```

**After:**
```typescript
const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const hasScannerAccess = canAccess('barcode_scan', 'canEdit');
const scanBadge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan');
// ✅ VIEWER blocked, context-aware message
```

---

### **Step 2: Update Quick Start Page**

**File:** `app/t/[tenantId]/quick-start/page.tsx`

**Before:**
```typescript
const { hasFeature } = useTenantTier(tenantId);
const hasFullQuickStart = hasFeature('quick_start_wizard_full');
const hasBarcodeScanning = hasFeature('barcode_scan');
// ❌ MEMBER can use wizard (should be ADMIN+)
```

**After:**
```typescript
const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const hasFullQuickStart = canAccess('quick_start_wizard_full', 'canManage');
const hasBarcodeScanning = canAccess('barcode_scan', 'canEdit');
const wizardBadge = getFeatureBadgeWithPermission('quick_start_wizard_full', 'canManage', 'use Quick Start');
const scanBadge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan');
// ✅ Only ADMIN+ can use wizard
```

---

### **Step 3: Update Items Header**

**File:** `components/items/ItemsHeader.tsx`

**Before:**
```typescript
const { hasFeature, getFeatureBadge } = useTenantTier(tenantId || '');
const hasStorefront = hasFeature('storefront');
const storefrontBadge = getFeatureBadge('storefront');
// ⚠️ Wrong tooltip for VIEWER (shows tier message, not role message)
```

**After:**
```typescript
const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId || '');
const hasStorefront = canAccess('storefront', 'canView');
const storefrontBadge = getFeatureBadgeWithPermission('storefront', 'canView', 'view storefront');
// ✅ Correct tooltip for tier AND role issues
```

---

### **Step 4: Update Items Client**

**File:** `components/items/ItemsClient.tsx`

**Before:**
```typescript
const { hasFeature } = useTenantTier(initialTenantId);
const canPropagate = hasFeature('propagation_products');
const canScan = hasFeature('product_scanning');
// ❌ VIEWER can propagate!
```

**After:**
```typescript
const { canAccess } = useTenantTier(initialTenantId);
const canPropagate = canAccess('propagation', 'canManage');
const canScan = canAccess('barcode_scan', 'canEdit');
// ✅ Only ADMIN+ can propagate, MEMBER+ can scan
```

---

### **Step 5: Update Categories Quick Start**

**File:** `app/t/[tenantId]/categories/quick-start/page.tsx`

**Before:**
```typescript
const { hasFeature, getFeatureBadge } = useTenantTier(tenantId);
const hasCategoryQuickStart = hasFeature('basic_categories');
const quickStartBadge = getFeatureBadge('category_quick_start');
// ❌ MANAGER can generate categories (should be ADMIN+)
```

**After:**
```typescript
const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const hasCategoryQuickStart = canAccess('category_quick_start', 'canManage');
const quickStartBadge = getFeatureBadgeWithPermission('category_quick_start', 'canManage', 'generate categories');
// ✅ Only ADMIN+ can generate, context-aware message
```

---

### **Step 6: Update Propagation Hub**

**File:** `components/propagation/PropagationHub.tsx`

**Before:**
```typescript
const { hasFeature } = useTenantTier(tenantId);
const hasOrgAccess = hasFeature('propagation');
// ❌ Shows features to MEMBER who can't use them
```

**After:**
```typescript
const { canAccess } = useTenantTier(tenantId);
const hasOrgAccess = canAccess('propagation', 'canManage');
// ✅ Only shows to ADMIN+ who can actually use it
```

---

## 🎯 Permission Type Reference

| Feature | Permission Type | Who Has Access |
|---------|----------------|----------------|
| `barcode_scan` | `canEdit` | MEMBER, MANAGER, ADMIN, OWNER |
| `quick_start_wizard_full` | `canManage` | ADMIN, OWNER |
| `category_quick_start` | `canManage` | ADMIN, OWNER |
| `propagation` | `canManage` | ADMIN, OWNER |
| `bulk_upload` | `canManage` | ADMIN, OWNER |
| `storefront` | `canView` | ALL (if tier allows) |
| `product_enrichment` | `canEdit` | MEMBER, MANAGER, ADMIN, OWNER |

---

## 📝 Migration Checklist

### **For Each File:**

- [ ] Replace `hasFeature()` with `canAccess(featureId, permissionType)`
- [ ] Replace `getFeatureBadge()` with `getFeatureBadgeWithPermission(featureId, permissionType, actionLabel)`
- [ ] Add appropriate `permissionType` (`canView`, `canEdit`, `canManage`)
- [ ] Add context-aware `actionLabel` (e.g., "scan", "propagate")
- [ ] Test with different roles (VIEWER, MEMBER, MANAGER, ADMIN)
- [ ] Verify error messages are correct

---

## 🧪 Testing Matrix

Test each migrated feature with:

| Role | Tier | Expected Result |
|------|------|----------------|
| **VIEWER** | Professional | ❌ Blocked by role, message: "Your role (VIEWER) does not have permission to scan" |
| **MEMBER** | Google-Only | ❌ Blocked by tier, message: "Requires Professional tier or higher..." |
| **MEMBER** | Professional | ✅ Allowed (for canEdit features) |
| **MANAGER** | Professional | ❌ Blocked by role for canManage features |
| **ADMIN** | Professional | ✅ Allowed |
| **Platform Admin** | Any | ✅ Bypasses all checks |

---

## ⚠️ Breaking Changes

**None!** The old functions still work:
- `hasFeature()` - Still checks tier (no role check)
- `getFeatureBadge()` - Still returns tier badge (no role-aware tooltip)

**But they have security gaps:**
- ❌ Don't enforce role permissions
- ❌ Don't provide role-specific error messages

---

## 🚀 Recommended Migration Order

1. **High Priority (Security):**
   - ✅ `scan/page.tsx` - VIEWER can scan
   - ✅ `quick-start/page.tsx` - MEMBER can use wizard
   - ✅ `ItemsClient.tsx` - VIEWER can propagate
   - ✅ `categories/quick-start/page.tsx` - MANAGER can generate

2. **Medium Priority (UX):**
   - ✅ `ItemsHeader.tsx` - Wrong tooltips
   - ✅ `PropagationHub.tsx` - Shows locked features

3. **Low Priority (Nice to Have):**
   - Update demo components
   - Add actionLabels to AccessGate usage

---

## 📚 Example: Complete Migration

**Before:**
```typescript
// ❌ Tier-only check
const { hasFeature, getFeatureBadge } = useTenantTier(tenantId);
const canScan = hasFeature('barcode_scan');
const badge = getFeatureBadge('barcode_scan');

<Button disabled={!canScan} title={badge?.tooltip}>
  Scan Products
  {badge && <span>{badge.text}</span>}
</Button>
```

**After:**
```typescript
// ✅ Multi-level check with context-aware message
const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const canScan = canAccess('barcode_scan', 'canEdit');
const badge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan');

<Button disabled={!canScan} title={badge?.tooltip}>
  Scan Products
  {badge && <span>{badge.text}</span>}
</Button>

// Now shows:
// - VIEWER on Pro: "Your role (VIEWER) does not have permission to scan"
// - MEMBER on Google-Only: "Requires Professional tier or higher..."
```

---

## 🎯 Summary

**Migration is:**
- ✅ **Backward compatible** - Old functions still work
- ✅ **Incremental** - Migrate one file at a time
- ✅ **High impact** - Fixes security gaps and improves UX
- ✅ **Well documented** - Clear examples for each case

**Priority:**
1. Fix security gaps (VIEWER can scan/propagate)
2. Improve UX (context-aware messages)
3. Update examples/demos

Start with high-priority files and work down the list! 🚀
