# Staging User Journey Testing - Complete Coverage

**Purpose:** Comprehensive testing of all user types, tenant types, and organization scenarios  
**Environment:** Staging branch  
**Goal:** Find and fix bugs before production deployment

---

## 📊 Testing Coverage Matrix

### User Types
- ✅ Platform Admin
- ✅ Organization Owner
- ✅ Tenant Owner
- ✅ Tenant Admin
- ✅ Tenant Member
- ✅ Tenant Viewer
- ✅ Unauthenticated User (Public)

### Tenant Types
- ✅ Single Independent Tenant
- ✅ Tenant in Organization (Chain)
- ✅ Trial Tenant
- ✅ Paid Tenant (Starter, Pro, Enterprise)
- ✅ Tenant with Managed Services

### Organization Types
- ✅ No Organization (Independent)
- ✅ Small Chain (2-5 locations)
- ✅ Medium Chain (6-20 locations)
- ✅ Large Chain (21+ locations)

---

## 🎯 Testing Phases

### Phase 1: Authentication & Access Control (Week 1)
### Phase 2: Core CRUD Operations (Week 1-2)
### Phase 3: Integrations & Advanced Features (Week 2-3)
### Phase 4: Admin & Organization Features (Week 3)
### Phase 5: Edge Cases & Error Handling (Week 4)
### Phase 6: Performance & Polish (Week 4)

---

## 🔐 Phase 1: Authentication & Access Control

### Test 1.1: Platform Admin Authentication

**User:** Platform Admin  
**Scenario:** Admin login and access

- [ ] **Login Flow**
  - [ ] Go to `/login`
  - [ ] Enter admin email
  - [ ] Request magic link
  - [ ] Check email received
  - [ ] Click magic link
  - [ ] Verify redirect to admin dashboard
  - [ ] Verify "Signed in as [email]" shows
  - [ ] Verify role badge shows "ADMIN"

- [ ] **Admin Dashboard Access**
  - [ ] Can access `/settings/admin`
  - [ ] Can see system overview
  - [ ] Can see real tenant count
  - [ ] Can see real user count
  - [ ] All quick links work

- [ ] **Admin-Only Pages**
  - [ ] Can access `/settings/admin/users`
  - [ ] Can access `/settings/admin/tenants`
  - [ ] Can access `/settings/admin/features`
  - [ ] Can access propagation control panel (if applicable)

- [ ] **Logout**
  - [ ] Click logout
  - [ ] Verify redirect to login
  - [ ] Verify cannot access admin pages
  - [ ] Verify session cleared

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 1.2: Tenant Owner Authentication

**User:** Tenant Owner (no organization)  
**Scenario:** Owner login and access

- [ ] **Login Flow**
  - [ ] Go to `/login`
  - [ ] Enter owner email
  - [ ] Request magic link
  - [ ] Click magic link
  - [ ] Verify redirect to `/tenants` (not admin dashboard)
  - [ ] Verify sees own tenants only

- [ ] **Tenant Access**
  - [ ] Can see all owned tenants
  - [ ] Can create new tenant
  - [ ] Can edit owned tenants
  - [ ] Can delete owned tenants
  - [ ] Cannot see other users' tenants

- [ ] **Settings Access**
  - [ ] Can access `/settings/appearance`
  - [ ] Can access `/settings/language`
  - [ ] Can access `/settings/tenant`
  - [ ] CANNOT access `/settings/admin`
  - [ ] CANNOT access `/settings/admin/users`

- [ ] **Logout**
  - [ ] Logout works
  - [ ] Session cleared

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 1.3: Organization Owner Authentication

**User:** Organization Owner  
**Scenario:** Chain owner with multiple locations

- [ ] **Login Flow**
  - [ ] Login as organization owner
  - [ ] Verify redirect to tenants page
  - [ ] Verify sees all organization tenants

- [ ] **Organization Access**
  - [ ] Can see organization name/info
  - [ ] Can see all tenants in organization
  - [ ] Can add new tenant to organization
  - [ ] Can manage organization settings (if applicable)

