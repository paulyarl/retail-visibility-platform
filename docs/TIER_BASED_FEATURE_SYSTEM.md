# Tier-Based Feature Gating System

## Overview
A centralized system for controlling feature access based on subscription tiers, similar to platform feature flags but driven by tenant subscription levels.

## Current State

### Backend (✅ Implemented)
- **Location**: `apps/api/src/middleware/tier-access.ts`
- **Features**:
  - `TIER_FEATURES` - defines features per tier
  - `checkTierAccess(tier, feature)` - check if tier has access
  - `requireTierFeature(feature)` - Express middleware for API protection
  - `getTierFeatures(tier)` - get all features for a tier

### Frontend (⚠️ Partial)
- **Current**: Manual tier checks in individual pages
- **Problem**: No centralized system, inconsistent implementation
- **Example**: Storefront page manually checks `tier === 'google_only'`

## Proposed Architecture

### 1. Frontend Tier Access Hook
Create a centralized hook similar to `useAccessControl` for platform roles.

```typescript
// apps/web/src/lib/tiers/useTierAccess.ts
import { useMemo } from 'react';

export interface TierAccessResult {
  tier: string;
  hasFeature: (feature: string) => boolean;
  getFeatures: () => string[];
  requiresUpgrade: (feature: string) => {
    required: boolean;
    targetTier?: string;
    targetPrice?: number;
  };
}

export function useTierAccess(tenantTier: string | null | undefined): TierAccessResult {
  const tier = tenantTier || 'trial';
  
  return useMemo(() => ({
    tier,
    hasFeature: (feature: string) => checkTierFeature(tier, feature),
    getFeatures: () => getTierFeatures(tier),
    requiresUpgrade: (feature: string) => calculateUpgrade(tier, feature),
  }), [tier]);
}
```

### 2. Tier Feature Definitions (Shared)
Sync feature definitions between backend and frontend.

```typescript
// packages/shared/src/tier-features.ts
export const TIER_FEATURES = {
  trial: [
    'google_shopping',
    'basic_product_pages',
    'qr_codes_512',
  ],
  google_only: [
    'google_shopping',
    'google_merchant_center',
    'basic_product_pages',
    'qr_codes_512',
    'performance_analytics',
    // NOTE: No 'storefront' feature
  ],
  starter: [
    'storefront',
    'product_search',
    'mobile_responsive',
    'enhanced_seo',
  ],
  professional: [
    'quick_start_wizard',
    'product_scanning',
    'gbp_integration',
    'custom_branding',
    'qr_codes_1024',
  ],
  // ... etc
} as const;
```

### 3. UI Components for Feature Gating

#### TierGate Component
```typescript
// apps/web/src/components/tier/TierGate.tsx
interface TierGateProps {
  feature: string;
  tier: string;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
  children: React.ReactNode;
}

export function TierGate({ feature, tier, fallback, showUpgrade = true, children }: TierGateProps) {
  const { hasFeature, requiresUpgrade } = useTierAccess(tier);
  
  if (hasFeature(feature)) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showUpgrade) {
    const upgrade = requiresUpgrade(feature);
    return <UpgradePrompt feature={feature} targetTier={upgrade.targetTier} />;
  }
  
  return null;
}
```

#### Usage Example
```typescript
// In a page component
<TierGate feature="storefront" tier={tenant.subscriptionTier}>
  <StorefrontContent />
</TierGate>

// Or for conditional rendering
const { hasFeature } = useTierAccess(tenant.subscriptionTier);

{hasFeature('quick_start_wizard') && (
  <QuickStartButton />
)}
```

### 4. Database-Driven Feature Overrides (Future)

Similar to platform flags, allow per-tenant feature overrides:

```prisma
model TenantFeatureOverride {
  id        String   @id @default(cuid())
  tenantId  String
  feature   String
  enabled   Boolean
  reason    String?  // Why override was granted
  expiresAt DateTime?
  createdAt DateTime @default(now())
  
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, feature])
  @@index([tenantId])
}
```

**Use Cases**:
- Beta testing new features with select customers
- Grandfathering old customers with deprecated features
- Temporary feature access for support/demos
- Custom enterprise agreements

### 5. Admin UI for Feature Management

