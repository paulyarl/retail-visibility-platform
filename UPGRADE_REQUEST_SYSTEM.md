# Upgrade Request System Documentation

## Overview
The Upgrade Request System allows tenants to request subscription changes (upgrades or downgrades) which are tracked in a database queue and managed by administrators.

## Features

### 1. **Tenant Submission** (`/settings/subscription`)
- Tenants can request subscription tier changes
- System detects upgrade vs downgrade automatically
- Dual submission: Database record + Email client
- Anti-spam protection: One active request per tenant

### 2. **Admin Management** (`/settings/admin/upgrade-requests`)
- View all upgrade requests with filtering
- Status-based filtering: All, New, Pending, Waiting, Complete, Denied
- Pagination support (20 per page)
- Process requests with status updates and admin notes
- Real-time request tracking

### 3. **Email Integration**
- Opens email client with pre-filled content
- Dynamic subject line: "Subscription Upgrade/Downgrade Request"
- Contextual message based on upgrade/downgrade
- Uses configured email from Email Management page

## Database Schema

### UpgradeRequest Model
```prisma
model UpgradeRequest {
  id             String    @id @default(cuid())
  tenantId       String    @map("tenant_id")
  businessName   String    @map("business_name")
  currentTier    String    @map("current_tier")
  requestedTier  String    @map("requested_tier")
  status         String    @default("new") // new, pending, waiting, complete, denied
  notes          String?
  adminNotes     String?   @map("admin_notes")
  processedBy    String?   @map("processed_by")
  processedAt    DateTime? @map("processed_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  
  @@index([tenantId])
  @@index([status])
  @@index([createdAt])
  @@map("upgrade_requests")
}
```

## API Endpoints

### GET `/api/upgrade-requests`
List upgrade requests with filtering and pagination.

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 20) - Items per page
- `status` - Filter by status (supports comma-separated: "new,pending")
- `tenantId` - Filter by specific tenant

**Response:**
```json
{
  "data": [
    {
      "id": "cmh8cbr470000g80ovdvmojef",
      "tenantId": "demo-tenant",
      "businessName": "Hometown store",
      "currentTier": "starter",
      "requestedTier": "professional",
      "status": "new",
      "notes": "Subscription change request from Hometown store",
      "createdAt": "2025-10-26T19:29:00Z",
      "updatedAt": "2025-10-26T19:29:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### POST `/api/upgrade-requests`
Create a new upgrade request.

**Request Body:**
```json
{
  "tenantId": "demo-tenant",
  "businessName": "Hometown store",
  "currentTier": "starter",
  "requestedTier": "professional",
  "notes": "Subscription change request from Hometown store"
}
```

**Anti-Spam Check:**
Before creating, system checks for existing active requests (status: new or pending).

### PATCH `/api/upgrade-requests/:id`
Update request status and add admin notes.

**Request Body:**
```json
{
  "status": "complete",
  "adminNotes": "Upgraded successfully",
  "processedBy": "admin@example.com"
}
```

### DELETE `/api/upgrade-requests/:id`
Delete an upgrade request (admin only).

## User Flow

### Tenant Workflow
1. Navigate to `/settings/subscription`
2. Click "Request Change" on desired tier
3. Review change in confirmation modal
4. Click "Send Request"
5. System checks for existing active requests
6. If none exist:
   - Creates database record
   - Opens email client with pre-filled message
   - Shows success notification
7. If active request exists:
   - Shows message: "You already have a pending subscription change request"

### Admin Workflow
1. Navigate to `/settings/admin/upgrade-requests`
2. View all requests or filter by status
3. Click "Process" on a request
4. Update status (pending, waiting, complete, denied)
5. Add admin notes
6. Click "Update Request"
7. Request is updated and tenant can submit new requests

## Email Configuration

### Email Categories
The system uses the **"subscription"** email category from Email Management.

**To configure:**
1. Go to `/settings/admin/emails`
2. Find "Subscription Requests" card
3. Click "Edit"
4. Enter admin email address
5. Click "Save"

### Email Template

**For Upgrades:**
```
Subject: Subscription Upgrade Request - [Business Name]

Hello,

I would like to upgrade my subscription plan.

Current Plan: Starter
Requested Plan: Professional
Business: Hometown store
Tenant ID: demo-tenant

I am interested in upgrading to access additional features and higher limits.

Please process this subscription upgrade at your earliest convenience.

