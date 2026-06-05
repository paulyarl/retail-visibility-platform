# Smart Access Gate - Usage Examples

## 🎯 The middleware automatically tailors messages:

### **Level 1 Fail (Tier Issue):**
```
Message: "Requires Professional tier or higher - Upgrade for barcode scanning"
Action: "View Upgrade Options" button → /settings/subscription
Icon: 🔒
```

### **Level 2 Fail (Role Issue):**
```
Message: "Your role (VIEWER) does not have permission to edit"
Action: "Contact your administrator to request access"
Icon: ⚠️
```

---

## 📦 Component Usage

### **1. Full Page Gate (Block entire feature)**

```typescript
import AccessGate from '@/components/permissions/AccessGate';

function QuickStartPage() {
  return (
    <AccessGate
      tenantId={tenantId}
      featureId="quick_start_wizard_full"
      permissionType="canManage"
    >
      {/* Full quick start wizard */}
      <QuickStartWizard />
    </AccessGate>
  );
}
```

**Result:**
- ✅ ADMIN on Professional tier → Shows wizard
- ❌ MEMBER on Professional tier → Shows "Your role (MEMBER) does not have permission to manage"
- ❌ ADMIN on Google-Only → Shows "Requires Professional tier or higher" + Upgrade button

---

### **2. Inline Gate (Disable button)**

```typescript
import { InlineAccessGate } from '@/components/permissions/AccessGate';

function ProductActions() {
  return (
    <div className="flex gap-2">
      <InlineAccessGate
        tenantId={tenantId}
        featureId="barcode_scan"
        permissionType="canEdit"
      >
        <Button onClick={handleScan}>
          Scan Product
        </Button>
      </InlineAccessGate>
    </div>
  );
}
```

**Result:**
- ✅ MEMBER on Professional tier → Button enabled
- ❌ VIEWER on Professional tier → Button disabled + tooltip "Your role (VIEWER) does not have permission to edit"
- ❌ MEMBER on Google-Only → Button disabled + tooltip "Requires Professional tier or higher - Click to upgrade →"

---

### **3. Custom Fallback (Full control)**

```typescript
import AccessGate from '@/components/permissions/AccessGate';

function PropagateButton() {
  return (
    <AccessGate
      tenantId={tenantId}
      featureId="propagation"
      permissionType="canManage"
      fallback={(reason, isTierIssue, isRoleIssue) => (
        <div className="p-4 bg-amber-50 rounded">
          {isTierIssue ? (
            <>
              <h3>Upgrade to Organization Tier</h3>
              <p>{reason}</p>
              <Button>See Organization Plans</Button>
            </>
          ) : (
            <>
              <h3>Admin Access Required</h3>
              <p>{reason}</p>
              <Button>Request Admin Access</Button>
            </>
          )}
        </div>
      )}
    >
      <Button onClick={handlePropagate}>
        Propagate to All Locations
      </Button>
    </AccessGate>
  );
}
```

---

### **4. Programmatic Check (Hook)**

```typescript
import { useAccessControl } from '@/components/permissions/AccessGate';
import { toast } from 'sonner';

function ProductForm() {
  const { checkAccess } = useAccessControl(tenantId);

  const handleSubmit = () => {
    const access = checkAccess('barcode_scan', 'canEdit');
    
    if (!access.hasAccess) {
      // Smart toast based on issue type
      if (access.isTierIssue) {
        toast.error(access.deniedReason, {
          action: {
            label: 'Upgrade',
            onClick: () => router.push('/settings/subscription'),
          },
        });
      } else {
        toast.error(access.deniedReason, {
          description: 'Contact your administrator for access',
        });
      }
      return;
    }
    
    // Proceed with action
    submitForm();
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## 🎯 Real-World Examples

### **Example 1: Scan Page**

```typescript
// apps/web/src/app/t/[tenantId]/scan/page.tsx
import AccessGate from '@/components/permissions/AccessGate';

export default function ScanPage({ params }) {
  return (
    <AccessGate
      tenantId={params.tenantId}
      featureId="barcode_scan"
      permissionType="canEdit"
    >
      <ScannerInterface />
    </AccessGate>
  );
}
```

**Messages:**
- VIEWER on Pro tier: "Your role (VIEWER) does not have permission to edit" + Contact admin
- MEMBER on Google-Only: "Requires Professional tier or higher" + Upgrade button

---

### **Example 2: Quick Start Button**

```typescript
// apps/web/src/components/items/ItemsHeader.tsx
import { InlineAccessGate } from '@/components/permissions/AccessGate';