- [ ] **Tenant Management**
  - [ ] Can create tenant in organization
  - [ ] Can edit any organization tenant
  - [ ] Can delete organization tenant
  - [ ] Can see tenant subscription status

- [ ] **Propagation Features** (if enabled)
  - [ ] Can access propagation control panel
  - [ ] Can propagate settings to all locations
  - [ ] Can see propagation status

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 1.4: Tenant Admin Access

**User:** Tenant Admin (not owner)  
**Scenario:** Admin user assigned to tenant

- [ ] **Login & Access**
  - [ ] Login as tenant admin
  - [ ] Verify sees assigned tenants only
  - [ ] Verify role shows "ADMIN"

- [ ] **Tenant Operations**
  - [ ] Can view tenant details
  - [ ] Can edit tenant settings
  - [ ] Can manage inventory
  - [ ] Can upload photos
  - [ ] Can manage users (if permission granted)

- [ ] **Restrictions**
  - [ ] Cannot delete tenant
  - [ ] Cannot see unassigned tenants
  - [ ] Cannot access platform admin features

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 1.5: Tenant Member Access

**User:** Tenant Member  
**Scenario:** Regular user with read/write access

- [ ] **Login & Access**
  - [ ] Login as member
  - [ ] Verify sees assigned tenants only
  - [ ] Verify role shows "MEMBER"

- [ ] **Allowed Operations**
  - [ ] Can view tenant details
  - [ ] Can view inventory
  - [ ] Can add items
  - [ ] Can edit items
  - [ ] Can upload photos

- [ ] **Restrictions**
  - [ ] Cannot edit tenant settings
  - [ ] Cannot delete tenant
  - [ ] Cannot manage users
  - [ ] Cannot access admin features

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 1.6: Tenant Viewer Access

**User:** Tenant Viewer  
**Scenario:** Read-only user

- [ ] **Login & Access**
  - [ ] Login as viewer
  - [ ] Verify sees assigned tenants only
  - [ ] Verify role shows "VIEWER"

- [ ] **Allowed Operations**
  - [ ] Can view tenant details
  - [ ] Can view inventory
  - [ ] Can view photos
  - [ ] Can view analytics (if available)

- [ ] **Restrictions**
  - [ ] Cannot create items
  - [ ] Cannot edit items
  - [ ] Cannot delete items
  - [ ] Cannot upload photos
  - [ ] Cannot edit tenant settings
  - [ ] All edit buttons disabled/hidden

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 1.7: Unauthenticated User (Public)

**User:** Not logged in  
**Scenario:** Public access to storefront

- [ ] **Public Storefront Access**
  - [ ] Can access `/tenant/[tenant-id]`
  - [ ] Storefront loads without login
  - [ ] Can see business name
  - [ ] Can see business hours
  - [ ] Can see products
  - [ ] Can see Google Maps (if enabled)

- [ ] **Restrictions**
  - [ ] Cannot access `/tenants`
  - [ ] Cannot access `/items`
  - [ ] Cannot access `/settings`
  - [ ] Redirected to login if accessing protected routes

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

## 📦 Phase 2: Core CRUD Operations

### Test 2.1: Tenant Management (Owner)

**User:** Tenant Owner  
**Scenario:** Complete tenant lifecycle

- [ ] **Create Tenant**
  - [ ] Click "Create Tenant"
  - [ ] Enter tenant name
  - [ ] Select region (US, EU, etc.)
  - [ ] Select language
  - [ ] Select currency
  - [ ] Click "Create"
  - [ ] Verify tenant appears in list
  - [ ] Verify tenant has correct defaults

- [ ] **View Tenant**
  - [ ] Click on tenant
  - [ ] Verify tenant details load
  - [ ] Verify items page loads
  - [ ] Verify empty state shows (if no items)

