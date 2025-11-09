# Context-Aware Permission Messages

## 🎯 The Enhancement

Instead of generic messages like "Your role does not have permission to **edit**", we now support context-specific actions like "Your role does not have permission to **scan**".

---

## 📝 Usage

### **Basic (Generic Message):**

```typescript
const badge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit');
// VIEWER on Pro tier → "Your role (VIEWER) does not have permission to edit"
```

### **Context-Aware (Specific Message):**

```typescript
const badge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan');
// VIEWER on Pro tier → "Your role (VIEWER) does not have permission to scan"
//                                                                      ^^^^
```

---

## 🎨 Real-World Examples

### **Example 1: Scan Page**

```typescript
// apps/web/src/app/t/[tenantId]/scan/page.tsx
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const scanBadge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan');

// Messages:
// VIEWER on Pro tier: "Your role (VIEWER) does not have permission to scan"
// MEMBER on Google-Only: "Requires Professional tier or higher - Upgrade for barcode scanning"
```

---

### **Example 2: Propagate Button**

```typescript
// apps/web/src/components/items/ItemsGrid.tsx
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const propagateBadge = getFeatureBadgeWithPermission('propagation', 'canManage', 'propagate');

<Button title={propagateBadge?.tooltip}>
  Propagate
</Button>

// Messages:
// MEMBER on Org tier: "Your role (MEMBER) does not have permission to propagate"
// ADMIN on Pro tier: "Requires Organization tier - Upgrade to propagate to all locations"
```

---

### **Example 3: Bulk Upload**

```typescript
// apps/web/src/components/items/ItemsHeader.tsx
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const uploadBadge = getFeatureBadgeWithPermission('bulk_upload', 'canManage', 'upload products');

// Messages:
// MEMBER on Pro tier: "Your role (MEMBER) does not have permission to upload products"
// ADMIN on Google-Only: "Requires Professional tier or higher - Upgrade for bulk upload"
```

---

### **Example 4: Quick Start**

```typescript
// apps/web/src/components/items/ItemsHeader.tsx
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const quickStartBadge = getFeatureBadgeWithPermission(
  'quick_start_wizard_full', 
  'canManage', 
  'use Quick Start'
);

// Messages:
// MEMBER on Pro tier: "Your role (MEMBER) does not have permission to use Quick Start"
// ADMIN on Google-Only: "Requires Professional tier or higher - Upgrade for full Quick Start wizard"
```

---

### **Example 5: Category Quick Start**

```typescript
// apps/web/src/app/t/[tenantId]/categories/quick-start/page.tsx
const { getFeatureBadgeWithPermission } = useTenantTier(tenantId);
const categoryBadge = getFeatureBadgeWithPermission(
  'category_quick_start', 
  'canManage', 
  'generate categories'
);

// Messages:
// MANAGER on Starter tier: "Your role (MANAGER) does not have permission to generate categories"
// ADMIN on Google-Only: "Requires Starter tier or higher - Upgrade for category quick start"
```

---

## 📊 Message Comparison

| Feature | Without actionLabel | With actionLabel |
|---------|-------------------|------------------|
| **Scan** | "...permission to edit" | "...permission to scan" |
| **Propagate** | "...permission to manage" | "...permission to propagate" |
| **Bulk Upload** | "...permission to manage" | "...permission to upload products" |
| **Quick Start** | "...permission to manage" | "...permission to use Quick Start" |
| **Categories** | "...permission to manage" | "...permission to generate categories" |

---

## 🎯 Recommended Action Labels

| Feature | Permission Type | Recommended actionLabel |
|---------|----------------|------------------------|
| `barcode_scan` | canEdit | `"scan"` or `"scan products"` |
| `propagation` | canManage | `"propagate"` or `"propagate products"` |
| `bulk_upload` | canManage | `"upload products"` or `"bulk upload"` |
| `quick_start_wizard_full` | canManage | `"use Quick Start"` |
| `category_quick_start` | canManage | `"generate categories"` |
| `product_enrichment` | canEdit | `"enrich products"` |
| `storefront` | canView | `"view storefront"` |

---

## 💡 Best Practices

### **1. Use Verbs for Actions**
```typescript
// ✅ Good
getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan')
getFeatureBadgeWithPermission('propagation', 'canManage', 'propagate')

// ❌ Avoid nouns
getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scanning')
getFeatureBadgeWithPermission('propagation', 'canManage', 'propagation')
```

### **2. Be Specific When Helpful**
```typescript
// ✅ More specific
getFeatureBadgeWithPermission('bulk_upload', 'canManage', 'upload products')

// ⚠️ Less specific (but still okay)
getFeatureBadgeWithPermission('bulk_upload', 'canManage', 'upload')
```

### **3. Match Page Context**
```typescript
// On scan page
getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan')

// On items page (scan button)
getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan products')
```

### **4. Omit for Generic Cases**
```typescript
// Generic "edit" is fine for general editing
getFeatureBadgeWithPermission('product_edit', 'canEdit')
// → "Your role (VIEWER) does not have permission to edit"

// But be specific for special actions
getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan')
// → "Your role (VIEWER) does not have permission to scan"
```

---

## 🔧 Implementation in AccessGate Component

The `AccessGate` component can also use context-aware labels:

```typescript
<AccessGate
  tenantId={tenantId}
  featureId="barcode_scan"
  permissionType="canEdit"
  actionLabel="scan"  // ← Context-aware!
>
  <ScannerInterface />
</AccessGate>
```

Update the `AccessGate` component to accept and pass through `actionLabel`:

```typescript
interface AccessGateProps {
  tenantId: string;
  featureId: string;
  permissionType: PermissionType;
  actionLabel?: string;  // ← Add this
  children: ReactNode;
  fallback?: (reason: string, isTierIssue: boolean, isRoleIssue: boolean) => ReactNode;
  showDisabled?: boolean;
}

export default function AccessGate({
  tenantId,
  featureId,
  permissionType,
  actionLabel,  // ← Add this
  children,
  fallback,
  showDisabled = false,
}: AccessGateProps) {
  const { canAccess, getAccessDeniedReason } = useTenantTier(tenantId);
  
  const hasAccess = canAccess(featureId, permissionType);
  const deniedReason = getAccessDeniedReason(featureId, permissionType, actionLabel);  // ← Pass it through
  
  // ... rest of component
}
```

---

## 🎯 Summary

**Context-aware action labels make permission messages:**
- ✅ **More specific** - "scan" instead of "edit"
- ✅ **More intuitive** - Matches what user is trying to do
- ✅ **More helpful** - Clear about what's restricted
- ✅ **Optional** - Falls back to generic labels if not provided

**Usage:**
```typescript
// Generic
getFeatureBadgeWithPermission(featureId, permissionType)

// Context-aware
getFeatureBadgeWithPermission(featureId, permissionType, 'scan')
```

The middleware automatically uses the custom action label in role-based denial messages! 🎯✨
