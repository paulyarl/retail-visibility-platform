# Trial Tier Architecture - Complete Implementation

## Overview

Trial tiers are implemented as **wrapper tiers** that proxy all subscription attributes to their base tiers while maintaining trial lifecycle management.

## Key Principles

### 1. **Wrapper Pattern**
- Trial tiers exist in `subscription_tiers_list` **only for dropdown visibility**
- All subscription attributes (features, limits, etc.) are **NULL** in database
- API logic **proxies** trial tiers to their base tiers for all operations

### 2. **Frontend Transparency**
- Public APIs return **base tier** for trial tenants (e.g., `trial_starter` -> `starter`)
- Admin interfaces see **actual trial tier** for management
- Trial metadata preserved for status display

### 3. **Automatic Lifecycle**
- 14-day trial + 14-day grace period
- Auto-expiration to `expired_trial`
- Seamless transition to paid tiers

## Database Schema

### subscription_tiers_list (Trial Tiers)
```sql
-- Trial tiers have NULL attributes - proxied to base tiers
tier_key: 'trial_starter'
max_skus: NULL -- PROXIED to starter tier
max_locations: NULL -- PROXIED to starter tier
featured_store_selection: NULL -- PROXIED to starter tier
-- ... all feature columns are NULL
```

### Base Tiers (Real Attributes)
```sql
-- Base tiers contain actual subscription attributes
tier_key: 'starter'
max_skus: 250
max_locations: 1
featured_store_selection: 4
-- ... all feature columns have real values
```

## API Proxy Logic

### TierService.ts
```typescript
// Always proxy trial tiers to base tiers
function getBaseTierForTrial(tierKey: string): string | null {
  const trialToBaseMap: Record<string, string> = {
    'trial_google_only': 'google_only',
    'trial_starter': 'starter',
    'trial_professional': 'professional',
    'trial_chain_starter': 'chain_starter',
    // ...
  };
  return trialToBaseMap[tierKey] || null;
}

// All tier operations proxy to base tier
export async function getTierSKULimit(tierKey: string): Promise<number> {
  const baseTierKey = getBaseTierForTrial(tierKey);
  const effectiveTierKey = baseTierKey || tierKey;
  // ... get from base tier
}
```

## Frontend Transparency

### StoreService.ts
```typescript
// Transform tenant data for frontend
export function transformTenantForFrontend(tenant: any): any {
  const { effectiveTier, isTrial, trialStatus, trialEndsAt } = 
    getEffectiveTierWithTrialInfo(
      tenant.subscription_tier,
      tenant.subscription_status,
      tenant.trial_ends_at
    );
  
  return {
    ...tenant,
    // Frontend sees base tier
    subscription_tier: effectiveTier,
    // Trial info preserved for status
    is_trial: isTrial,
    trial_status: trialStatus,
    trial_ends_at: trialEndsAt,
  };
}
```

## Data Flow Examples

### Public Store Listing
```
Database: tenant.subscription_tier = 'trial_starter'
API: transformTenantForFrontend()
Frontend: store.subscription_tier = 'starter'
UI: Shows "Starter" tier with trial badge
```

### Feature Access Check
```
Request: Check if 'trial_starter' can access 'propagation_products'
API: getBaseTierForTrial('trial_starter') -> 'starter'
API: checkTierFeatureAccess('starter', 'propagation_products')
Result: Uses starter tier's feature set
```

### SKU Limit Check
```
Request: Get SKU limit for 'trial_professional'
API: getBaseTierForTrial('trial_professional') -> 'professional'
API: getTierSKULimit('professional') -> 5000
Result: Professional tier's SKU limit
```

## Admin Interface

### Billing Page
- Shows **actual trial tier** in dropdown (`trial_starter`)
- Displays **trial status** and expiration dates
- Allows **inline tier/status changes**

### Tiers Page
- **Trial tiers visible** in dropdown for selection
- **Auto-sets trial expiration** when trial tier selected
- **Handles trial-to-paid transitions**

## Trial Lifecycle Management

### Start Trial
```typescript
// Admin selects 'trial_starter' for tenant
API: Auto-set trial_ends_at = now() + 14 days
API: Set subscription_status = 'trial'
DB: tenant.subscription_tier = 'trial_starter'
DB: tenant.trial_ends_at = future_date
```

### Trial Expiration
```typescript
// Scheduled job checks expired trials
IF trial_ends_at < now AND subscription_tier LIKE 'trial_%':
  UPDATE tenant SET subscription_tier = 'expired_trial'
  UPDATE tenant SET subscription_status = 'expired'
```

### Trial Conversion
```typescript
// Admin changes 'trial_starter' -> 'starter'
API: Clear trial_ends_at = NULL
API: Set subscription_status = 'active'
DB: tenant.subscription_tier = 'starter'
DB: tenant.trial_ends_at = NULL
```

## Benefits

1. **Single Source of Truth** - Base tiers contain all attributes
2. **No Duplication** - Trial tiers don't replicate feature data
3. **Easy Maintenance** - Update base tier, trials inherit automatically
4. **Frontend Simplicity** - Public APIs see consistent tier structure
5. **Admin Control** - Trial tiers visible for management
6. **Automatic Lifecycle** - Built-in trial expiration and transitions

## Implementation Status

- [x] Database schema (trial tiers with NULL attributes)
- [x] API proxy logic (TierService, tier-limits)
- [x] Frontend transparency (StoreService transformation)
- [x] Admin interface (billing page, tiers page)
- [x] Trial lifecycle (start, expire, convert)
- [x] Scheduled jobs (grace period processing)
- [x] Audit logging (all trial changes tracked)

## Next Steps

1. Run the SQL to insert trial tiers with NULL attributes
2. Test trial tier selection in admin interfaces
3. Verify frontend transparency in public APIs
4. Test trial lifecycle (start -> expire -> convert)
5. Monitor scheduled job execution for trial expiration
