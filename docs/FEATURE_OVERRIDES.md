# Feature Overrides

## Overview

Feature Overrides allow Platform Admins to grant or revoke specific tier-based features for individual tenants, independent of their subscription tier. This enables custom deals, beta testing, support exceptions, and strategic partnerships.

## Access

**Platform Admin Only** - This feature is restricted to users with the `PLATFORM_ADMIN` role.

## Use Cases

### 🤝 Custom Deals
Grant premium features at lower-tier pricing to close strategic deals.

**Example:**
- Tenant on Starter tier ($49/mo)
- Grant `product_scanning` (normally Professional $499/mo)
- Reason: "Q4 promotion - scanning at Starter price"

### 🧪 Beta Testing
Provide early access to new features for selected tenants.

**Example:**
- Select 10 tenants across different tiers
- Grant `ai_recommendations` (upcoming feature)
- Reason: "Beta tester for AI recommendations"
- Set expiration: 30 days

### 🆘 Support Exceptions
Temporarily grant access while resolving billing or technical issues.

**Example:**
- Tenant has payment processing issue
- Grant temporary access to maintain service
- Reason: "Payment processing - resolving by EOD"
- Set expiration: 7 days

### 🎁 Strategic Partnerships
Create custom feature sets for partner agreements.

**Example:**
- Partner agreement includes specific features
- Grant custom combination regardless of tier
- Reason: "Partnership agreement - custom feature set"
- Never expires

### 🚫 Feature Revocation
Revoke access to specific features even if tier normally includes them.

**Example:**
- Tenant violated terms of service
- Revoke `api_access` while maintaining other features
- Reason: "TOS violation - API abuse"

## How to Use

### Accessing the Tool

1. Navigate to **Settings** → **Admin** → **Feature Overrides**
2. Or visit: `/settings/admin/feature-overrides`

### Creating an Override

1. Click **"+ Create Override"**
2. Fill in the form:
   - **Tenant**: Select the tenant from dropdown
   - **Feature**: Choose the feature to override
   - **Access**: Select "Grant Access" or "Revoke Access"
   - **Reason**: Document why this override exists (required for audit)
   - **Expires At**: Optional expiration date/time
3. Click **"Create Override"**

### Editing an Override

1. Find the override in the list
2. Click **"Edit"**
3. Update:
   - Access (grant/revoke)
   - Reason
   - Expiration date
4. Click **"Update Override"**

Note: Tenant and Feature cannot be changed. Delete and recreate if needed.

### Deleting an Override

1. Find the override in the list
2. Click **"Delete"**
3. Confirm deletion

Once deleted, the tenant's access returns to their normal tier-based permissions.

### Filtering Overrides

Use the filter bar to find specific overrides:
- **By Tenant**: Show overrides for a specific tenant
- **By Feature**: Show all overrides for a feature
- **By Status**: Show only active overrides or include expired

Click **"Apply Filters"** to update the list.

### Cleanup Expired Overrides

1. Click **"Cleanup Expired"**
2. Confirm the action
3. All expired overrides will be removed from the database

This is useful for housekeeping after temporary overrides expire.

## Available Features

The following tier-based features can be overridden:

| Feature | Display Name | Default Tier |
|---------|-------------|--------------|
| `quick_start_wizard` | Quick Start Wizard | Trial |
| `product_scanning` | Product Scanning | Professional |
| `gbp_integration` | Google Business Profile | Google-Only |
| `storefront` | Storefront | Starter |
| `business_hours` | Business Hours | Starter |
| `basic_categories` | Basic Categories | Trial |

## Override Behavior

### Priority Order

When checking feature access, the system checks in this order:

1. **Active Override** (highest priority)
   - If override exists and is not expired
   - Use override's `granted` status
   - Ignore tier-based access

2. **Tier-Based Access** (fallback)
   - If no override exists
   - Use normal tier feature rules
   - Check tier hierarchy

### Expiration

- Overrides with `expiresAt` date in the past are **ignored**
- Expired overrides remain in database until cleaned up
- System automatically skips expired overrides
- Use "Cleanup Expired" to remove old records

### Grant vs Revoke

**Grant Access (`granted: true`)**
- Tenant gets the feature regardless of tier
- Bypasses normal tier restrictions
- Useful for upgrades and beta testing

**Revoke Access (`granted: false`)**
- Tenant loses the feature even if tier includes it
- Overrides normal tier permissions
- Useful for TOS violations or downgrades

## Status Indicators

