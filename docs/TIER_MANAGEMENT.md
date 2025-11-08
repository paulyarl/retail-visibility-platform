# Tier Management System

## Overview

The Tier Management System provides platform administrators with comprehensive tools to manage tenant subscription tiers, monitor tier distribution, and handle tier upgrades/downgrades with full audit logging.

## Access

**Platform Admin Only** - This feature is restricted to users with the `PLATFORM_ADMIN` role.

## Features

### 1. Tier Overview Dashboard
- **Real-time Statistics**
  - Total tenants count
  - Active tenants count
  - Trial tenants count
  - Organizations count
  - Estimated Monthly Recurring Revenue (MRR)

- **Tier Distribution**
  - Visual breakdown of tenants by tier
  - Quick insights into tier adoption

### 2. Tenant Tier Management
- **View All Tenants**
  - Comprehensive list of all tenants with their current tier
  - SKU count per tenant
  - Organization membership status
  - Subscription status (trial, active, past_due, canceled, expired)

- **Search & Filter**
  - Search by tenant name or ID
  - Filter by subscription tier
  - Filter by subscription status
  - Pagination for large tenant lists

- **Update Tenant Tier**
  - Change subscription tier
  - Update subscription status
  - Required reason field for audit trail
  - Automatic SKU limit validation

### 3. Audit Logging
- **Complete Audit Trail**
  - Who made the change (admin user)
  - When the change was made
  - Before and after states
  - Reason for the change
  - Automatic logging to audit system

## Available Tiers

### Individual Tiers

#### Google-Only ($29/mo)
- **Max SKUs:** 250
- **Target:** Businesses focused on Google Shopping
- **Features:**
  - Google Shopping integration
  - Google Merchant Center sync
  - Basic product pages
  - QR codes (512px)
  - Performance analytics
  - Quick Start Wizard (limited)

#### Starter ($49/mo)
- **Max SKUs:** 500
- **Target:** Small businesses getting started
- **Features:**
  - Public storefront
  - Product search
  - Mobile-responsive design
  - Enhanced SEO
  - Basic categories

#### Professional ($499/mo)
- **Max SKUs:** 5,000
- **Target:** Established retail businesses
- **Features:**
  - Quick Start Wizard (full)
  - Product scanning
  - Google Business Profile integration
  - Custom branding
  - Business logo
  - QR codes (1024px)
  - Image gallery (5 photos)
  - Interactive maps
  - Privacy mode
  - Custom marketing copy
  - Priority support

#### Enterprise ($999/mo)
- **Max SKUs:** Unlimited
- **Target:** Large single-location operations
- **Features:**
  - Unlimited SKUs
  - White label branding
  - Custom domain
  - QR codes (2048px)
  - Image gallery (10 photos)
  - API access
  - Advanced analytics
  - Dedicated account manager
  - SLA guarantee
  - Custom integrations

### Organization Tiers

#### Organization ($999/mo)
- **Max SKUs:** 10,000 (shared pool)
- **Target:** Franchise chains & multi-location businesses
- **Features:**
  - Product propagation
  - Category propagation
  - GBP sync propagation
  - Hours propagation
  - Profile propagation
  - Flag propagation
  - Role propagation
  - Brand propagation
  - Organization dashboard
  - Hero location
  - Strategic testing
  - Unlimited locations
  - Shared SKU pool
  - Centralized control
  - API access

#### Chain Starter ($199/mo)
- **Max Locations:** 5
- **Max SKUs:** 2,500 (shared)
- **Target:** Small chains (2-5 locations)
- **Features:**
  - Storefront
  - Product search
  - Mobile-responsive
  - Enhanced SEO
  - Multi-location (5)

#### Chain Professional ($1,999/mo)
- **Max Locations:** 25
- **Max SKUs:** 25,000 (shared)
- **Target:** Medium chains (6-25 locations)
- **Features:**
  - Quick Start Wizard
  - Product scanning
  - GBP integration
  - Custom branding
  - QR codes (1024px)
  - Image gallery (5 photos)
  - Multi-location (25)
  - Basic propagation

