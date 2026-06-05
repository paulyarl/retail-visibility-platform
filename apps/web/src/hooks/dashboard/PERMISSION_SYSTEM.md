# Multi-Level Permission System

## 🎯 Architecture Overview

The permission system uses a **cascading two-level check**:

```
Level 0: Platform Support (Bypass All)
    ↓
Level 1: Tenant Tier Check (What tenant pays for)
    ↓ GREEN → Proceed to Level 2
    ↓ RED → DENY (don't check role)
    
Level 2: User Role Check (What user can do)
    ↓ Check specific permission type
    ↓ canView / canEdit / canManage / canSupport / canAdmin
```

## 📊 Permission Types

| Permission Type | Description | Example Use Case |
|----------------|-------------|------------------|
| `canView` | Read-only access | View products, reports |
| `canEdit` | Modify existing items | Edit product details, scan barcodes |
| `canManage` | Create/delete items | Quick start, bulk upload |
| `canSupport` | Support operations | Help customers, troubleshoot |
| `canAdmin` | Administrative tasks | Manage users, billing |

## 👥 Role Permissions Matrix

**Hierarchy:** OWNER > ADMIN = MANAGER > MEMBER > VIEWER

| Role | canView | canEdit | canManage | canSupport | canAdmin | Notes |
|------|---------|---------|-----------|------------|----------|-------|
| **OWNER** | ✅ | ✅ | ✅ | ✅ | ✅ | Full control + billing |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ❌ | Full operations, no billing |
| **MANAGER** | ✅ | ✅ | ✅ | ✅ | ❌ | Trusted authority, same as ADMIN |
| **MEMBER** | ✅ | ✅ | ❌ | ❌ | ❌ | Regular staff |
| **VIEWER** | ✅ | ❌ | ❌ | ❌ | ❌ | Read-only |

**Key Insight:** MANAGER = ADMIN in terms of operational permissions. The distinction is organizational, not technical.

## 🔧 Usage Examples

### Basic Usage

```typescript
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';

function ProductPage() {
  const { canAccess, getAccessDeniedReason } = useTenantTier(tenantId);
  
  // Check if user can scan products
  const canScan = canAccess('barcode_scan', 'canEdit');
  
  // Get reason if denied
  const scanDeniedReason = getAccessDeniedReason('barcode_scan', 'canEdit');
  
  return (
    <div>
      {canScan ? (
        <Button onClick={handleScan}>Scan Product</Button>
      ) : (
        <Tooltip content={scanDeniedReason}>
          <Button disabled>Scan Product</Button>
        </Tooltip>
      )}
    </div>
  );
}
```

### Feature-Specific Examples

#### 1. Barcode Scanning (Professional+ tier, Edit permission)

```typescript
// Level 1: Tenant must have Professional tier
// Level 2: User must have canEdit permission (MEMBER+)

const canScan = canAccess('barcode_scan', 'canEdit');

// ✅ MEMBER on Professional tier → TRUE
// ❌ VIEWER on Professional tier → FALSE (no canEdit)
// ❌ MEMBER on Google-Only tier → FALSE (no tier access)
```

#### 2. Quick Start Wizard (Professional+ tier, Manage permission)

```typescript
// Level 1: Tenant must have Professional tier
// Level 2: User must have canManage permission (ADMIN+)

const canQuickStart = canAccess('quick_start_wizard_full', 'canManage');

// ✅ ADMIN on Professional tier → TRUE
// ❌ MEMBER on Professional tier → FALSE (no canManage)
// ❌ ADMIN on Google-Only tier → FALSE (no tier access)
```

#### 3. Propagation (Starter+ tier, Manage permission, 2+ locations required)

```typescript
// Level 1: Tenant must have Starter tier or higher
// Level 2: User must have canManage permission (ADMIN+)
// Level 3: User must have 2+ locations
// Note: Starter tier gets Products + User Roles only
//       Professional tier gets full operational suite
//       Organization tier gets advanced features

const canPropagate = canAccess('propagation', 'canManage');

// ✅ ADMIN on Starter tier with 3 locations → TRUE (Products + User Roles)
// ✅ ADMIN on Professional tier with 10 locations → TRUE (Full suite)
// ✅ ADMIN on Organization tier → TRUE (Advanced features)
// ❌ ADMIN on Starter tier with 1 location → FALSE (needs 2+)
// ❌ MEMBER on Starter tier with 3 locations → FALSE (no canManage)
// ❌ ADMIN on Google-Only tier → FALSE (no tier access)
```

#### 4. View Storefront (Starter+ tier, View permission)