function ItemsHeader() {
  return (
    <InlineAccessGate
      tenantId={tenantId}
      featureId="quick_start_wizard_full"
      permissionType="canManage"
    >
      <Button onClick={() => router.push('/quick-start')}>
        Quick Start
      </Button>
    </InlineAccessGate>
  );
}
```

**Tooltip:**
- MEMBER on Pro tier: "Your role (MEMBER) does not have permission to manage"
- ADMIN on Google-Only: "Requires Professional tier or higher - Click to upgrade →"

---

### **Example 3: Propagate Modal**

```typescript
// apps/web/src/components/items/PropagateModal.tsx
import { useAccessControl } from '@/components/permissions/AccessGate';

function PropagateModal({ itemId }) {
  const { checkAccess } = useAccessControl(tenantId);

  const handlePropagate = async () => {
    const access = checkAccess('propagation', 'canManage');
    
    if (!access.hasAccess) {
      if (access.isTierIssue) {
        // Tier issue → Show upgrade modal
        setShowUpgradeModal(true);
      } else {
        // Role issue → Show permission error
        toast.error(access.deniedReason);
      }
      return;
    }
    
    // Proceed with propagation
    await propagateItem(itemId);
  };

  return (
    <Modal>
      <Button onClick={handlePropagate}>
        Propagate to All Locations
      </Button>
    </Modal>
  );
}
```

---

## 📊 Message Matrix

| Scenario | Level Failed | Message | Action |
|----------|-------------|---------|--------|
| VIEWER on Pro tier (scanning) | Level 2 (Role) | "Your role (VIEWER) does not have permission to edit" | Contact admin |
| MEMBER on Google-Only (scanning) | Level 1 (Tier) | "Requires Professional tier or higher - Upgrade for barcode scanning" | Upgrade button |
| MEMBER on Pro tier (propagate) | Level 2 (Role) | "Your role (MEMBER) does not have permission to manage" | Contact admin |
| ADMIN on Pro tier (propagate) | Level 1 (Tier) | "Requires Organization tier - Upgrade to propagate to all locations" | Upgrade button |

---

## 🎨 Visual Examples

### **Tier Issue (Level 1 Fail):**
```
┌─────────────────────────────────────┐
│              🔒                      │
│                                     │
│ Requires Professional tier or      │
│ higher - Upgrade for barcode       │
│ scanning                            │
│                                     │
│  [View Upgrade Options]             │
└─────────────────────────────────────┘
```

### **Role Issue (Level 2 Fail):**
```
┌─────────────────────────────────────┐
│              ⚠️                      │
│                                     │
│ Your role (VIEWER) does not have   │
│ permission to edit                  │
│                                     │
│ Contact your administrator to       │
│ request access                      │
└─────────────────────────────────────┘
```

---

## 🚀 Migration Guide

### **Old Way (Manual checks):**
```typescript
const { hasFeature } = useTenantTier(tenantId);
const canScan = hasFeature('barcode_scan');

if (!canScan) {
  return <div>Upgrade to scan</div>; // ❌ Doesn't check role!
}
```

### **New Way (Smart gate):**
```typescript
<AccessGate
  tenantId={tenantId}
  featureId="barcode_scan"
  permissionType="canEdit"
>
  <ScanButton />
</AccessGate>
// ✅ Checks tier AND role, shows appropriate message
```

---

## 💡 Best Practices

1. **Use `AccessGate` for full features**
   - Entire pages or major sections
   - Shows full message with CTA

2. **Use `InlineAccessGate` for buttons/actions**
   - Individual buttons or controls
   - Shows disabled state with tooltip

3. **Use `useAccessControl` for programmatic checks**
   - Form submissions
   - API calls
   - Complex logic

4. **Always specify correct `permissionType`**
   - `canView` - Read-only features
   - `canEdit` - Modify actions (scan, edit)
   - `canManage` - Create/delete/bulk (quick start, propagate)
   - `canSupport` - Support operations
   - `canAdmin` - Admin features

---

## 🎯 Summary

The middleware **automatically determines** which level failed and shows the appropriate message:

- **Tier issue** → "Requires X tier" + Upgrade button
- **Role issue** → "Your role doesn't have permission" + Contact admin

No manual checking needed - the smart gate handles everything! 🎯✨
