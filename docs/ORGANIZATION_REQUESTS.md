# Organization Request Workflow Documentation

## Overview

The Organization Request system allows tenants to request to join chain organizations. This enables multi-location businesses to manage multiple stores under a single organization with shared SKU limits and centralized management.

---

## Workflow Overview

```
1. Admin Creates Organization
   ↓
2. Tenant Requests to Join
   ↓
3. Admin Reviews Request
   ↓
4. Admin Sets Cost & Approves
   ↓
5. Tenant Agrees to Cost
   ↓
6. Tenant Assigned to Organization
```

---

## Step-by-Step Process

### 1. Admin Creates Organization

**Location:** `/admin/organizations`

**Steps:**
1. Click "+ Create New Organization" button
2. Fill in organization details:
   - **Name:** e.g., "Acme Restaurant Chain"
   - **Subscription Tier:** Chain Starter, Professional, or Enterprise
   - **Max Locations:** Number of stores allowed
   - **Max Total SKUs:** Total SKUs across all locations

**Example:**
```json
{
  "name": "Acme Restaurant Chain",
  "subscriptionTier": "chain_professional",
  "maxLocations": 25,
  "maxTotalSKUs": 100000,
  "subscriptionStatus": "active"
}
```

**Chain Tiers:**
- **Chain Starter:** 10 locations, 50K SKUs, $199/month
- **Chain Professional:** 25 locations, 150K SKUs, $499/month
- **Chain Enterprise:** 100 locations, 500K SKUs, $999/month

---

### 2. Tenant Requests to Join

**Location:** `/settings/tenant`

**Who Can Request:**
- Tenant OWNER role (non-admin users)

**Steps:**
1. Navigate to Tenant Settings
2. Find "Organization" section
3. Click "Request to Join" button
4. Select organization from dropdown
5. Add optional notes
6. Submit request

**What Happens:**
```javascript
POST /organization-requests
{
  "tenantId": "tenant-123",
  "organizationId": "org-456",
  "requestedBy": "user-789",
  "requestType": "join",
  "notes": "We have 3 locations and want to join"
}
```

**Email Notification:**
- Opens mailto: link with pre-filled admin email
- Subject: "Organization Request - [Tenant] → [Organization]"
- Body includes tenant details and request info

---

### 3. Admin Reviews Request

**Location:** `/settings/admin/organization-requests`

**Admin View:**
- List of all pending requests
- Tenant name and organization name
- Request date
- Requested by (user email)
- Notes from tenant

**Request Details:**
```json
{
  "id": "req-123",
  "tenantId": "tenant-123",
  "organizationId": "org-456",
  "requestedBy": "user-789",
  "status": "pending",
  "requestType": "join",
  "notes": "We have 3 locations...",
  "createdAt": "2025-10-28T12:00:00Z"
}
```

---

### 4. Admin Sets Cost & Approves

**Location:** `/settings/admin/organization-requests` (request detail)

**Admin Actions:**
1. Review tenant's current usage
2. Calculate appropriate cost
3. Enter estimated monthly cost
4. Select currency (USD, EUR, etc.)
5. Add admin notes (optional)
6. Click "Approve & Set Cost"

**Example:**
```json
{
  "status": "approved",
  "estimatedCost": 299.00,
  "costCurrency": "USD",
  "adminNotes": "Approved for 3 locations, $299/month",
  "processedBy": "admin-user-id",
  "processedAt": "2025-10-28T13:00:00Z"
}
```

**Email Notification:**
- Tenant receives email with cost details
- Link to tenant settings to agree to cost

---

### 5. Tenant Agrees to Cost

**Location:** `/settings/tenant`

**Tenant View:**
- Sees pending request with cost
- Alert box shows:
  - Organization name
  - Estimated monthly cost
  - Admin notes
  - "Agree to Cost" button

**Steps:**
1. Review cost and terms
2. Click "Agree to Cost" button
3. Confirm agreement