| Badge | Meaning | Behavior |
|-------|---------|----------|
| 🟢 **Granted** | Access granted | Feature is available |
| 🔴 **Revoked** | Access denied | Feature is blocked |
| ⚫ **Expired** | Override expired | Falls back to tier access |

## Best Practices

### Documentation
- **Always provide a reason** - Required for audit trail
- **Be specific** - "Q4 promotion" not just "deal"
- **Include dates** - "Beta testing until 2024-12-31"
- **Reference tickets** - "Support ticket #1234"

### Expiration Dates
- **Use for temporary access** - Beta testing, support exceptions
- **Leave blank for permanent** - Custom deals, partnerships
- **Set realistic dates** - Don't set 10 years in the future
- **Review regularly** - Clean up expired overrides monthly

### Security
- **Verify tenant** - Double-check you're granting to correct tenant
- **Document thoroughly** - Explain business justification
- **Review periodically** - Audit active overrides quarterly
- **Revoke when done** - Remove temporary overrides promptly

### Communication
- **Notify tenant** - Let them know about granted features
- **Set expectations** - Explain expiration dates
- **Document externally** - Update CRM, contracts, etc.
- **Track in tickets** - Link to support/sales tickets

## Monitoring

### Server Logs

When an override is used, the backend logs:
```
[Feature Access] Override used: product_scanning for tenant cmhomilz90002o33aym2v960g (reason: Beta tester)
```

### Audit Trail

All override operations are logged with:
- Who created/modified the override (`grantedBy`)
- When it was created (`createdAt`)
- When it was last modified (`updatedAt`)
- The reason for the override

### Checking Override Status

To verify an override is working:

1. **Check the UI** - Visit the feature page as the tenant
2. **Check server logs** - Look for override usage messages
3. **Test the feature** - Ensure functionality works correctly

## Troubleshooting

### Override Not Working

**Check:**
1. Override exists in the list
2. Status is "Granted" (green badge)
3. Not expired (check Expires column)
4. Correct tenant selected
5. Correct feature selected

**Test:**
1. Visit the feature page as the tenant
2. Check browser console for errors
3. Check server logs for override usage
4. Try refreshing the page

### Can't Create Override

**Possible Issues:**
1. Not logged in as Platform Admin
2. Tenant already has override for that feature (unique constraint)
3. Invalid feature name
4. Network/API error

**Solution:**
- Verify Platform Admin access
- Delete existing override first
- Check feature name spelling
- Check browser console for errors

### Override Shows But Feature Still Blocked

**Possible Issues:**
1. Override is expired
2. Override is set to "Revoke" instead of "Grant"
3. Frontend cache issue
4. Backend not checking overrides

**Solution:**
- Check expiration date
- Verify "Granted" status (green badge)
- Hard refresh browser (Ctrl+Shift+R)
- Check server logs for override usage

## API Reference

### List Overrides
```
GET /api/admin/feature-overrides
Query params: tenantId, feature, active
```

### Get Override
```
GET /api/admin/feature-overrides/:id
```

### Create Override
```
POST /api/admin/feature-overrides
Body: { tenantId, feature, granted, reason, expiresAt }
```

### Update Override
```
PUT /api/admin/feature-overrides/:id
Body: { granted, reason, expiresAt }
```

### Delete Override
```
DELETE /api/admin/feature-overrides/:id
```

### Cleanup Expired
```
POST /api/admin/feature-overrides/cleanup-expired
```

## Database Schema

```sql
CREATE TABLE tenant_feature_overrides (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  reason TEXT,
  expires_at TIMESTAMP,
  granted_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, feature),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

## Security Considerations

### Access Control
- Only Platform Admins can create/edit/delete overrides
- Overrides are checked on every feature access request
- Backend validates all override operations

### Audit Trail
- All overrides include `grantedBy` (who created it)
- All overrides include `reason` (why it was created)
- All operations are timestamped
- Server logs record override usage

### Data Integrity
- Unique constraint prevents duplicate overrides
- Cascade delete removes overrides when tenant deleted
- Expired overrides are automatically ignored
- Invalid features are rejected

## Related Documentation

- [Tier-Based Feature System](./TIER_BASED_FEATURE_SYSTEM.md)
- [Three Pillar Growth Strategy](./THREE_PILLAR_GROWTH_STRATEGY.md)
- [Phase 3 Implementation Plan](./PHASE_3_IMPLEMENTATION_PLAN.md)
- [Testing Guide](../test-override.md)

## Support

For questions or issues with Feature Overrides:
1. Check this documentation
2. Review server logs for error messages
3. Test with a known-good override
4. Contact platform development team