#### Chain Enterprise ($4,999/mo)
- **Max Locations:** Unlimited
- **Max SKUs:** Unlimited
- **Target:** Large chains (26+ locations)
- **Features:**
  - Unlimited SKUs
  - White label
  - Custom domain
  - QR codes (2048px)
  - Image gallery (10 photos)
  - API access
  - Unlimited locations
  - Advanced propagation
  - Dedicated account manager

## How to Use

### Accessing Tier Management

1. Navigate to **Settings** → **Admin** → **Tier Management**
2. Or visit: `/settings/admin/tier-management`

### Viewing Tier Statistics

The dashboard displays:
- Total tenant count
- Active/trial tenant breakdown
- Organization count
- Estimated MRR
- Tier distribution chart

### Updating a Tenant's Tier

1. **Find the Tenant**
   - Use search to find by name or ID
   - Or filter by current tier/status
   - Click through pagination if needed

2. **Click "Update Tier"**
   - Opens the update modal
   - Shows current tier and SKU count

3. **Select New Tier**
   - Choose from dropdown of available tiers
   - System shows pricing for each tier

4. **Update Status (Optional)**
   - Change subscription status if needed
   - Options: trial, active, past_due, canceled, expired

5. **Provide Reason**
   - **Required** for audit trail
   - Be specific and clear
   - Examples:
     - "Customer upgraded via sales call - confirmed payment"
     - "Downgrade requested by customer due to budget constraints"
     - "Trial conversion to Professional tier"
     - "Enterprise upgrade for API access requirements"

6. **Review and Confirm**
   - Check current vs. new tier
   - Verify SKU count is within new tier limits
   - Click "Update Tier"

### SKU Limit Validation

The system automatically validates SKU limits:
- **Before Update:** Checks current SKU count
- **Validation:** Ensures new tier can accommodate existing SKUs
- **Error:** If tenant has more SKUs than new tier allows
- **Action Required:** Tenant must reduce SKUs before downgrade

Example:
```
Tenant has 1,000 SKUs
Attempting to downgrade to Starter (500 SKU limit)
❌ Error: "Tenant has 1000 SKUs but starter tier allows only 500 SKUs"
```

## API Endpoints

### GET /api/admin/tier-management/tiers
List all available subscription tiers with configurations.

**Response:**
```json
{
  "individual": [...],
  "organization": [...]
}
```

### GET /api/admin/tier-management/tenants
List all tenants with tier information.

**Query Parameters:**
- `tier` - Filter by subscription tier
- `status` - Filter by subscription status
- `search` - Search by name or ID
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Response:**
```json
{
  "tenants": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalItems": 100,
    "totalPages": 2,
    "hasMore": true
  }
}
```

### GET /api/admin/tier-management/tenants/:tenantId
Get detailed tier information for a specific tenant.

**Response:**
```json
{
  "id": "...",
  "name": "...",
  "subscriptionTier": "professional",
  "subscriptionStatus": "active",
  "_count": {
    "items": 1500
  },
  "organization": {...},
  "featureOverrides": [...]
}
```

### PATCH /api/admin/tier-management/tenants/:tenantId
Update tenant tier and subscription status.

**Request Body:**
```json
{
  "subscriptionTier": "professional",
  "subscriptionStatus": "active",
  "reason": "Customer upgraded via sales call"
}
```

**Response:**
```json
{
  "success": true,
  "tenant": {...},
  "changes": {
    "before": {
      "subscriptionTier": "starter",
      "subscriptionStatus": "trial"
    },
    "after": {
      "subscriptionTier": "professional",
      "subscriptionStatus": "active"
    }
  }
}
```

### GET /api/admin/tier-management/stats
Get tier distribution and platform statistics.

**Response:**
```json
{
  "totalTenants": 150,
  "totalOrganizations": 10,
  "totalTrialTenants": 45,
  "totalActiveTenants": 95,
  "estimatedMRR": 45000,
  "tierDistribution": [...],
  "statusDistribution": [...]
}
```

