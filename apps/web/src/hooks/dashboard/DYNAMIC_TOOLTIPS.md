# Dynamic Badge Tooltips

## 🎯 The Problem We Solved

**Before:** Hardcoded tooltips in badge system
```typescript
const badge = getFeatureBadge('barcode_scan');
// tooltip: "Requires Professional tier or higher - Upgrade for barcode scanning"
// ❌ Same tooltip for VIEWER and MEMBER on Google-Only tier
// ❌ Doesn't explain role restrictions
```

**After:** Dynamic tooltips from middleware
```typescript
const badge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit');
// VIEWER on Pro tier → "Your role (VIEWER) does not have permission to edit"
// MEMBER on Google-Only → "Requires Professional tier or higher - Upgrade for barcode scanning"
// ✅ Smart tooltip based on which level failed!
```

---

## 🔧 How It Works

### **The Magic Function:**

```typescript
getFeatureBadgeWithPermission(featureId, permissionType) {
  // 1. Check if user has access
  if (canAccess(featureId, permissionType)) return null;
  
  // 2. Get dynamic reason (tier OR role issue)
  const deniedReason = getAccessDeniedReason(featureId, permissionType);
  
  // 3. Get badge styling from tier
  const tierBadge = getBadge(featureId);
  
  // 4. Return badge with DYNAMIC tooltip
  return {
    text: tierBadge.text,        // "PRO+" or "STARTER+"
    tooltip: deniedReason,        // ← Dynamic!
    colorClass: tierBadge.colorClass
  };
}
```

---

## 📊 Tooltip Examples

### **Scenario 1: VIEWER on Professional Tier**

```typescript
const badge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit');

// Result:
{
  text: "PRO+",  // Still shows tier badge
  tooltip: "Your role (VIEWER) does not have permission to edit",  // ← Role issue!
  colorClass: "bg-gradient-to-r from-purple-600 to-pink-600"
}
```

**Why:** Tenant has Professional tier (Level 1 ✅), but VIEWER role can't edit (Level 2 ❌)

---

### **Scenario 2: MEMBER on Google-Only Tier**

```typescript
const badge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit');

// Result:
{
  text: "PRO+",
  tooltip: "Requires Professional tier or higher - Upgrade for barcode scanning",  // ← Tier issue!
  colorClass: "bg-gradient-to-r from-purple-600 to-pink-600"
}
```

**Why:** Tenant doesn't have Professional tier (Level 1 ❌), role check never happens

---

### **Scenario 3: MEMBER on Professional Tier (Propagate)**

```typescript
const badge = getFeatureBadgeWithPermission('propagation', 'canManage');

// Result:
{
  text: "PRO+",  // Shows tier badge (needs ORG tier)
  tooltip: "Requires Organization tier - Upgrade to propagate to all locations",  // ← Tier issue!
  colorClass: "bg-gradient-to-r from-blue-600 to-cyan-600"
}
```

**Why:** Tenant doesn't have Organization tier (Level 1 ❌)

---

### **Scenario 4: ADMIN on Professional Tier (Propagate)**

```typescript
const badge = getFeatureBadgeWithPermission('propagation', 'canManage');

// Result:
{
  text: "ORG",
  tooltip: "Requires Organization tier - Upgrade to propagate to all locations",  // ← Tier issue!
  colorClass: "bg-gradient-to-r from-blue-600 to-cyan-600"
}
```

**Why:** Tenant doesn't have Organization tier (Level 1 ❌), even though ADMIN has canManage

---

## 🎨 Usage in Components

### **Old Way (Static Tooltip):**

```typescript
const { getFeatureBadge } = useTenantTier(tenantId);
const badge = getFeatureBadge('barcode_scan');

<Button title={badge?.tooltip}>
  Scan Products
  {badge && <span className={badge.colorClass}>{badge.text}</span>}
</Button>
// ❌ Tooltip doesn't explain role restrictions
```

### **New Way (Dynamic Tooltip):**

```typescript
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const badge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit');

<Button title={badge?.tooltip}>
  Scan Products
  {badge && <span className={badge.colorClass}>{badge.text}</span>}
</Button>
// ✅ Tooltip explains tier OR role issue!
```

---

## 📝 Real-World Examples

### **Example 1: Scan Products Button**

