# Pending UI Implementation

## Priority UIs to Implement

### 1. Organization Management (Admin) - `/admin/organizations`
**Status:** API Complete ✅ | UI Pending ❌

**Features Needed:**
- List all organizations with stats (locations, SKUs, utilization)
- Create new organization modal
- Edit organization (name, maxLocations, maxTotalSKUs)
- Delete organization (with confirmation)
- Manage locations (add/remove tenants)
- View organization dashboard link

**API Endpoints Available:**
- GET /organizations
- POST /organizations
- PUT /organizations/:id
- DELETE /organizations/:id
- POST /organizations/:id/tenants
- DELETE /organizations/:id/tenants/:tenantId

---

### 2. Billing Dashboard (Admin) - `/admin/billing`
**Status:** API Complete ✅ | UI Pending ❌

**Features Needed:**
- View all tenants with SKU usage
- Show limit status (ok, warning, at_limit)
- Set custom SKU limits per tenant
- View organization-level limits
- Usage charts and trends
- Export billing data

**API Endpoints Available:**
- GET /tenant/billing/counters
- GET /tenant/billing/status
- POST /admin/billing/override
- POST /admin/organization/override
- GET /organization/billing/counters

---

### 3. Category Management (Admin) - `/admin/categories`
**Status:** API Complete ✅ | UI Pending ❌

**Features Needed:**
- List all categories
- Create new category
- Edit category name
- Delete category
- Hierarchical tree view
- Assign categories to items

**API Endpoints Available:**
- GET /categories
- POST /categories
- PUT /categories/:id
- DELETE /categories/:id
- GET /categories/tree

---

## Implementation Notes

### Organization Management UI Components:
```typescript
// OrganizationList.tsx
- Table with: Name, Locations, SKUs, Utilization, Actions
- Create button → Modal
- Edit button → Modal
- Delete button → Confirmation
- Manage Locations button → Modal with tenant selector

// CreateOrganizationModal.tsx
- Form: name, ownerId, maxLocations, maxTotalSKUs
- Subscription tier selector
- Submit → POST /organizations

// ManageLocationsModal.tsx
- Current locations list with remove button
- Add location dropdown (available tenants)
- Submit → POST /organizations/:id/tenants
```

### Billing Dashboard UI Components:
```typescript
// BillingDashboard.tsx
- Summary cards: Total tenants, At limit, Warning, OK
- Tenant table: Name, Tier, SKUs, Limit, Status, Actions
- Filter by status
- Set limit modal

// SetLimitModal.tsx
- Input for custom SKU limit
- Submit → POST /admin/billing/override
```

### Category Management UI Components:
```typescript
// CategoryManager.tsx
- Tree view of categories
- Create button → Modal
- Edit inline or modal
- Delete with confirmation
- Drag & drop for hierarchy (optional)

// CategoryModal.tsx
- Form: name, parent category
- Submit → POST /categories
```

---

## Admin Menu Structure

Add to `/settings/admin/page.tsx`:

```typescript
{
  title: 'Organizations',
  description: 'Manage chain organizations and multi-location accounts',
  icon: OrganizationIcon,
  href: '/admin/organizations',
  color: 'bg-orange-500',
},
{
  title: 'Billing Dashboard',
  description: 'View SKU usage, limits, and billing status',
  icon: BillingIcon,
  href: '/admin/billing',
  color: 'bg-green-500',
},
{
  title: 'Categories',
  description: 'Manage product categories and hierarchies',
  icon: CategoryIcon,
  href: '/admin/categories',
  color: 'bg-purple-500',
},
```

---

## Session Summary

### Completed This Session (19 commits):
1. ✅ Platform branding system
2. ✅ FAQ page (23 questions)
3. ✅ Features/pricing page
4. ✅ CSV bulk upload
5. ✅ SKU status management
6. ✅ Google feed generation
7. ✅ Status filtering
8. ✅ Badge legend
9. ✅ Chain-level SKU enforcement
10. ✅ Organization dashboard (view)
11. ✅ Chain indicators on tenant lists
12. ✅ Organization CRUD API
13. ✅ Test chain creation script

### Backend Infrastructure Complete:
- Organization management API
- Billing/policy API
- Category management API
- Performance analytics API
- Audit logging API
- Subscription management API

### Ready for UI Implementation:
All backend APIs are production-ready and waiting for frontend interfaces.
