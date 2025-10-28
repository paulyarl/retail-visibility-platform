# Organization Request Workflow

## Overview

The Organization Request Workflow allows tenant owners to request joining a chain organization, with a multi-step approval process that includes cost confirmation and email notifications for audit trail purposes.

## Table of Contents

- [Architecture](#architecture)
- [User Roles](#user-roles)
- [Workflow Steps](#workflow-steps)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [UI Components](#ui-components)
- [Email Notifications](#email-notifications)
- [Configuration](#configuration)
- [Testing](#testing)

---

## Architecture

### System Components

```
┌─────────────────┐
│  Tenant Owner   │
│   (OWNER role)  │
└────────┬────────┘
         │
         │ 1. Submit Request
         ▼
┌─────────────────────────────┐
│  Organization Request       │
│  Database Table             │
│  - Status: pending          │
│  - Cost: null               │
└────────┬────────────────────┘
         │
         │ 2. Review & Set Cost
         ▼
┌─────────────────┐
│ Platform Admin  │
│  (ADMIN role)   │
└────────┬────────┘
         │
         │ 3. Cost Agreement
         ▼
┌─────────────────┐
│  Tenant Owner   │
│  Agrees to Cost │
└────────┬────────┘
         │
         │ 4. Final Approval
         ▼
┌─────────────────┐
│ Platform Admin  │
│ Approves/Rejects│
└────────┬────────┘
         │
         │ 5. Auto-Assignment
         ▼
┌─────────────────────────────┐
│  Tenant.organizationId      │
│  Updated                    │
└─────────────────────────────┘
```

---

## User Roles

### Platform Admin (ADMIN)
- **Access:** Full system access
- **Capabilities:**
  - View all organization requests
  - Set estimated costs
  - Approve/reject requests
  - Direct tenant-to-organization assignment
- **UI Location:** `/settings/admin/organization-requests`

### Tenant Owner (OWNER)
- **Access:** Own tenant management
- **Capabilities:**
  - Submit requests to join organizations
  - View pending request status
  - Agree to estimated costs
  - Cancel pending requests
- **UI Location:** `/settings/tenant`

### Regular User (USER)
- **Access:** No organization management
- **Capabilities:** None for organization requests

---

## Workflow Steps

### Step 1: Request Submission (Tenant Owner)

**Location:** `/settings/tenant` → Organization Assignment Card

**Actions:**
1. Click "Request to Join" button
2. Select target organization from dropdown
3. Add business justification (optional)
4. Submit request

**Result:**
- Request created with status: `pending`
- Email sent to admin team
- Tenant owner sees pending request alert

**Email Sent:**
```
To: organizations@yourplatform.com
Subject: Organization Request - [Tenant] → [Organization]
Body: Request details with link to admin dashboard
```

---

### Step 2: Cost Setting (Platform Admin)

**Location:** `/settings/admin/organization-requests`

**Actions:**
1. View pending requests in dashboard
2. Click "View Details" on a request
3. Review business justification
4. Set estimated monthly cost (auto-suggested based on org tier)
5. Add admin notes (optional)
6. Click "Set Cost"

**Result:**
- Request updated with `estimatedCost`
- Status remains: `pending`
- Admin receives reminder to notify tenant owner

**Auto-Suggested Costs:**
- Chain Starter: $199/month
- Chain Professional: $499/month
- Chain Enterprise: $999/month

---

### Step 3: Cost Agreement (Tenant Owner)

**Location:** `/settings/tenant` → Pending Request Alert

**Actions:**
1. Review estimated cost in alert
2. Click "Agree to Cost" button

**Result:**
- Request updated: `costAgreed = true`
- `costAgreedAt` timestamp recorded
- Status remains: `pending`
- Admin can now approve

---

### Step 4: Final Decision (Platform Admin)

**Location:** `/settings/admin/organization-requests`

**Actions:**

#### To Approve:
1. Verify cost agreement badge is present
2. Click "Approve" button
3. Confirm action

**Result:**
- Request status: `approved`
- Tenant automatically assigned to organization
- `processedBy` and `processedAt` recorded
- Email sent to tenant owner

#### To Reject:
1. Click "Reject" button
2. Provide rejection reason
3. Confirm action

**Result:**
- Request status: `rejected`
- Reason stored in `adminNotes`
- `processedBy` and `processedAt` recorded
- Email sent to tenant owner with reason

---

## Database Schema

### OrganizationRequest Table

```sql
CREATE TABLE organization_requests (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  requested_by        TEXT NOT NULL,      -- User ID who made request
  status              TEXT DEFAULT 'pending',  -- pending, approved, rejected
  request_type        TEXT DEFAULT 'join',     -- join, leave
  estimated_cost      FLOAT,
  cost_currency       TEXT DEFAULT 'USD',
  notes               TEXT,                    -- Tenant owner's notes
  admin_notes         TEXT,                    -- Admin's notes
  cost_agreed         BOOLEAN DEFAULT false,
  cost_agreed_at      TIMESTAMP,
  processed_by        TEXT,                    -- Admin user ID
  processed_at        TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
);

CREATE INDEX idx_org_req_tenant ON organization_requests(tenant_id);
CREATE INDEX idx_org_req_org ON organization_requests(organization_id);
CREATE INDEX idx_org_req_status ON organization_requests(status);
CREATE INDEX idx_org_req_requester ON organization_requests(requested_by);
CREATE INDEX idx_org_req_created ON organization_requests(created_at);
```

### Relations

**Tenant Model:**
```typescript
model Tenant {
  // ... other fields
  organizationRequests  OrganizationRequest[]
}
```

**Organization Model:**
```typescript
model Organization {
  // ... other fields
  organizationRequests  OrganizationRequest[]
}
```

---

## API Endpoints

### GET /api/organization-requests

**Description:** List all organization requests (with optional filters)

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected)
- `tenantId` (optional): Filter by tenant
- `userId` (optional): Filter by requester

**Response:**
```json
[
  {
    "id": "req_123",
    "tenantId": "tenant_456",
    "organizationId": "org_789",
    "requestedBy": "user_abc",
    "status": "pending",
    "requestType": "join",
    "estimatedCost": 499,
    "costCurrency": "USD",
    "notes": "We have 3 locations...",
    "adminNotes": null,
    "costAgreed": false,
    "costAgreedAt": null,
    "processedBy": null,
    "processedAt": null,
    "createdAt": "2024-10-28T10:00:00Z",
    "updatedAt": "2024-10-28T10:00:00Z",
    "tenant": {
      "id": "tenant_456",
      "name": "Downtown Store"
    },
    "organization": {
      "id": "org_789",
      "name": "Acme Chain",
      "subscriptionTier": "chain_professional"
    }
  }
]
```

---

### POST /api/organization-requests

**Description:** Create a new organization request

**Request Body:**
```json
{
  "tenantId": "tenant_456",
  "organizationId": "org_789",
  "requestedBy": "user_abc",
  "requestType": "join",
  "notes": "We would like to join to benefit from shared SKU pool"
}
```

**Response:** 201 Created
```json
{
  "id": "req_123",
  "tenantId": "tenant_456",
  "organizationId": "org_789",
  "status": "pending",
  // ... full request object
}
```

**Error Responses:**
- `400`: Missing required fields
- `409`: Pending request already exists for this tenant/organization pair

---

### GET /api/organization-requests/:id

**Description:** Get a specific organization request

**Response:** 200 OK (same structure as list endpoint)

**Error Responses:**
- `404`: Request not found

---

### PATCH /api/organization-requests/:id

**Description:** Update an organization request (set cost, approve, reject, agree to cost)

**Request Body Examples:**

**Set Cost:**
```json
{
  "estimatedCost": 499,
  "adminNotes": "Based on Chain Professional tier"
}
```

**Agree to Cost:**
```json
{
  "costAgreed": true
}
```

**Approve:**
```json
{
  "status": "approved",
  "processedBy": "admin_user_id"
}
```

**Reject:**
```json
{
  "status": "rejected",
  "processedBy": "admin_user_id",
  "adminNotes": "Reason for rejection"
}
```

**Response:** 200 OK (updated request object)

**Side Effects:**
- When approved with `costAgreed = true`: Tenant's `organizationId` is automatically updated

---

### DELETE /api/organization-requests/:id

**Description:** Cancel/delete a request

**Response:** 200 OK
```json
{
  "success": true
}
```

---

## UI Components

### Tenant Owner UI

**File:** `apps/web/src/app/settings/tenant/page.tsx`

**Components:**

#### Organization Assignment Card
- Shows current organization status (Standalone vs Chain)
- "Request to Join" button (visible when no pending request)
- Pending request alert with cost details
- "Agree to Cost" button
- "Cancel Request" button

#### Request Modal
- Organization selector dropdown
- Business justification textarea
- Workflow explanation
- Submit/Cancel buttons

---

### Platform Admin UI

**File:** `apps/web/src/app/settings/admin/organization-requests/page.tsx`

**Components:**

#### Dashboard Stats
- Pending requests count
- Approved requests count
- Rejected requests count
- Cost agreed count

#### Filters
- All / Pending / Approved / Rejected

#### Request List
- Tenant name → Organization name
- Status badges
- Cost agreed indicator
- View Details / Approve / Reject buttons

#### Detail Modal
- Request information summary
- Business justification
- Cost input with tier-based auto-suggestion
- Admin notes textarea
- Cost agreement status
- Action buttons (Set Cost / Approve / Reject)

---

## Email Notifications

### Configuration

**File:** `apps/web/src/lib/admin-emails.ts`

**Email Category:** `organization_requests`

**Default Email:** `organizations@yourplatform.com`

**Customization:**
```typescript
import { getAdminEmail } from '@/lib/admin-emails';

const email = getAdminEmail('organization_requests');
// Returns configured email or default
```

---

### Email Templates

#### 1. Request Submitted (to Admin)
```
To: organizations@yourplatform.com
Subject: Organization Request - [Tenant Name] → [Organization Name]

Hello,

A new organization request has been submitted:

Tenant: [Tenant Name]
Organization: [Organization Name]
Requested by: [User Email]
Notes: [Business Justification]

Please review this request in the admin dashboard:
[Dashboard URL]

Best regards,
[Tenant Name]
```

#### 2. Request Approved (to Tenant Owner)
```
To: [Tenant Owner Email]
Subject: Organization Request Approved - [Tenant Name]

Hello,

Great news! Your request to join [Organization Name] has been approved.

Tenant: [Tenant Name]
Organization: [Organization Name]
Monthly Cost: $[Amount] [Currency]

Your tenant has been successfully assigned to the organization.

Best regards,
Platform Administration Team
```

#### 3. Request Rejected (to Tenant Owner)
```
To: [Tenant Owner Email]
Subject: Organization Request Update - [Tenant Name]

Hello,

We regret to inform you that your request to join [Organization Name] 
has been declined.

Tenant: [Tenant Name]
Organization: [Organization Name]
Reason: [Rejection Reason]

If you have any questions or would like to discuss this further, 
please don't hesitate to reach out.

Best regards,
Platform Administration Team
```

---

## Configuration

### Chain Tier Pricing

**File:** `apps/web/src/lib/chain-tiers.ts`

```typescript
export const CHAIN_TIERS = {
  chain_starter: {
    name: 'Chain Starter',
    price: '$199/month',
    pricePerMonth: 199,
    maxLocations: 5,
    maxTotalSKUs: 2500,
  },
  chain_professional: {
    name: 'Chain Professional',
    price: '$499/month',
    pricePerMonth: 499,
    maxLocations: 15,
    maxTotalSKUs: 25000,
  },
  chain_enterprise: {
    name: 'Chain Enterprise',
    price: '$999/month',
    pricePerMonth: 999,
    maxLocations: Infinity,
    maxTotalSKUs: Infinity,
  },
};
```

### Admin Email Configuration

Admins can configure the email address via:
- API: `POST /api/admin/email-config`
- Category: `organization_requests`
- Email: Custom email address

---

## Testing

### Manual Testing Checklist

#### As Tenant Owner:
- [ ] Submit request to join organization
- [ ] Verify email opens with pre-filled content
- [ ] View pending request in tenant settings
- [ ] See estimated cost when admin sets it
- [ ] Agree to cost
- [ ] Cancel request
- [ ] Receive approval/rejection email

#### As Platform Admin:
- [ ] View all requests in dashboard
- [ ] Filter by status (pending, approved, rejected)
- [ ] Open request details
- [ ] Verify cost auto-suggestion based on org tier
- [ ] Set estimated cost
- [ ] View cost agreed status
- [ ] Approve request
- [ ] Verify tenant is assigned to organization
- [ ] Reject request with reason
- [ ] Verify email opens for approval/rejection

#### Edge Cases:
- [ ] Submit duplicate request (should fail with 409)
- [ ] Approve without cost agreement (button disabled)
- [ ] Cancel request after cost is set
- [ ] Change organization tier and verify new cost suggestion

---

### API Testing

```bash
# Create a request
curl -X POST http://localhost:3000/api/organization-requests \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant_123",
    "organizationId": "org_456",
    "requestedBy": "user_789",
    "notes": "Test request"
  }'

# List requests
curl http://localhost:3000/api/organization-requests?status=pending

# Set cost
curl -X PATCH http://localhost:3000/api/organization-requests/req_123 \
  -H "Content-Type: application/json" \
  -d '{
    "estimatedCost": 499,
    "adminNotes": "Based on tier"
  }'

# Agree to cost
curl -X PATCH http://localhost:3000/api/organization-requests/req_123 \
  -H "Content-Type: application/json" \
  -d '{
    "costAgreed": true
  }'

# Approve
curl -X PATCH http://localhost:3000/api/organization-requests/req_123 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "processedBy": "admin_123"
  }'
```

---

## Troubleshooting

### Request not appearing in admin dashboard
- Check request status filter
- Verify request was created successfully
- Check database for request record

### Cost not auto-suggesting
- Verify organization has `subscriptionTier` set
- Check `CHAIN_TIERS` configuration
- Verify tier value matches enum

### Email not opening
- Check browser popup blocker
- Verify `mailto:` protocol is configured
- Check email configuration in admin settings

### Tenant not assigned after approval
- Verify `costAgreed` is true before approval
- Check API response for errors
- Verify tenant and organization IDs are valid

---

## Future Enhancements

### Potential Features:
- [ ] Automated email sending (vs mailto: links)
- [ ] Bulk approval for multiple requests
- [ ] Request expiration after X days
- [ ] Notification preferences per user
- [ ] Request history/audit log view
- [ ] Cost negotiation workflow
- [ ] Multi-step approval chain
- [ ] Integration with billing system
- [ ] Analytics dashboard for requests

---

## Related Documentation

- [Chain Tier Pricing](./CHAIN_TIERS.md)
- [Admin Email Configuration](./ADMIN_EMAILS.md)
- [Role-Based Access Control](./RBAC.md)
- [API Reference](./API.md)

---

## Support

For questions or issues with the organization request workflow:
- Email: organizations@yourplatform.com
- Documentation: [Link to docs]
- Support Portal: [Link to support]

---

**Last Updated:** October 28, 2024  
**Version:** 1.0.0  
**Maintainer:** Platform Team