```typescript
// apps/web/src/components/items/ItemsHeader.tsx
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const scanBadge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit');

<Button
  onClick={() => router.push(`/t/${tenantId}/scan`)}
  disabled={!!scanBadge}
  title={scanBadge?.tooltip}
  className={scanBadge ? 'opacity-60 cursor-not-allowed' : ''}
>
  Scan Products
  {scanBadge && (
    <span className={`ml-2 ${scanBadge.colorClass} text-white px-2 py-1 rounded text-xs`}>
      {scanBadge.text}
    </span>
  )}
</Button>
```

**Tooltips:**
- VIEWER on Pro tier: "Your role (VIEWER) does not have permission to edit"
- MEMBER on Google-Only: "Requires Professional tier or higher - Upgrade for barcode scanning"

---

### **Example 2: Propagate Button**

```typescript
// apps/web/src/components/items/ItemsGrid.tsx
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const propagateBadge = getFeatureBadgeWithPermission('propagation', 'canManage');

<Button
  onClick={handlePropagate}
  disabled={!!propagateBadge}
  title={propagateBadge?.tooltip}
>
  Propagate
  {propagateBadge && (
    <span className={propagateBadge.colorClass}>{propagateBadge.text}</span>
  )}
</Button>
```

**Tooltips:**
- MEMBER on Org tier: "Your role (MEMBER) does not have permission to manage"
- ADMIN on Pro tier: "Requires Organization tier - Upgrade to propagate to all locations"

---

### **Example 3: Quick Start Button**

```typescript
// apps/web/src/components/items/ItemsHeader.tsx
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const quickStartBadge = getFeatureBadgeWithPermission('quick_start_wizard_full', 'canManage');

<Button
  onClick={() => router.push(`/t/${tenantId}/quick-start`)}
  disabled={!!quickStartBadge}
  title={quickStartBadge?.tooltip}
>
  Quick Start
  {quickStartBadge && (
    <span className={quickStartBadge.colorClass}>{quickStartBadge.text}</span>
  )}
</Button>
```

**Tooltips:**
- MEMBER on Pro tier: "Your role (MEMBER) does not have permission to manage"
- ADMIN on Google-Only: "Requires Professional tier or higher - Upgrade for full Quick Start wizard"

---

## 🎯 Tooltip Matrix

| User | Tenant Tier | Feature | Permission | Tooltip |
|------|------------|---------|------------|---------|
| VIEWER | Professional | Scan | canEdit | "Your role (VIEWER) does not have permission to edit" |
| MEMBER | Google-Only | Scan | canEdit | "Requires Professional tier or higher - Upgrade for barcode scanning" |
| MEMBER | Professional | Propagate | canManage | "Your role (MEMBER) does not have permission to manage" |
| ADMIN | Professional | Propagate | canManage | "Requires Organization tier - Upgrade to propagate to all locations" |
| MANAGER | Professional | Quick Start | canManage | "Your role (MANAGER) does not have permission to manage" |
| ADMIN | Google-Only | Quick Start | canManage | "Requires Professional tier or higher - Upgrade for full Quick Start wizard" |

---

## 🚀 Migration Guide

### **Step 1: Update Import**

```typescript
// Old
const { getFeatureBadge } = useTenantTier(tenantId);

// New
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
```

### **Step 2: Add Permission Type**

```typescript
// Old
const badge = getFeatureBadge('barcode_scan');

// New
const badge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit');
```

### **Step 3: Use Dynamic Tooltip**

```typescript
// The tooltip is now automatically dynamic!
<Button title={badge?.tooltip}>
  {/* Badge tooltip explains tier OR role issue */}
</Button>
```

---

## 💡 Best Practices

1. **Always use `getFeatureBadgeWithPermission` for new features**
   - Provides smart, context-aware tooltips
   - Explains both tier and role restrictions

2. **Choose the correct permission type**
   - `canView` - Read-only features
   - `canEdit` - Modify actions (scan, edit)
   - `canManage` - Create/delete/bulk (quick start, propagate)

3. **Show the tooltip on hover**
   - Use `title` attribute for native tooltips
   - Or use a tooltip component for better UX

4. **Keep badge visible even when disabled**
   - Shows users what they're missing
   - Tooltip explains how to get access

---

## 🎯 Summary

**Dynamic tooltips automatically explain:**
- ✅ **Tier issues** → "Requires X tier or higher - Upgrade for..."
- ✅ **Role issues** → "Your role (VIEWER) does not have permission to..."
- ✅ **Smart messaging** → Different tooltip based on which level failed
- ✅ **No hardcoding** → Tooltips come from middleware logic
- ✅ **Always accurate** → Reflects current tier AND role state

The badge tooltip is now **dynamically generated** by the middleware based on the actual permission check! 🎯✨
