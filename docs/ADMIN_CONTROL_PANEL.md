# Admin Control Panel - Specification

**Status:** 🚧 In Development  
**Version:** 1.0.0  
**Date:** November 3, 2025

---

## 🎯 Overview

The **Admin Control Panel** is a powerful UI that exposes CLI tools and scripts through a beautiful, easy-to-use interface. It eliminates the need for command-line access and makes platform management accessible to the entire team.

### The Vision

Transform this:
```bash
cd apps/api
doppler run --config local -- node create-test-chain.js --name="Demo" --locations=3
doppler run --config local -- node seed-tenant-products.js --tenant=X --scenario=grocery --products=50 --draft
```

Into this:
```
Click "Create Test Chain" → Fill form → Click "Create" → Done! ✨
```

---

## 🎨 User Interface Design

### Main Page: `/admin/tools`

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ Admin Control Panel                                     │
│  Powerful tools for platform management                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🏢 Organization Management                                 │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ 🏗️ Create Test Chain   │  │ 🗑️ Delete Test Chain   │    │
│  │                         │  │                         │    │
│  │ Quickly create multi-  │  │ Remove test orgs and   │    │
│  │ location test orgs     │  │ all associated data    │    │
│  │                         │  │                         │    │
│  │ [Create →]             │  │ [Delete →]             │    │
│  └────────────────────────┘  └────────────────────────┘    │
│                                                              │
│  👤 User Management                                         │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ 👨‍💼 Create Admin User   │  │ 🧪 Create Test Tenant  │    │
│  │                         │  │                         │    │
│  │ Add new platform       │  │ Create standalone test │    │
│  │ administrators         │  │ tenants for testing    │    │
│  │                         │  │                         │    │
│  │ [Create →]             │  │ [Create →]             │    │
│  └────────────────────────┘  └────────────────────────┘    │
│                                                              │
│  📦 Data Management                                         │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ 🌱 Bulk Seed Products  │  │ 🧹 Bulk Clear Products │    │
│  │                         │  │                         │    │
│  │ Seed multiple tenants  │  │ Clear products from    │    │
│  │ with test data         │  │ multiple tenants       │    │
│  │                         │  │                         │    │
│  │ [Seed →]               │  │ [Clear →]              │    │
│  └────────────────────────┘  └────────────────────────┘    │
│                                                              │
│  🔧 Utilities                                               │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ ⏱️ Reset Rate Limits   │  │ 📋 View Audit Log      │    │
│  │                         │  │                         │    │
│  │ Clear Quick Start rate │  │ See all admin actions  │    │
│  │ limits for testing     │  │ taken on the platform  │    │
│  │                         │  │                         │    │
│  │ [Reset →]              │  │ [View →]               │    │
│  └────────────────────────┘  └────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Backend API Specification

### Base Route: `/api/admin/tools`

All routes require **admin authentication** and are **audit logged**.

### 1. Create Test Chain

**Endpoint:** `POST /api/admin/tools/test-chains`

**Request Body:**
```json
{
  "name": "Demo Retail Chain",
  "size": "medium",
  "scenario": "grocery",
  "seedProducts": true,
  "createAsDrafts": true
}
```

**Size Options:**
- `small`: 1 location, 200-400 SKUs
- `medium`: 3 locations, 600-1200 SKUs
- `large`: 5 locations, 1500-2500 SKUs

**Response:**
```json
{
  "success": true,
  "organizationId": "org_test_chain_001",
  "tenants": [
    { "id": "chain_location_main", "name": "Demo Chain - Main Store", "skuCount": 850 },
    { "id": "chain_location_downtown", "name": "Demo Chain - Downtown", "skuCount": 600 },
    { "id": "chain_location_uptown", "name": "Demo Chain - Uptown", "skuCount": 400 }
  ],
  "totalSkus": 1850,
  "message": "Test chain created successfully"
}
```

---

### 2. Delete Test Chain

**Endpoint:** `DELETE /api/admin/tools/test-chains/:organizationId`

**Query Params:**
- `confirm`: Must be `true` (safety check)

**Response:**
```json
{
  "success": true,
  "organizationId": "org_test_chain_001",
  "tenantsDeleted": 3,
  "productsDeleted": 1850,
  "message": "Test chain deleted successfully"
}
```

---

### 3. Create Admin User

**Endpoint:** `POST /api/admin/tools/users/admin`

**Request Body:**
```json
{
  "email": "admin@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "sendWelcomeEmail": true
}
```

**Response:**
```json
{
  "success": true,
  "userId": "user_abc123",
  "email": "admin@example.com",
  "temporaryPassword": "temp_pass_xyz",
  "message": "Admin user created successfully"
}
```

---

### 4. Create Test Tenant

**Endpoint:** `POST /api/admin/tools/tenants`

**Request Body:**
```json
{
  "name": "Test Store",
  "subscriptionTier": "professional",
  "scenario": "grocery",
  "productCount": 50,
  "createAsDrafts": true
}
```

**Response:**
```json
{
  "success": true,
  "tenantId": "tenant_xyz789",
  "name": "Test Store",
  "productsCreated": 50,
  "categoriesCreated": 8,
  "message": "Test tenant created successfully"
}
```

---

### 5. Bulk Seed Products

**Endpoint:** `POST /api/admin/tools/bulk-seed`

**Request Body:**
```json
{
  "tenantIds": ["tenant_1", "tenant_2", "tenant_3"],
  "scenario": "grocery",
  "productCount": 50,
  "createAsDrafts": true,
  "clearExisting": false
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    { "tenantId": "tenant_1", "productsCreated": 50, "status": "success" },
    { "tenantId": "tenant_2", "productsCreated": 50, "status": "success" },
    { "tenantId": "tenant_3", "productsCreated": 50, "status": "success" }
  ],
  "totalProductsCreated": 150,
  "message": "Bulk seed completed successfully"
}
```