Create an admin panel similar to platform flags:

```
/settings/admin/tier-features
├── Feature Definitions (read-only, from code)
├── Tenant Overrides (manage exceptions)
└── Audit Log (track override changes)
```

## Implementation Plan

### Phase 1: Immediate Fix (✅ Done)
- [x] Add tier gate to storefront page for `google_only`
- [x] Document current tier system

### Phase 2: Centralized Frontend System
1. Create `useTierAccess` hook
2. Create `TierGate` component
3. Create shared tier feature definitions
4. Migrate existing manual checks to use hook

### Phase 3: Database-Driven Overrides
1. Add `TenantFeatureOverride` model to Prisma
2. Create API endpoints for override management
3. Update `checkTierAccess` to check overrides first
4. Add audit logging for override changes

### Phase 4: Admin UI
1. Create tier features admin page
2. Add override management interface
3. Add bulk override operations
4. Add reporting/analytics

## Benefits

### Centralized Control
- Single source of truth for feature access
- Consistent enforcement across frontend and backend
- Easy to add/modify features

### Developer Experience
- Simple API: `hasFeature('storefront')`
- Type-safe feature names
- Clear upgrade paths

### Business Flexibility
- Per-tenant overrides for custom deals
- Beta testing without code changes
- Gradual feature rollouts

### Revenue Protection
- Prevents feature leakage
- Clear upgrade prompts
- Tracks feature usage for pricing

## Comparison to Platform Flags

| Aspect | Platform Flags | Tier Features |
|--------|---------------|---------------|
| **Scope** | Platform-wide | Per-tenant |
| **Driver** | Admin toggle | Subscription tier |
| **Override** | Yes (database) | Yes (proposed) |
| **UI Control** | Admin panel | Subscription page |
| **Purpose** | A/B testing, rollouts | Revenue protection |
| **Inheritance** | None | Tier hierarchy |

## Best Practices

### 1. Feature Naming
- Use snake_case: `quick_start_wizard`
- Be specific: `gbp_integration` not `integration`
- Group related: `qr_codes_512`, `qr_codes_1024`

### 2. Tier Hierarchy
- Lower tiers inherit from higher (trial → google_only → starter → professional)
- Document cumulative features clearly
- Avoid feature removal in upgrades

### 3. UI/UX
- Always show upgrade path when feature blocked
- Provide clear value proposition
- Link directly to subscription page
- Show pricing difference

### 4. Backend Protection
- Always use middleware for API routes
- Never trust frontend checks alone
- Return helpful error messages with upgrade info
- Log feature access attempts for analytics

## Migration Strategy

### Existing Code
```typescript
// Before (manual check)
if (tenant.subscriptionTier === 'google_only') {
  return <UpgradeMessage />;
}

// After (centralized)
<TierGate feature="storefront" tier={tenant.subscriptionTier}>
  <StorefrontContent />
</TierGate>
```

### Rollout
1. Add hook and components (non-breaking)
2. Migrate one page at a time
3. Remove manual checks after migration
4. Add tests for tier gating

## Testing

### Unit Tests
```typescript
describe('useTierAccess', () => {
  it('google_only tier does not have storefront', () => {
    const { hasFeature } = useTierAccess('google_only');
    expect(hasFeature('storefront')).toBe(false);
  });
  
  it('starter tier has storefront', () => {
    const { hasFeature } = useTierAccess('starter');
    expect(hasFeature('storefront')).toBe(true);
  });
});
```

### Integration Tests
- Test API middleware blocks unauthorized access
- Test frontend shows upgrade prompts
- Test tier changes update access immediately

## Monitoring

### Metrics to Track
- Feature access attempts by tier
- Upgrade conversions from feature gates
- Override usage and expiration
- Feature adoption by tier

### Alerts
- Unexpected feature access (potential bug)
- High volume of blocked access (pricing issue?)
- Override expirations approaching

## Related Documentation
- `apps/api/src/middleware/tier-access.ts` - Backend implementation
- `apps/web/src/lib/tiers.ts` - Frontend tier definitions
- `UPGRADE_REQUEST_SYSTEM.md` - Subscription upgrade flow
- Platform flags system (similar pattern)