**What Happens:**
```javascript
PATCH /organization-requests/:id
{
  "costAgreed": true,
  "costAgreedAt": "2025-10-28T14:00:00Z"
}
```

---

### 6. Tenant Assigned to Organization

**Automatic Assignment:**

When both conditions are met:
- ✅ Admin has approved (`status: 'approved'`)
- ✅ Tenant has agreed to cost (`costAgreed: true`)

The system automatically assigns the tenant:

```javascript
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    organizationId: organizationId
  }
});
```

**Result:**
- Tenant is now part of the organization
- Shares organization's SKU limits
- Visible in organization's tenant list
- Request marked as complete

---

## Alternative Flow: Admin Direct Assignment

**Location:** `/settings/tenant` (Admin only)

**For Admins:**
1. Navigate to any tenant's settings
2. Click "Edit" in Organization section
3. Select organization from dropdown
4. Click "Save"
5. **Instant assignment** - no request/approval needed

**Use Cases:**
- Internal testing
- Pre-approved partnerships
- Quick setup for demos

---

## API Endpoints

### List Organization Requests

```
GET /organization-requests
```

**Query Parameters:**
- `status` - Filter by status (pending, approved, rejected)
- `tenantId` - Filter by tenant
- `organizationId` - Filter by organization
- `userId` - Filter by requesting user

**Response:**
```json
[
  {
    "id": "req-123",
    "tenantId": "tenant-123",
    "organizationId": "org-456",
    "tenant": {
      "id": "tenant-123",
      "name": "Store A"
    },
    "organization": {
      "id": "org-456",
      "name": "Acme Chain",
      "subscriptionTier": "chain_professional"
    },
    "status": "pending",
    "requestType": "join",
    "notes": "...",
    "createdAt": "2025-10-28T12:00:00Z"
  }
]
```

### Create Organization Request

```
POST /organization-requests
```

**Request:**
```json
{
  "tenantId": "tenant-123",
  "organizationId": "org-456",
  "requestedBy": "user-789",
  "requestType": "join",
  "notes": "Optional notes"
}
```

**Validation:**
- Checks for existing pending request
- Returns 409 if duplicate found

### Update Organization Request

```
PATCH /organization-requests/:id
```

**Admin Approval:**
```json
{
  "status": "approved",
  "estimatedCost": 299.00,
  "costCurrency": "USD",
  "adminNotes": "Approved for 3 locations",
  "processedBy": "admin-user-id"
}
```

**Tenant Cost Agreement:**
```json
{
  "costAgreed": true
}
```

**Rejection:**
```json
{
  "status": "rejected",
  "adminNotes": "Does not meet requirements",
  "processedBy": "admin-user-id"
}
```

### Delete Organization Request

```
DELETE /organization-requests/:id
```

**Use Cases:**
- Tenant cancels request
- Admin removes duplicate request

---

## Database Schema

### OrganizationRequest Model

```prisma
model OrganizationRequest {
  id              String    @id @default(cuid())
  tenantId        String
  organizationId  String
  requestedBy     String
  requestType     String    @default("join")
  status          String    @default("pending")
  notes           String?
  adminNotes      String?
  estimatedCost   Decimal?
  costCurrency    String?   @default("USD")
  costAgreed      Boolean   @default(false)
  costAgreedAt    DateTime?
  processedBy     String?
  processedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  organization    Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**Status Values:**
- `pending` - Awaiting admin review
- `approved` - Admin approved, awaiting cost agreement
- `rejected` - Admin rejected request
- `completed` - Tenant assigned to organization

---

## UI Components

### Admin Organizations Page

**Location:** `/admin/organizations`

**Features:**
- List all organizations
- View organization details
- Manage organization tenants
- **Create new organization** button

### Organization Request Form (Tenant)

**Location:** `/settings/tenant`

**Features:**
- Select organization dropdown
- Notes textarea
- Submit button
- Shows pending request status

### Organization Request Admin Page

**Location:** `/settings/admin/organization-requests`

**Features:**
- List all requests
- Filter by status
- View request details
- Approve/reject actions
- Set cost and currency

---

## Email Notifications

### Request Created (to Admin)

**Trigger:** Tenant submits request

**Content:**
```
Subject: Organization Request - [Tenant Name] → [Organization Name]