---

### 6. Bulk Clear Products

**Endpoint:** `DELETE /api/admin/tools/bulk-clear`

**Request Body:**
```json
{
  "tenantIds": ["tenant_1", "tenant_2", "tenant_3"],
  "confirm": true
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    { "tenantId": "tenant_1", "productsDeleted": 50, "status": "success" },
    { "tenantId": "tenant_2", "productsDeleted": 50, "status": "success" },
    { "tenantId": "tenant_3", "productsDeleted": 50, "status": "success" }
  ],
  "totalProductsDeleted": 150,
  "message": "Bulk clear completed successfully"
}
```

---

### 7. Reset Rate Limits

**Endpoint:** `POST /api/admin/tools/reset-rate-limit`

**Request Body:**
```json
{
  "tenantId": "tenant_xyz789",
  "feature": "quick-start"
}
```

**Response:**
```json
{
  "success": true,
  "tenantId": "tenant_xyz789",
  "feature": "quick-start",
  "message": "Rate limit reset successfully"
}
```

---

### 8. View Audit Log

**Endpoint:** `GET /api/admin/tools/audit-log`

**Query Params:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)
- `action`: Filter by action type
- `userId`: Filter by user

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "log_123",
      "timestamp": "2025-11-03T14:30:00Z",
      "userId": "user_abc",
      "userName": "John Doe",
      "action": "create_test_chain",
      "details": { "organizationId": "org_test_chain_001", "tenants": 3 },
      "ipAddress": "192.168.1.1"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalItems": 150,
    "totalPages": 3
  }
}
```

---

## 🎨 Frontend Components

### 1. Main Dashboard (`/admin/tools/page.tsx`)
- Grid of action cards
- Each card links to specific tool
- Shows recent activity

### 2. Create Test Chain Modal
- Form with name, size, scenario
- Checkboxes for seed products, create as drafts
- Progress indicator during creation
- Success screen with tenant IDs

### 3. Delete Test Chain Modal
- Search/select organization
- Show preview of what will be deleted
- Confirmation checkbox
- Danger button with confirmation

### 4. Bulk Seed Modal
- Multi-select tenant dropdown
- Scenario selector
- Product count slider
- Draft mode checkbox
- Progress bar showing per-tenant progress

### 5. Audit Log Viewer
- Filterable table
- Date range picker
- Action type filter
- User filter
- Export to CSV

---

## 🔒 Security & Permissions

### Authentication
- **Required:** Platform admin role
- **Middleware:** `requireAdmin`
- **Session:** Must be authenticated

### Audit Logging
Every action logs:
- User ID and name
- Timestamp
- Action type
- Details (IDs, counts, etc.)
- IP address
- Success/failure status

### Rate Limiting
- **Create Test Chain:** 10 per hour per admin
- **Bulk Operations:** 5 per hour per admin
- **Delete Operations:** 3 per hour per admin (safety)

### Confirmation Requirements
- **Delete operations:** Require `confirm: true` in request
- **Bulk operations:** Show preview before execution
- **Destructive actions:** Double confirmation in UI

---

## 📊 Success Metrics

### Time Savings
- **Before:** 5-10 minutes per test chain (CLI)
- **After:** 30 seconds (UI)
- **Savings:** 90% reduction in time

### Error Reduction
- **Before:** 20% error rate (typos, wrong params)
- **After:** 2% error rate (visual validation)
- **Improvement:** 90% fewer errors

### Team Enablement
- **Before:** Only devs with CLI access
- **After:** All admins, support, QA
- **Impact:** 5x more people can manage platform

---

## 🚀 Implementation Phases

### Phase 1: Backend APIs (2-3 hours)
- [x] Extract logic from CLI scripts (already done for Quick Start!)
- [ ] Create admin tools routes
- [ ] Add authentication middleware
- [ ] Add audit logging
- [ ] Add rate limiting

### Phase 2: Frontend UI (3-4 hours)
- [ ] Create `/admin/tools` page
- [ ] Build action cards
- [ ] Create modals for each tool
- [ ] Add progress indicators
- [ ] Add success/error notifications

### Phase 3: Polish (1-2 hours)
- [ ] Add audit log viewer
- [ ] Add bulk tenant selector
- [ ] Add presets (e.g., "M3 Test Setup")
- [ ] Add keyboard shortcuts
- [ ] Add tooltips and help text

---

## 🎯 Future Enhancements

### Phase 4: Advanced Features
- **Scheduled Actions:** Schedule test chain creation
- **Templates:** Save common configurations
- **Webhooks:** Notify on completion
- **Bulk Import:** CSV upload for mass tenant creation
- **Analytics:** Dashboard of platform usage

### Phase 5: Self-Service
- **Tenant Self-Service:** Let tenants use Quick Start
- **Organization Admins:** Let org admins manage their tenants
- **API Keys:** Generate API keys for automation

---

## 📚 Related Documentation

- [Quick Start Feature](./QUICK_START_FEATURE.md) - Reusable logic
- [Seeding Guide](../apps/api/SEEDING_GUIDE.md) - CLI scripts
- [M3 Session Summary](./M3_SESSION_SUMMARY.md) - Context

---

## 🎊 Conclusion

The Admin Control Panel transforms platform management from a developer-only CLI experience into a beautiful, accessible UI that anyone on the team can use. By reusing the logic we've already built for Quick Start and seeding scripts, we get 80% of the functionality for 20% of the effort.

**This is the path to platform excellence!** 🚀

---

**Built with ❤️ following the path we've already blazed**
