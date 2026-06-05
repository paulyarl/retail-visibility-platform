# Subscription Page UX Improvements

**Date:** November 7, 2025  
**Issue:** Platform users viewing subscription pages see irrelevant information  
**URL:** `/settings/subscription`

---

## 🎯 Problem Statement

### Current Issues

1. **Platform Users See Tenant Plans**
   - Platform users (ADMIN, SUPPORT, VIEWER) don't have their own subscription
   - They see the tenant's plan, which is confusing
   - They can't change the plan anyway (not their tenant)
   - Creates confusion about their access level

2. **Missing User Role Context**
   - No indication of WHY they're viewing this plan
   - No badge showing their relationship to the tenant
   - Users don't know if they're:
     - Store owner
     - Store admin
     - Platform admin (viewing as oversight)
     - Platform support (viewing to help customer)
     - Platform viewer (viewing for analytics)

---

## 💡 Recommended Solutions

### Solution 1: Hide Subscription Page for Platform Users

**Rationale:** Platform users don't have subscriptions - they have platform-level access

```typescript
// In subscription page component
const user = useUser();

if (isPlatformUser(user)) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Platform User Access</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-700 mb-4">
            As a platform user, you don't have a personal subscription. 
            You have {user.role === 'PLATFORM_ADMIN' ? 'full' : 'view-only'} access 
            to all tenants on the platform.
          </p>
          <Badge className="bg-purple-100 text-purple-900">
            {user.role === 'PLATFORM_ADMIN' && '👑 Platform Administrator'}
            {user.role === 'PLATFORM_SUPPORT' && '🛠️ Platform Support'}
            {user.role === 'PLATFORM_VIEWER' && '👁️ Platform Viewer'}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Solution 2: Add User Role Badge (If Showing Plan)

**Rationale:** If platform users CAN view tenant plans (for support purposes), show their relationship

```typescript
// Add to Current Plan card
<CardHeader>
  <div className="flex items-center justify-between">
    <CardTitle>Current Plan</CardTitle>
    <div className="flex items-center gap-2">
      {/* User Role Badge */}
      {getUserRoleBadge(user, tenant)}
      
      {/* Plan Badge */}
      <Badge variant="default" className={tierInfo.color}>
        {tierInfo.name}
      </Badge>
    </div>
  </div>
</CardHeader>

// Helper function
function getUserRoleBadge(user: UserData, tenant: Tenant) {
  // Platform users
  if (isPlatformAdmin(user)) {
    return (
      <Badge className="bg-purple-100 text-purple-900 border-2 border-purple-300">
        👑 Platform Admin
      </Badge>
    );
  }
  
  if (user.role === 'PLATFORM_SUPPORT') {
    return (
      <Badge className="bg-blue-100 text-blue-900 border-2 border-blue-300">
        🛠️ Support View
      </Badge>
    );
  }
  
  if (user.role === 'PLATFORM_VIEWER') {
    return (
      <Badge className="bg-gray-100 text-gray-900 border-2 border-gray-300">
        👁️ Analytics View
      </Badge>
    );
  }
  
  // Tenant users
  const tenantRole = getTenantRole(user, tenant.id);
  
  if (tenantRole === 'OWNER') {
    return (
      <Badge className="bg-amber-100 text-amber-900 border-2 border-amber-300">
        👤 Store Owner
      </Badge>
    );
  }
  
  if (tenantRole === 'ADMIN') {
    return (
      <Badge className="bg-green-100 text-green-900 border-2 border-green-300">
        ⚙️ Store Admin
      </Badge>
    );
  }
  
  if (tenantRole === 'MEMBER') {
    return (
      <Badge className="bg-blue-50 text-blue-700">
        👥 Team Member
      </Badge>
    );
  }
  
  if (tenantRole === 'VIEWER') {
    return (
      <Badge className="bg-gray-50 text-gray-700">
        👁️ Viewer
      </Badge>
    );
  }
  
  return null;
}
```

### Solution 3: Conditional Actions Based on Role

**Rationale:** Different users should see different actions

```typescript
// In the "Change Your Plan" section
{!isPlatformUser(user) && tenantRole === 'OWNER' && (
  <div id="available-plans">
    <h2>Change Your Plan</h2>
    {/* Show plan options */}
  </div>
)}

{!isPlatformUser(user) && tenantRole !== 'OWNER' && (
  <Card className="bg-amber-50 border-amber-200">
    <CardContent className="pt-6">
      <p className="text-amber-900">
        Only the store owner can change subscription plans. 
        Contact your store owner to request a plan change.
      </p>
    </CardContent>
  </Card>
)}