Hello,

A new organization request has been submitted:

Tenant: [Tenant Name]
Organization: [Organization Name]
Requested by: [User Email]
Notes: [Tenant Notes]

Please review and approve/reject this request.

View Request: [Link to Admin Page]
```

### Request Approved (to Tenant)

**Trigger:** Admin approves and sets cost

**Content:**
```
Subject: Organization Request Approved - [Organization Name]

Hello,

Your request to join [Organization Name] has been approved!

Estimated Monthly Cost: $[Amount] [Currency]
Admin Notes: [Admin Notes]

Please review and agree to the cost to complete the process.

Agree to Cost: [Link to Tenant Settings]
```

---

## Business Rules

### Duplicate Prevention

- Only one pending request per tenant-organization pair
- System checks before creating new request
- Returns 409 Conflict if duplicate exists

### Cost Agreement Required

- Tenant must explicitly agree to cost
- No auto-assignment without agreement
- Protects both parties legally

### Admin Approval Required

- All requests require admin review
- No auto-approval based on criteria
- Ensures quality control

---

## Testing

### Local Testing

**1. Create Organization:**
```bash
# Via UI: /admin/organizations
# Or via API:
POST /api/organizations
{
  "name": "Test Chain",
  "subscriptionTier": "chain_starter",
  "maxLocations": 10,
  "maxTotalSKUs": 50000
}
```

**2. Create Request:**
```bash
# Via UI: /settings/tenant
# Or via API:
POST /api/organization-requests
{
  "tenantId": "demo-tenant",
  "organizationId": "[org-id]",
  "requestedBy": "[user-id]",
  "notes": "Test request"
}
```

**3. Approve Request:**
```bash
# Via UI: /settings/admin/organization-requests
# Or via API:
PATCH /api/organization-requests/[request-id]
{
  "status": "approved",
  "estimatedCost": 299,
  "costCurrency": "USD"
}
```

**4. Agree to Cost:**
```bash
# Via UI: /settings/tenant
# Or via API:
PATCH /api/organization-requests/[request-id]
{
  "costAgreed": true
}
```

**5. Verify Assignment:**
```bash
GET /api/tenants/[tenant-id]
# Should show organizationId
```

---

## Troubleshooting

### Request Not Showing

**Cause:** Not fetching with correct filters

**Solution:** Check API call includes proper query params

### Assignment Not Happening

**Cause:** Missing approval or cost agreement

**Solution:** Verify both `status: 'approved'` AND `costAgreed: true`

### Duplicate Request Error

**Cause:** Existing pending request

**Solution:** Cancel/complete existing request first

---

## Future Enhancements

### Recommended Features

1. **Multi-Step Approval**
   - Multiple admin approvers
   - Approval workflow with stages

2. **Contract Management**
   - Upload and store contracts
   - Digital signature integration
   - Contract templates

3. **Automated Cost Calculation**
   - Based on tenant size/usage
   - Tiered pricing rules
   - Discount codes

4. **Request Analytics**
   - Approval rate tracking
   - Average processing time
   - Conversion metrics

5. **Tenant Notifications**
   - In-app notifications
   - SMS notifications
   - Slack/Teams integration

---

## Related Documentation

- [Trial Management](./TRIAL_MANAGEMENT.md)
- [Organization Management](./ORGANIZATIONS.md)
- [Admin Features](./ADMIN_FEATURES.md)
- [Email Configuration](./EMAIL_CONFIGURATION.md)