Thank you!
```

**For Downgrades:**
```
Subject: Subscription Downgrade Request - [Business Name]

Hello,

I would like to downgrade my subscription plan.

Current Plan: Professional
Requested Plan: Starter
Business: Hometown store
Tenant ID: demo-tenant

I am interested in downgrading to access a more suitable plan for my current needs.

Please process this subscription downgrade at your earliest convenience.

Thank you!
```

## Status Definitions

- **new**: Just submitted, not yet reviewed
- **pending**: Under review by admin
- **waiting**: Waiting for additional information or approval
- **complete**: Successfully processed
- **denied**: Request denied

## Anti-Spam Protection

### One Active Request Rule
Tenants can only have ONE active request at a time (status: new or pending).

**Implementation:**
```typescript
// Check for existing active requests
const checkResponse = await fetch(
  `/api/upgrade-requests?tenantId=${tenantId}&status=new,pending`
);
const existingRequests = await checkResponse.json();
if (existingRequests.data && existingRequests.data.length > 0) {
  alert('You already have a pending subscription change request...');
  return;
}
```

**Benefits:**
- Prevents spam/duplicate requests
- Keeps admin queue clean
- Realistic workflow
- Clear user feedback

## Performance Optimizations

### Subscription Page
The subscription page was optimized to reduce load time:

**Before:** 2-3 seconds (fetched all items)
**After:** <500ms (count-only query)

**Implementation:**
```typescript
// Parallel API calls
const [tenantRes, itemsRes] = await Promise.all([
  fetch(`/api/tenants/${tenantId}`),
  fetch(`/api/items?tenantId=${tenantId}&count=true`) // Count only!
]);
```

**Backend Support:**
```typescript
// GET /items?count=true returns { count: 42 }
if (req.query.count === 'true') {
  const count = await prisma.inventoryItem.count({
    where: { tenantId: parsed.data.tenantId },
  });
  return res.json({ count });
}
```

## UI Components

### Subscription Page Modal
- Shows current and requested tiers with badges
- Color-coded badges with borders for visibility
- Dynamic upgrade/downgrade detection
- Clear call-to-action buttons

### Admin Dashboard Card
- Icon: Upward arrow (↑)
- Color: Indigo
- Badge: "NEW"
- Quick access from admin dashboard

### Request Cards
- Status badges with color coding
- Tenant information display
- Tier change visualization (From → To)
- Process button for quick actions

## Testing

### Test Scenarios

1. **Submit First Request**
   - Should create database record
   - Should open email client
   - Should show success message

2. **Submit Duplicate Request**
   - Should show prevention message
   - Should NOT create database record
   - Should NOT open email client

3. **Process Request**
   - Should update status
   - Should save admin notes
   - Should allow new requests after completion

4. **Upgrade Detection**
   - Starter → Professional = Upgrade
   - Professional → Starter = Downgrade
   - Email subject and body should reflect correctly

## Future Enhancements

### Potential Improvements
1. **Email Notifications**: Send actual emails via SMTP instead of mailto:
2. **Request History**: Show tenant's previous requests
3. **Approval Workflow**: Multi-step approval process
4. **Automated Processing**: Auto-approve certain tier changes
5. **Analytics**: Track upgrade/downgrade trends
6. **Notifications**: In-app notifications for request status changes

## Troubleshooting

### Common Issues

**Issue: Email client doesn't open**
- Check browser settings for mailto: protocol
- Verify email client is installed and configured
- Check if popup blockers are preventing the action

**Issue: "Already have pending request" but can't see it**
- Check admin dashboard for existing requests
- Verify request status (might be "pending" not "new")
- Admin needs to process or delete the request

**Issue: Logo not showing**
- Verify logo is uploaded in Business Profile
- Check `tenant.metadata.logo_url` exists
- Verify Supabase storage is configured

## Related Documentation

- [Email Management System](./EMAIL_MANAGEMENT.md)
- [Logo Upload System](./LOGO_UPLOAD.md)
- [Subscription Tiers](./SUBSCRIPTION_TIERS.md)
- [Admin Dashboard](./ADMIN_DASHBOARD.md)

## Changelog

### 2025-10-26
- ✅ Initial implementation
- ✅ Database schema created
- ✅ Admin management page
- ✅ Anti-spam protection
- ✅ Email integration
- ✅ Performance optimizations
- ✅ Logo display on items page
