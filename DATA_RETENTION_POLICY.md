# Account Deletion & Data Retention Policy

## Overview
When a user requests account deletion, they have two options:
1. **Complete Deletion** - Remove all personal data and associated content
2. **Preserve Data** - Remove personal information but preserve business data for historical/archival purposes

## Deletion Options

### Option 1: Complete Deletion (Default)
**What gets deleted:**
- ✅ User account and credentials
- ✅ Personal information (name, email, phone)
- ✅ User preferences and settings
- ✅ User sessions and security alerts
- ✅ **Tenants owned by the user** (if sole owner)
- ✅ **All products/inventory items** created by the user
- ✅ **Photos and media** uploaded by the user
- ✅ User activity logs and audit trails
- ✅ Consent records and GDPR data

**What happens to shared data:**
- **Multi-owner tenants**: User is removed, but tenant remains for other owners
- **Organization memberships**: User is removed from organizations
- **Shared products**: Products are deleted if user is sole contributor

**Cascading Effects:**
```
User Deletion
  └─> Owned Tenants (if sole owner)
       └─> Inventory Items
            └─> Photos
            └─> Categories
       └─> Tenant Settings
       └─> Location Data
  └─> User Sessions
  └─> Security Alerts
  └─> Failed Login Attempts
  └─> Consent Records
```

### Option 2: Preserve Data (Optional)
**What gets deleted:**
- ✅ User account credentials (cannot login)
- ✅ Personal identifiable information (PII)
  - Email → `deleted_user_[timestamp]@deleted.local`
  - Name → `Deleted User`
  - Phone → NULL
  - Profile photo → NULL
- ✅ User sessions and authentication data
- ✅ Security alerts and activity logs

**What gets preserved:**
- ✅ **Tenants** - Ownership transferred to system/admin
- ✅ **Products/Inventory** - Remain in catalog
- ✅ **Photos** - Remain attached to products
- ✅ **Business data** - Categories, pricing, descriptions
- ✅ **Historical records** - For analytics and reporting

**Use Cases for Data Preservation:**
1. **Historical Analytics** - Maintain product performance data
2. **Business Continuity** - Preserve catalog for other team members
3. **Compliance** - Retain business records for legal/tax purposes
4. **Future Reactivation** - Possibility of account recovery (within limits)

## Implementation Details

### Database Changes

**Users Table:**
```sql
-- When preserve_data = true:
UPDATE users SET
  email = 'deleted_user_' || id || '@deleted.local',
  first_name = 'Deleted',
  last_name = 'User',
  phone = NULL,
  password_hash = NULL,
  profile_photo_url = NULL,
  is_deleted = true,
  deleted_at = NOW()
WHERE id = [user_id];
```

**Tenant Ownership Transfer:**
```sql
-- Transfer owned tenants to system admin
UPDATE tenants SET
  owner_id = [system_admin_id],
  metadata = metadata || '{"previous_owner": "[user_id]", "transferred_at": "[timestamp]"}'
WHERE owner_id = [user_id];
```

### API Behavior

**POST /api/gdpr/delete**
```json
{
  "reason": "No longer need the service",
  "confirmation": "DELETE",
  "password": "user_password",
  "preserveData": false  // New field
}
```

**Response includes preservation status:**
```json
{
  "success": true,
  "data": {
    "id": "del_req_...",
    "preserveData": false,
    "scheduledDeletionDate": "2025-01-25T04:00:00Z"
  },
  "message": "Account deletion scheduled. All data will be permanently deleted in 30 days."
}
```

## User Communication

### Deletion Request Confirmation Email

**Complete Deletion:**
```
Subject: Account Deletion Scheduled

Your account deletion request has been received.

What will be deleted:
• Your account and login credentials
• All personal information
• All tenants you own (X tenants)
• All products and inventory (X items)
• All photos and media

Grace Period: 30 days
You can cancel this request anytime before [date]

To cancel: Visit Settings > Privacy or click [Cancel Link]
```

**Data Preservation:**
```
Subject: Account Deletion Scheduled (Data Preserved)

Your account deletion request has been received.

What will be deleted:
• Your account and login credentials
• Your personal information (name, email, phone)

What will be preserved:
• Your tenants and business locations (X tenants)
• Your products and inventory (X items)
• Your photos and media
• Business data for historical/archival purposes

Note: Preserved data will be anonymized and you will not be able to access it.

Grace Period: 30 days
You can cancel this request anytime before [date]

To cancel: Visit Settings > Privacy or click [Cancel Link]
```

## Admin Controls

Admins can:
- ✅ View all deletion requests and preservation status
- ✅ See what data will be deleted vs preserved
- ✅ Override preservation settings (with justification)
- ✅ Manually trigger immediate deletion (emergency)
- ✅ Restore accounts within grace period
- ✅ View deletion analytics and reasons

## Compliance & Legal

### GDPR Compliance
- **Right to Erasure (Article 17)**: Fully supported
- **Data Minimization**: Only essential data preserved if requested
- **Transparency**: Clear communication about what's deleted/preserved
- **User Control**: User chooses preservation option

### Data Retention Limits
- **Preserved Data**: Retained indefinitely for business purposes
- **Deletion Requests**: Kept for 7 years for audit purposes
- **Anonymized Data**: Can be used for analytics indefinitely

### Audit Trail
All deletion actions are logged:
- User ID and email (before deletion)
- Deletion reason
- Preservation choice
- Timestamp
- IP address
- Admin actions (if any)

## Technical Implementation

### Deletion Service
```typescript
async function executeAccountDeletion(requestId: string) {
  const request = await getDeletionRequest(requestId);
  
  if (request.preserveData) {
    // Anonymize user data
    await anonymizeUserData(request.userId);
    
    // Transfer tenant ownership
    await transferTenantOwnership(request.userId);
    
    // Preserve business data
    // Products, photos, categories remain intact
  } else {
    // Complete deletion
    await deleteUserSessions(request.userId);
    await deleteSecurityAlerts(request.userId);
    await deleteOwnedTenants(request.userId);
    await deleteUserProducts(request.userId);
    await deleteUserPhotos(request.userId);
    await deleteUserAccount(request.userId);
  }
  
  // Mark request as completed
  await markDeletionCompleted(requestId);
}
```

## Recommendations

**Default Setting:** Complete Deletion
- Most users expect full removal
- Cleaner data hygiene
- Lower storage costs

**When to Preserve:**
- User has active business with other team members
- User has significant product catalog
- User requests historical data retention
- Legal/compliance requirements

**Admin Override:**
- High-value accounts
- Active business operations
- Legal holds
- Fraud investigations