```typescript
// Level 1: Tenant must have Starter tier
// Level 2: User must have canView permission (ALL roles)

const canViewStorefront = canAccess('storefront', 'canView');

// ✅ VIEWER on Starter tier → TRUE
// ✅ MEMBER on Starter tier → TRUE
// ❌ VIEWER on Google-Only tier → FALSE (no tier access)
```

### Error Handling

```typescript
const { canAccess, getAccessDeniedReason } = useTenantTier(tenantId);

function handleAction(featureId: string, permissionType: PermissionType) {
  if (!canAccess(featureId, permissionType)) {
    const reason = getAccessDeniedReason(featureId, permissionType);
    
    // Reason will be one of:
    // - "Requires Professional tier or higher - Upgrade for barcode scanning"
    // - "Your role (VIEWER) does not have permission to edit"
    
    toast.error(reason);
    return;
  }
  
  // Proceed with action
  performAction();
}
```

## 🎯 Real-World Scenarios

### Scenario 1: VIEWER on Professional Tier

```typescript
// Tenant: Professional tier (has barcode_scan)
// User: VIEWER role

canAccess('barcode_scan', 'canView')   // ✅ TRUE - Can view scanned products
canAccess('barcode_scan', 'canEdit')   // ❌ FALSE - Can't scan (no canEdit)

getAccessDeniedReason('barcode_scan', 'canEdit')
// → "Your role (VIEWER) does not have permission to edit"
```

### Scenario 2: MEMBER on Google-Only Tier

```typescript
// Tenant: Google-Only tier (no barcode_scan)
// User: MEMBER role

canAccess('barcode_scan', 'canEdit')   // ❌ FALSE - Tier doesn't include it

getAccessDeniedReason('barcode_scan', 'canEdit')
// → "Requires Professional tier or higher - Upgrade for barcode scanning"
```

### Scenario 3: ADMIN on Organization Tier

```typescript
// Tenant: Organization tier (has everything)
// User: ADMIN role

canAccess('barcode_scan', 'canEdit')    // ✅ TRUE
canAccess('propagation', 'canManage')   // ✅ TRUE
canAccess('storefront', 'canView')      // ✅ TRUE

// All features unlocked!
```

### Scenario 4: Platform Admin

```typescript
// User: PLATFORM_ADMIN (bypasses all checks)

canAccess('anything', 'canAdmin')  // ✅ TRUE
// Platform admins bypass Level 1 AND Level 2
```

## 🔄 Migration from Legacy System

### Old Way (Tier-only check)

```typescript
const { hasFeature } = useTenantTier(tenantId);
const canScan = hasFeature('barcode_scan');
// ❌ Doesn't check user role!
```

### New Way (Multi-level check)

```typescript
const { canAccess } = useTenantTier(tenantId);
const canScan = canAccess('barcode_scan', 'canEdit');
// ✅ Checks tier AND role!
```

### Backward Compatibility

The old `hasFeature()` function still works for backward compatibility, but **only checks tier, not role**. Migrate to `canAccess()` for proper permission checking.

## 🚀 Best Practices

1. **Always use `canAccess()` for new features**
   - Checks both tier and role
   - More secure and accurate

2. **Choose the right permission type**
   - `canView` - Read-only features
   - `canEdit` - Modify existing data
   - `canManage` - Create/delete/bulk operations
   - `canSupport` - Support/troubleshooting
   - `canAdmin` - Administrative features

3. **Show helpful error messages**
   - Use `getAccessDeniedReason()` to explain why
   - Different messages for tier vs role issues

4. **Test with different roles**
   - VIEWER (most restrictive)
   - MEMBER (typical user)
   - ADMIN (full access)

## 📝 Adding New Features

When adding a new feature:

1. Add to tier system (what tier includes it)
2. Choose appropriate permission type
3. Use `canAccess()` in UI
4. Show `getAccessDeniedReason()` on error

Example:

```typescript
// 1. Feature is in Professional tier (already in tier system)

// 2. Choose permission type
const permissionType = 'canManage'; // Requires ADMIN+

// 3. Check access
const canUseFeature = canAccess('my_new_feature', permissionType);

// 4. Show reason if denied
if (!canUseFeature) {
  const reason = getAccessDeniedReason('my_new_feature', permissionType);
  toast.error(reason);
}
```

## 🎯 Summary

**Two-level check ensures:**
- ✅ Tenant pays for the feature (Level 1)
- ✅ User has permission to use it (Level 2)
- ✅ Platform admins bypass everything (Level 0)
- ✅ Clear error messages for both levels
- ✅ Backward compatible with legacy code