- [ ] **Edit Tenant**
  - [ ] Click "Edit Tenant"
  - [ ] Change tenant name
  - [ ] Change region
  - [ ] Change language
  - [ ] Change currency
  - [ ] Click "Save"
  - [ ] Verify changes saved
  - [ ] Verify changes reflected in UI

- [ ] **Business Profile**
  - [ ] Go to Settings → Tenant
  - [ ] Click "Edit Business Profile"
  - [ ] Enter business name
  - [ ] Enter address
  - [ ] Enter phone number (E.164 format)
  - [ ] Enter email
  - [ ] Enter website (https://)
  - [ ] Set business hours
  - [ ] Enable map display
  - [ ] Click "Save"
  - [ ] Verify profile saved
  - [ ] Verify storefront shows updated info

- [ ] **Delete Tenant**
  - [ ] Click "Delete Tenant"
  - [ ] Verify confirmation modal
  - [ ] Confirm deletion
  - [ ] Verify tenant removed from list
  - [ ] Verify tenant data deleted (check database)

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 2.2: Inventory Management (All CRUD)

**User:** Tenant Owner or Admin  
**Scenario:** Complete item lifecycle

- [ ] **Create Item**
  - [ ] Go to tenant items page
  - [ ] Click "Add Item"
  - [ ] Enter SKU
  - [ ] Enter name/title
  - [ ] Enter brand
  - [ ] Enter description
  - [ ] Enter price
  - [ ] Select category
  - [ ] Select availability (in stock, out of stock, preorder)
  - [ ] Select condition (new, refurbished, used)
  - [ ] Click "Create"
  - [ ] Verify item appears in list
  - [ ] Verify item has correct data

- [ ] **View Item**
  - [ ] Click on item
  - [ ] Verify item details load
  - [ ] Verify all fields display correctly
  - [ ] Verify photos section shows (empty if no photos)

- [ ] **Edit Item**
  - [ ] Click "Edit Item"
  - [ ] Change title
  - [ ] Change price
  - [ ] Change description
  - [ ] Change category
  - [ ] Change availability
  - [ ] Click "Save"
  - [ ] Verify changes saved
  - [ ] Verify changes reflected immediately

- [ ] **Upload Photos**
  - [ ] Click "Upload Photo"
  - [ ] Select image file (JPG, PNG, WebP)
  - [ ] Verify upload progress
  - [ ] Verify photo appears
  - [ ] Verify photo URL is Supabase storage
  - [ ] Upload multiple photos
  - [ ] Verify photo order/position

- [ ] **Delete Photo**
  - [ ] Click delete on photo
  - [ ] Verify confirmation
  - [ ] Confirm deletion
  - [ ] Verify photo removed
  - [ ] Verify photo deleted from storage

- [ ] **Delete Item**
  - [ ] Click "Delete Item"
  - [ ] Verify confirmation modal
  - [ ] Confirm deletion
  - [ ] Verify item removed from list
  - [ ] Verify photos also deleted

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 2.3: Bulk Operations

**User:** Tenant Owner  
**Scenario:** Managing multiple items

- [ ] **Bulk Selection**
  - [ ] Select multiple items (checkboxes)
  - [ ] Verify selection count shows
  - [ ] Verify bulk actions appear

- [ ] **Bulk Edit** (if available)
  - [ ] Select multiple items
  - [ ] Click "Bulk Edit"
  - [ ] Change category for all
  - [ ] Change availability for all
  - [ ] Click "Apply"
  - [ ] Verify all items updated

- [ ] **Bulk Delete**
  - [ ] Select multiple items
  - [ ] Click "Bulk Delete"
  - [ ] Verify confirmation shows count
  - [ ] Confirm deletion
  - [ ] Verify all items deleted

- [ ] **Search & Filter**
  - [ ] Search by SKU
  - [ ] Search by name
  - [ ] Filter by category
  - [ ] Filter by availability
  - [ ] Filter by brand
  - [ ] Verify results update correctly

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

## 🔗 Phase 3: Integrations & Advanced Features

### Test 3.1: Google Merchant Center OAuth

**User:** Tenant Owner  
**Scenario:** Connect Google Merchant Center

- [ ] **Initiate OAuth**
  - [ ] Go to Settings → Integrations
  - [ ] Click "Connect Google Merchant Center"
  - [ ] Verify redirect to Google
  - [ ] Verify correct app name shows
  - [ ] Verify correct scopes requested

- [ ] **Complete OAuth**
  - [ ] Select Google account
  - [ ] Grant permissions
  - [ ] Verify redirect back to app
  - [ ] Verify success message
  - [ ] Verify connection saved

- [ ] **View Connection**
  - [ ] Verify Google account email shows
  - [ ] Verify connection status "Connected"
  - [ ] Verify merchant ID shows (if linked)

- [ ] **Disconnect**
  - [ ] Click "Disconnect"
  - [ ] Verify confirmation
  - [ ] Confirm disconnection
  - [ ] Verify connection removed
  - [ ] Verify tokens deleted from database

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 3.2: Google My Business OAuth

**User:** Tenant Owner  
**Scenario:** Connect Google Business Profile

- [ ] **Initiate OAuth**
  - [ ] Go to Settings → Integrations
  - [ ] Click "Connect Google Business Profile"
  - [ ] Verify redirect to Google
  - [ ] Verify GMB scopes requested

- [ ] **Complete OAuth**
  - [ ] Select Google account
  - [ ] Grant business profile permissions
  - [ ] Verify redirect back
  - [ ] Verify success message
  - [ ] Verify connection saved

- [ ] **View Locations** (if available)
  - [ ] Verify business locations list
  - [ ] Verify location details
  - [ ] Verify can select primary location

- [ ] **Sync Business Hours** (if available)
  - [ ] Click "Sync Hours from GMB"
  - [ ] Verify hours imported
  - [ ] Verify hours display correctly

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 3.3: Public Storefront

**User:** Unauthenticated  
**Scenario:** View public storefront

- [ ] **Access Storefront**
  - [ ] Go to `/tenant/[tenant-id]`
  - [ ] Verify page loads without login
  - [ ] Verify business name displays
  - [ ] Verify business address displays

- [ ] **Business Information**
  - [ ] Verify phone number displays
  - [ ] Verify email displays (if public)
  - [ ] Verify website link works
  - [ ] Verify business hours display
  - [ ] Verify special hours display (holidays)

- [ ] **Google Maps**
  - [ ] Verify map loads
  - [ ] Verify correct location pin
  - [ ] Verify no "For development purposes only" watermark
  - [ ] Verify map is interactive
  - [ ] Verify "Get Directions" link works

- [ ] **Products Display**
  - [ ] Verify products list loads
  - [ ] Verify product images display
  - [ ] Verify product names display
  - [ ] Verify product prices display
  - [ ] Verify product descriptions display
  - [ ] Verify "Out of Stock" badge shows

- [ ] **Responsive Design**
  - [ ] Test on mobile (< 640px)
  - [ ] Test on tablet (640-1024px)
  - [ ] Test on desktop (1024px+)
  - [ ] Verify layout adapts correctly

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 3.4: Feature Flags

**User:** Platform Admin  
**Scenario:** Manage feature flags

- [ ] **Platform Feature Flags**
  - [ ] Go to `/settings/admin/features`
  - [ ] Verify all flags listed
  - [ ] Toggle flag on
  - [ ] Verify flag saved
  - [ ] Toggle flag off
  - [ ] Verify flag saved

- [ ] **Tenant Override**
  - [ ] Enable "Allow Tenant Override" for a flag
  - [ ] Go to tenant settings
  - [ ] Verify tenant can override flag
  - [ ] Toggle tenant flag
  - [ ] Verify tenant flag overrides platform flag

- [ ] **Flag Propagation**
  - [ ] Change platform flag
  - [ ] Verify change reflects for all tenants (without override)
  - [ ] Verify tenants with override keep their setting

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

## 🏢 Phase 4: Organization & Chain Features

### Test 4.1: Create Organization

**User:** Platform Admin  
**Scenario:** Create new chain organization

- [ ] **Create Organization**
  - [ ] Go to admin panel
  - [ ] Click "Create Organization"
  - [ ] Enter organization name
  - [ ] Select owner (user)
  - [ ] Set subscription tier (chain_starter, chain_pro, etc.)
  - [ ] Set max locations
  - [ ] Set max total SKUs
  - [ ] Click "Create"
  - [ ] Verify organization created

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 4.2: Add Tenant to Organization

**User:** Organization Owner  
**Scenario:** Add location to chain

- [ ] **Create Tenant in Organization**
  - [ ] Login as organization owner
  - [ ] Click "Add Location"
  - [ ] Enter tenant name
  - [ ] Select region
  - [ ] Verify tenant created in organization
  - [ ] Verify organization ID set

- [ ] **View Organization Tenants**
  - [ ] Verify all organization tenants listed
  - [ ] Verify tenant count matches
  - [ ] Verify can filter by organization

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 4.3: Organization Request Flow

**User:** Tenant Owner  
**Scenario:** Request to join organization

- [ ] **Submit Request**
  - [ ] Go to tenant settings
  - [ ] Click "Join Organization"
  - [ ] Select organization
  - [ ] Enter notes
  - [ ] Agree to cost
  - [ ] Submit request
  - [ ] Verify request created

- [ ] **Admin Review** (as Platform Admin)
  - [ ] Go to organization requests
  - [ ] Verify request listed
  - [ ] View request details
  - [ ] Approve request
  - [ ] Verify tenant added to organization

- [ ] **Reject Request** (alternate flow)
  - [ ] Submit another request
  - [ ] Admin rejects with reason
  - [ ] Verify tenant notified
  - [ ] Verify tenant not added to organization

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 4.4: Chain Propagation (if enabled)

**User:** Organization Owner  
**Scenario:** Propagate settings to all locations

- [ ] **Access Propagation Panel**
  - [ ] Login as organization owner
  - [ ] Go to propagation control panel
  - [ ] Verify all organization tenants listed

- [ ] **Propagate Business Hours**
  - [ ] Set business hours for one location
  - [ ] Click "Propagate to All"
  - [ ] Select target locations
  - [ ] Confirm propagation
  - [ ] Verify hours copied to all locations

- [ ] **Propagate Category Settings** (if available)
  - [ ] Set categories for one location
  - [ ] Propagate to all
  - [ ] Verify categories copied

- [ ] **View Propagation History**
  - [ ] Verify propagation log shows
  - [ ] Verify timestamp correct
  - [ ] Verify affected tenants listed

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

## 🏷️ Phase 5: Subscription & Tenant Types

### Test 5.1: Trial Tenant

**User:** New Tenant Owner  
**Scenario:** Trial tenant with limitations

- [ ] **Create Trial Tenant**
  - [ ] Create new tenant
  - [ ] Verify subscription status: "trial"
  - [ ] Verify subscription tier: "starter"
  - [ ] Verify trial end date set

- [ ] **Trial Limitations**
  - [ ] Verify SKU quota enforced (if applicable)
  - [ ] Verify feature restrictions (if applicable)
  - [ ] Verify trial banner shows

- [ ] **Trial Expiration** (if testable)
  - [ ] Set trial end date to past
  - [ ] Verify tenant access restricted
  - [ ] Verify upgrade prompt shows

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 5.2: Paid Tenant (Starter)

**User:** Tenant Owner  
**Scenario:** Starter tier tenant

- [ ] **Starter Tier Features**
  - [ ] Verify can create items
  - [ ] Verify SKU limit enforced (if applicable)
  - [ ] Verify basic features available
  - [ ] Verify advanced features restricted

- [ ] **Upgrade Prompt**
  - [ ] Verify upgrade CTA shows
  - [ ] Click "Upgrade"
  - [ ] Verify upgrade request form
  - [ ] Submit upgrade request
  - [ ] Verify request submitted

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 5.3: Paid Tenant (Pro)

**User:** Tenant Owner  
**Scenario:** Pro tier tenant

- [ ] **Pro Tier Features**
  - [ ] Verify higher SKU limit
  - [ ] Verify advanced features available
  - [ ] Verify Google integrations available
  - [ ] Verify analytics available (if applicable)

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 5.4: Enterprise Tenant

**User:** Tenant Owner  
**Scenario:** Enterprise tier with managed services

- [ ] **Enterprise Features**
  - [ ] Verify unlimited SKUs
  - [ ] Verify all features available
  - [ ] Verify dedicated support badge
  - [ ] Verify managed services active

- [ ] **Managed Services**
  - [ ] Verify dedicated manager info shows
  - [ ] Verify priority support available
  - [ ] Verify custom features enabled

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

## ⚠️ Phase 6: Error Handling & Edge Cases

### Test 6.1: Network Errors

**Scenario:** Handle network failures gracefully

- [ ] **API Timeout**
  - [ ] Simulate slow API response
  - [ ] Verify loading state shows
  - [ ] Verify timeout error shows
  - [ ] Verify retry button works

- [ ] **API Error (500)**
  - [ ] Trigger server error
  - [ ] Verify error message shows
  - [ ] Verify error is user-friendly
  - [ ] Verify retry option available

- [ ] **API Error (401)**
  - [ ] Expire session
  - [ ] Make API call
  - [ ] Verify redirect to login
  - [ ] Verify error message shows

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 6.2: Validation Errors

**Scenario:** Form validation works correctly

- [ ] **Tenant Creation Validation**
  - [ ] Try empty tenant name → Error shows
  - [ ] Try duplicate tenant name → Error shows
  - [ ] Try invalid region → Error shows

- [ ] **Item Creation Validation**
  - [ ] Try empty SKU → Error shows
  - [ ] Try duplicate SKU → Error shows
  - [ ] Try negative price → Error shows
  - [ ] Try invalid price format → Error shows

- [ ] **Business Profile Validation**
  - [ ] Try invalid phone format → Error shows
  - [ ] Try invalid email → Error shows
  - [ ] Try invalid website (no https) → Error shows
  - [ ] Try empty required fields → Error shows

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 6.3: Photo Upload Edge Cases

**Scenario:** Handle various photo upload scenarios

- [ ] **File Type Validation**
  - [ ] Try uploading .txt file → Error shows
  - [ ] Try uploading .pdf → Error shows
  - [ ] Upload .jpg → Success
  - [ ] Upload .png → Success
  - [ ] Upload .webp → Success

- [ ] **File Size Validation**
  - [ ] Try uploading 100MB file → Error shows
  - [ ] Upload 1MB file → Success
  - [ ] Upload 10MB file → Success

- [ ] **Upload Failures**
  - [ ] Simulate network error during upload
  - [ ] Verify error message shows
  - [ ] Verify can retry
  - [ ] Verify partial upload cleaned up

- [ ] **Multiple Photos**
  - [ ] Upload 5 photos at once
  - [ ] Verify all upload
  - [ ] Verify correct order
  - [ ] Verify can reorder

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 6.4: Concurrent Operations

**Scenario:** Multiple users editing same data

- [ ] **Concurrent Edits**
  - [ ] User A opens item for edit
  - [ ] User B opens same item for edit
  - [ ] User A saves changes
  - [ ] User B saves changes
  - [ ] Verify conflict handling (if implemented)
  - [ ] Verify data integrity

- [ ] **Concurrent Deletes**
  - [ ] User A starts deleting item
  - [ ] User B tries to edit same item
  - [ ] Verify appropriate error/warning

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 6.5: Browser Compatibility

**Scenario:** Works across browsers

- [ ] **Chrome/Edge**
  - [ ] All features work
  - [ ] UI renders correctly
  - [ ] No console errors

- [ ] **Firefox**
  - [ ] All features work
  - [ ] UI renders correctly
  - [ ] No console errors

- [ ] **Safari** (if available)
  - [ ] All features work
  - [ ] UI renders correctly
  - [ ] No console errors

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

## 🚀 Phase 7: Performance Testing

### Test 7.1: Large Data Sets

**Scenario:** Performance with many items

- [ ] **1,000 Items**
  - [ ] Create tenant with 1,000 items
  - [ ] Load items page
  - [ ] Verify pagination works
  - [ ] Verify search works
  - [ ] Verify filter works
  - [ ] Measure load time: _____ seconds

- [ ] **100 Photos per Item**
  - [ ] Create item with 100 photos
  - [ ] Load item details
  - [ ] Verify photos load
  - [ ] Verify scrolling smooth
  - [ ] Measure load time: _____ seconds

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

### Test 7.2: Concurrent Users

**Scenario:** Multiple users active simultaneously

- [ ] **5 Users Logged In**
  - [ ] Login with 5 different accounts
  - [ ] All perform operations simultaneously
  - [ ] Verify no conflicts
  - [ ] Verify no slowdowns

- [ ] **Database Connection Pool**
  - [ ] Monitor connection count
  - [ ] Verify no connection exhaustion
  - [ ] Verify connections released

**Bugs Found:**
```
- [ ] Bug #___: _______________________
  Situation: (What were you doing when the bug occurred?)
  Task: (What were you trying to accomplish?)
  Action: (What steps did you take?)
  Result: (What happened? What should have happened?)
  Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
```

---

## 📊 Testing Summary

### Coverage Statistics

**User Types Tested:**
- [ ] Platform Admin (7 tests)
- [ ] Organization Owner (4 tests)
- [ ] Tenant Owner (15 tests)
- [ ] Tenant Admin (3 tests)
- [ ] Tenant Member (2 tests)
- [ ] Tenant Viewer (2 tests)
- [ ] Unauthenticated (2 tests)

**Feature Areas Tested:**
- [ ] Authentication (7 tests)
- [ ] Tenant Management (4 tests)
- [ ] Inventory Management (8 tests)
- [ ] Google Integrations (2 tests)
- [ ] Storefront (1 test)
- [ ] Feature Flags (1 test)
- [ ] Organizations (4 tests)
- [ ] Subscriptions (4 tests)
- [ ] Error Handling (5 tests)
- [ ] Performance (2 tests)

**Total Tests:** 40+

---

## 🐛 Bug Tracking

## Real-World Example for template

Bug #042: Item deletion leaves orphaned photos

ENVIRONMENT:
- URL: https://retail-visibility-platform-web.vercel.app/tenants/clx123abc/items/clx456def
- Tenant ID: clx123abc
- User Role: Tenant Owner
- Browser: Chrome 120.0.6099.109
- Timestamp: 2025-11-07 01:45:32

SITUATION: Viewing item detail page with 3 attached photos

TASK: Delete item and all associated photos

ACTION: 
1. Navigated to /tenants/clx123abc/items
2. Clicked item SKU "TEST-001" 
3. Clicked "Delete Item" button
4. Confirmed deletion in modal

RESULT: 
Item deleted from database but photos remained in storage.
Expected: Photos deleted with item.
Console: No errors shown.

### How to Report Bugs (STAR Format)

Use this template for every bug:

```
Bug #___: [Short Description]

ENVIRONMENT:
- URL: https://retail-visibility-platform-web.vercel.app/[path]
- Tenant ID: [tenant-id] (if applicable)
- User Role: [Platform Admin / Tenant Owner / etc.]
- Browser: [Chrome 120 / Firefox 121 / Safari 17 / etc.]
- Timestamp: [YYYY-MM-DD HH:MM:SS]

SITUATION: What were you doing when the bug occurred?
(Example: "I was logged in as a Tenant Owner and viewing the items page for tenant 'abc-123'")

TASK: What were you trying to accomplish?
(Example: "I wanted to delete an item (SKU: TEST-001) that had 3 photos attached")

ACTION: What steps did you take?
(Example: "1. Navigated to /tenants/abc-123/items, 2. Clicked on item TEST-001, 3. Clicked 'Delete Item', 4. Confirmed deletion")

RESULT: What happened? What should have happened?
(Example: "Item was deleted from database but 3 photos remained in Supabase storage bucket. Expected: Photos should be deleted with item. Console showed no errors.")

Priority: [ ] Critical [ ] High [ ] Medium [ ] Low
Status: [ ] Open [ ] In Progress [ ] Fixed [ ] Verified
Assigned To: _________________
Date Found: _________________
Date Fixed: _________________
```

---

### Critical Bugs (Block Production)
```
Bug #001: _________________________________

SITUATION: 


TASK: 


ACTION: 


RESULT: 


Priority: [X] Critical [ ] High [ ] Medium [ ] Low
Status: [ ] Open [ ] In Progress [ ] Fixed [ ] Verified
Assigned To: _________________
Date Found: _________________
Date Fixed: _________________

---

Bug #002: _________________________________

SITUATION: 


TASK: 


ACTION: 


RESULT: 


Priority: [X] Critical [ ] High [ ] Medium [ ] Low
Status: [ ] Open [ ] In Progress [ ] Fixed [ ] Verified
Assigned To: _________________
Date Found: _________________
Date Fixed: _________________
```

---

### High Priority Bugs (Fix Before Production)
```
Bug #___: _________________________________

SITUATION: 


TASK: 


ACTION: 


RESULT: 


Priority: [ ] Critical [X] High [ ] Medium [ ] Low
Status: [ ] Open [ ] In Progress [ ] Fixed [ ] Verified
Assigned To: _________________
Date Found: _________________
Date Fixed: _________________
```

---

### Medium Priority Bugs (Fix Soon)
```
Bug #___: _________________________________

SITUATION: 


TASK: 


ACTION: 


RESULT: 


Priority: [ ] Critical [ ] High [X] Medium [ ] Low
Status: [ ] Open [ ] In Progress [ ] Fixed [ ] Verified
Assigned To: _________________
Date Found: _________________
Date Fixed: _________________
```

---

### Low Priority Bugs (Nice to Fix)
```
Bug #___: _________________________________

SITUATION: 


TASK: 


ACTION: 


RESULT: 


Priority: [ ] Critical [ ] High [ ] Medium [X] Low
Status: [ ] Open [ ] In Progress [ ] Fixed [ ] Verified
Assigned To: _________________
Date Found: _________________
Date Fixed: _________________
```

---

## ✅ Production Readiness Checklist

### Must Pass Before Production:
- [ ] All critical bugs fixed
- [ ] All high priority bugs fixed
- [ ] All user types tested
- [ ] All tenant types tested
- [ ] All organization scenarios tested
- [ ] Authentication works for all user types
- [ ] CRUD operations work correctly
- [ ] Google integrations work
- [ ] Storefront displays correctly
- [ ] Error handling works
- [ ] No console errors in browser
- [ ] No errors in Railway logs
- [ ] No errors in Vercel logs
- [ ] Performance acceptable (< 3s page load)
- [ ] Mobile responsive
- [ ] Works in Chrome, Firefox, Safari

### Nice to Have:
- [ ] All medium priority bugs fixed
- [ ] All low priority bugs documented
- [ ] Performance optimized (< 1s page load)
- [ ] Accessibility tested
- [ ] SEO optimized

---

## 🎯 When to Deploy to Main

**Deploy when:**
✅ All "Must Pass" items checked  
✅ No critical bugs in last 48 hours  
✅ All user journeys tested end-to-end  
✅ Confident in platform stability  
✅ Documentation complete  

**Current Status:** ⏳ Testing in Progress

---

**Testing Started:** _______________  
**Testing Completed:** _______________  
**Total Bugs Found:** _______________  
**Bugs Fixed:** _______________  
**Ready for Production:** ☐ Yes ☐ No

---

**Last Updated:** November 7, 2025  
**Version:** 1.0  
**Status:** Active Testing