{isPlatformUser(user) && (
  <Card className="bg-purple-50 border-purple-200">
    <CardContent className="pt-6">
      <p className="text-purple-900">
        As a platform user, you're viewing this tenant's subscription for 
        {user.role === 'PLATFORM_ADMIN' && ' administrative oversight.'}
        {user.role === 'PLATFORM_SUPPORT' && ' customer support purposes.'}
        {user.role === 'PLATFORM_VIEWER' && ' analytics and reporting.'}
      </p>
      {user.role === 'PLATFORM_ADMIN' && (
        <Button 
          variant="primary" 
          className="mt-4"
          onClick={() => window.location.href = `/admin/tenants/${tenant.id}/subscription`}
        >
          Manage Subscription (Admin)
        </Button>
      )}
    </CardContent>
  </Card>
)}
```

---

## 🎨 Visual Design

### Role Badge Styles

| Role | Badge | Color | Icon |
|------|-------|-------|------|
| Platform Admin | `👑 Platform Admin` | Purple | Crown |
| Platform Support | `🛠️ Support View` | Blue | Wrench |
| Platform Viewer | `👁️ Analytics View` | Gray | Eye |
| Store Owner | `👤 Store Owner` | Amber | Person |
| Store Admin | `⚙️ Store Admin` | Green | Gear |
| Team Member | `👥 Team Member` | Light Blue | People |
| Viewer | `👁️ Viewer` | Light Gray | Eye |

### Placement

```
┌─────────────────────────────────────────────┐
│ Current Plan                  [Role Badge]  │
│                              [Plan Badge]   │
├─────────────────────────────────────────────┤
│ $49/month                                   │
│ Get started with the basics                 │
│                                             │
│ SKU Usage: 125 / 500                        │
│ [Progress Bar]                              │
└─────────────────────────────────────────────┘
```

---

## 📋 Implementation Checklist

### Phase 1: Add Role Detection
- [ ] Import `isPlatformUser()` and `isPlatformAdmin()` helpers
- [ ] Import `getTenantRole()` helper
- [ ] Add user role detection logic

### Phase 2: Add Role Badge Component
- [ ] Create `getUserRoleBadge()` helper function
- [ ] Add badge styles for each role
- [ ] Add badge to Current Plan card header

### Phase 3: Conditional Content
- [ ] Hide "Change Your Plan" for non-owners
- [ ] Show appropriate message for platform users
- [ ] Show appropriate message for non-owner tenant users

### Phase 4: Platform User Experience
- [ ] Option A: Redirect platform users away from subscription page
- [ ] Option B: Show platform user info card instead
- [ ] Option C: Show read-only view with context banner

---

## 🎯 Recommended Approach

### Best UX: Hybrid Approach

1. **Platform Users (ADMIN, SUPPORT, VIEWER)**
   - Show tenant's plan (read-only)
   - Add prominent role badge at top
   - Add context banner explaining why they're viewing
   - Hide "Change Your Plan" section
   - Add link to admin panel (ADMIN only)

2. **Store Owners**
   - Show full subscription page
   - Add "Store Owner" badge
   - Allow plan changes
   - Show all features

3. **Store Admins/Members/Viewers**
   - Show tenant's plan (read-only)
   - Add role badge
   - Show message: "Contact store owner to change plans"
   - Hide plan selection UI

---

## 📊 User Flow Examples

### Platform Admin Views Subscription
```
┌─────────────────────────────────────────────┐
│ 👑 Platform Admin View                      │
│ You're viewing this tenant's subscription   │
│ for administrative oversight.               │
│ [Manage Subscription (Admin)]               │
├─────────────────────────────────────────────┤
│ Current Plan    [👑 Platform Admin] [Starter]│
│ ...                                         │
└─────────────────────────────────────────────┘
```

### Platform Support Views Subscription
```
┌─────────────────────────────────────────────┐
│ 🛠️ Support View                             │
│ You're viewing this tenant's subscription   │
│ to assist with customer support.            │
├─────────────────────────────────────────────┤
│ Current Plan    [🛠️ Support View] [Starter] │
│ ...                                         │
│ (No plan change options shown)              │
└─────────────────────────────────────────────┘
```

### Store Owner Views Subscription
```
┌─────────────────────────────────────────────┐
│ Current Plan    [👤 Store Owner] [Starter]  │
│ ...                                         │
├─────────────────────────────────────────────┤
│ Change Your Plan                            │
│ [Plan options shown]                        │
└─────────────────────────────────────────────┘
```

### Store Admin Views Subscription
```
┌─────────────────────────────────────────────┐
│ Current Plan    [⚙️ Store Admin] [Starter]  │
│ ...                                         │
├─────────────────────────────────────────────┤
│ ⚠️ Only the store owner can change plans    │
│ Contact your store owner to request changes │
└─────────────────────────────────────────────┘
```

---

## 🔐 Security Considerations

1. **Platform Users**
   - Can VIEW all tenant subscriptions
   - Cannot MODIFY subscriptions (even PLATFORM_ADMIN)
   - Must use admin panel for modifications

2. **Store Owners**
   - Can VIEW and MODIFY their own subscription
   - Cannot view other tenants' subscriptions

3. **Store Admins/Members**
   - Can VIEW their tenant's subscription
   - Cannot MODIFY subscription

---

## 📝 Code Changes Required

### Files to Update

1. **`apps/web/src/app/(platform)/settings/subscription/page.tsx`**
   - Add role detection
   - Add role badge component
   - Add conditional rendering
   - Add context banners

2. **`apps/web/src/lib/auth/access-control.ts`**
   - Already has `isPlatformUser()` ✅
   - Already has `isPlatformAdmin()` ✅
   - Already has `getTenantRole()` ✅

3. **`apps/web/src/components/ui/Badge.tsx`**
   - May need additional badge variants

---

**Recommendation:** Implement the **Hybrid Approach** with role badges and conditional content. This provides the best UX for all user types while maintaining security and clarity.