### POST /api/admin/tier-management/bulk-update
Bulk update tiers for multiple tenants.

**Request Body:**
```json
{
  "tenantIds": ["id1", "id2", "id3"],
  "subscriptionTier": "professional",
  "subscriptionStatus": "active",
  "reason": "Bulk upgrade for Q4 promotion"
}
```

## Audit Logging

Every tier change is automatically logged with:

### Logged Information
- **Tenant ID** - Which tenant was modified
- **Actor** - Admin user who made the change
- **Action** - `tier.update` or `tier.bulk_update`
- **Timestamp** - When the change occurred
- **Before State** - Previous tier and status
- **After State** - New tier and status
- **Reason** - Admin-provided reason
- **Admin Details** - User ID and email

### Audit Log Example
```json
{
  "tenantId": "cm123...",
  "actor": "user_abc123",
  "action": "tier.update",
  "payload": {
    "reason": "Customer upgraded to Professional tier via sales call",
    "before": {
      "subscriptionTier": "starter",
      "subscriptionStatus": "trial"
    },
    "after": {
      "subscriptionTier": "professional",
      "subscriptionStatus": "active"
    },
    "adminUserId": "user_abc123",
    "adminEmail": "admin@example.com"
  },
  "occurredAt": "2024-01-15T10:30:00Z"
}
```

## Best Practices

### Tier Changes

1. **Always Provide Clear Reasons**
   - Good: "Customer upgraded to Professional for GBP integration - confirmed via email"
   - Bad: "upgrade"

2. **Verify SKU Limits**
   - Check current SKU count before downgrading
   - Inform customer if they need to reduce SKUs

3. **Coordinate with Billing**
   - Ensure payment is confirmed before activating paid tier
   - Update subscription status appropriately

4. **Document External References**
   - Include ticket numbers
   - Reference sales calls or emails
   - Link to contracts or agreements

### Status Management

- **trial** - New tenants or trial periods
- **active** - Paying customers with valid subscription
- **past_due** - Payment failed, grace period
- **canceled** - Customer canceled, may have remaining access
- **expired** - Trial or subscription ended, no access

### Communication

1. **Before Tier Change**
   - Confirm customer intent
   - Verify payment if upgrading
   - Explain feature changes

2. **After Tier Change**
   - Notify customer of activation
   - Provide documentation for new features
   - Offer onboarding support if needed

## Security

### Access Control
- **Platform Admin Only** - Enforced at API and UI level
- **Authentication Required** - All endpoints require valid session
- **Authorization Checked** - Role verification on every request

### Data Protection
- **Audit Trail** - Complete history of all changes
- **Reason Required** - Prevents accidental changes
- **Validation** - SKU limits enforced automatically

## Troubleshooting

### Cannot Update Tier

**Issue:** "Tenant has X SKUs but Y tier allows only Z SKUs"

**Solution:**
1. Inform customer they need to reduce SKUs
2. Customer deletes excess products
3. Retry tier change

### Update Not Reflecting

**Issue:** Tier updated but customer still sees old tier

**Solution:**
1. Check audit log to confirm update
2. Have customer log out and log back in
3. Clear browser cache
4. Verify no feature overrides are conflicting

### MRR Calculation Incorrect

**Issue:** Estimated MRR doesn't match expectations

**Solution:**
- MRR only counts `active` status tenants
- Trial tenants are excluded
- Verify subscription statuses are correct

## Related Documentation

- [Tier-Based Feature System](./TIER_BASED_FEATURE_SYSTEM.md)
- [Feature Overrides](./FEATURE_OVERRIDES.md)
- [Three Pillar Growth Strategy](./THREE_PILLAR_GROWTH_STRATEGY.md)

## Support

For questions or issues with Tier Management:
1. Check this documentation
2. Review audit logs for change history
3. Verify platform admin access
4. Contact platform development team
