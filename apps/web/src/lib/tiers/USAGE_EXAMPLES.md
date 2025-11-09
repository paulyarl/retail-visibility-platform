# Tier Middleware Usage Examples

## Overview

The tier middleware system provides flexible tier resolution for both individual tenants and chain organizations. It handles complex scenarios where organization-level tiers can be enhanced with tenant-specific features.

## Architecture

```
Organization Tier (Chain-level)
    ↓
Tenant Tier (Individual overrides)
    ↓
Resolved Tier (Effective features + limits)
```

## Basic Usage

### 1. Individual Tenant (No Chain)

```typescript
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';

function TenantDashboard({ tenantId }) {
  const { tier, usage, hasFeature, getUsagePercentage } = useTenantTier(tenantId);

  if (!tier) return <Loading />;

  return (
    <div>
      <h1>{tier.effective.name} Plan</h1>
      
      {/* Check if feature is available */}
      {hasFeature('multi_location') && (
        <Link href="/locations">Manage Locations</Link>
      )}
      
      {/* Show usage */}
      <UsageMeter 
        label="Products"
        percentage={getUsagePercentage('products')}
        current={usage.products}
        limit={tier.effective.limits.maxProducts}
      />
    </div>
  );
}
```

### 2. Chain Organization

```typescript
function ChainDashboard({ tenantId }) {
  const { tier, hasFeature } = useTenantTier(tenantId);

  if (!tier) return <Loading />;

  return (
    <div>
      {tier.isChain && (
        <div className="chain-badge">
          <span>Organization: {tier.organization?.name}</span>
          {tier.tenant && (
            <span>Enhanced with: {tier.tenant.name}</span>
          )}
        </div>
      )}

      {/* Features from org tier */}
      {hasFeature('advanced_analytics') && (
        <AnalyticsPanel />
      )}

      {/* Tenant-specific overrides */}
      {hasFeature('custom_integration') && (
        <IntegrationPanel />
      )}
    </div>
  );
}
```

## Scenarios

### Scenario 1: Individual Tenant on Growth Plan

```typescript
// API Response
{
  tenantTier: {
    id: 'growth',
    name: 'Growth',
    level: 'growth',
    features: ['multi_location', 'bulk_import', 'analytics'],
    limits: { maxProducts: 500, maxLocations: 10 }
  },
  organizationTier: null,
  isChain: false
}

// Resolved Tier
{
  effective: { ...tenantTier },
  tenant: { ...tenantTier },
  isChain: false,
  canUpgrade: true,
  upgradeOptions: ['pro', 'enterprise']
}
```

### Scenario 2: Chain with Organization Tier

```typescript
// API Response
{
  organizationTier: {
    id: 'pro',
    name: 'Pro',
    level: 'pro',
    features: ['multi_location', 'advanced_analytics', 'api_access'],
    limits: { maxProducts: 5000, maxLocations: 50 }
  },
  tenantTier: null,
  isChain: true
}

// Resolved Tier
{
  effective: { ...organizationTier },
  organization: { ...organizationTier },
  isChain: true,
  canUpgrade: true, // Chain admin can upgrade
  upgradeOptions: ['enterprise']
}
```

### Scenario 3: Chain with Tenant Override

```typescript
// API Response
{
  organizationTier: {
    id: 'growth',
    name: 'Growth',
    features: ['multi_location', 'bulk_import'],
    limits: { maxProducts: 500, maxLocations: 10 }
  },
  tenantTier: {
    id: 'growth_plus',
    name: 'Growth Plus',
    features: ['advanced_analytics'], // Additional feature
    limits: { maxProducts: 1000 } // Higher limit
  },
  isChain: true
}

// Resolved Tier (Merged)
{
  effective: {
    id: 'merged_growth_growth_plus',
    name: 'Growth (Enhanced)',
    level: 'growth',
    features: [
      { id: 'multi_location', source: 'organization' },
      { id: 'bulk_import', source: 'organization' },
      { id: 'advanced_analytics', source: 'tenant' }
    ],
    limits: {
      maxProducts: 1000, // Higher of the two
      maxLocations: 10
    }
  },
  organization: { ...organizationTier },
  tenant: { ...tenantTier },
  isChain: true
}
```

## Feature Checking

### Check Single Feature

```typescript
const { hasFeature } = useTenantTier(tenantId);

if (hasFeature('multi_location')) {
  // Show multi-location features
}
```

### Get Features by Category

```typescript
const { getFeaturesByCategory } = useTenantTier(tenantId);

const inventoryFeatures = getFeaturesByCategory('inventory');
const analyticsFeatures = getFeaturesByCategory('analytics');

return (
  <div>
    <h2>Inventory Features</h2>
    {inventoryFeatures.map(f => (
      <FeatureCard key={f.id} feature={f} />
    ))}
  </div>
);
```

## Limit Checking

### Check if Limit Reached

```typescript
const { isLimitReached, usage, tier } = useTenantTier(tenantId);

if (isLimitReached('products')) {
  return (
    <Alert>
      You've reached your product limit of {tier.effective.limits.maxProducts}.
      <Button onClick={upgradeToNextTier}>Upgrade Plan</Button>
    </Alert>
  );
}
```

### Show Usage Percentage

```typescript
const { getUsagePercentage } = useTenantTier(tenantId);

const productUsage = getUsagePercentage('products');

return (
  <ProgressBar 
    percentage={productUsage}
    warning={productUsage > 80}
    danger={productUsage > 95}
  />
);
```

## Dynamic Dashboard Sections

### Show Available Features

```typescript
function AvailableFeaturesSection({ tenantId }) {
  const { tier, hasFeature } = useTenantTier(tenantId);

  const features = [
    { id: 'multi_location', name: 'Multi-Location', route: '/locations' },
    { id: 'bulk_import', name: 'Bulk Import', route: '/import' },
    { id: 'advanced_analytics', name: 'Analytics', route: '/analytics' },
    { id: 'api_access', name: 'API Access', route: '/api' }
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {features.map(feature => (
        hasFeature(feature.id) ? (
          <FeatureCard
            key={feature.id}
            title={feature.name}
            status="available"
            onClick={() => navigate(feature.route)}
          />
        ) : (
          <FeatureCard
            key={feature.id}
            title={feature.name}
            status="locked"
            requiredTier={getRequiredTier(feature.id)}
          />
        )
      ))}
    </div>
  );
}
```

### Show Upgrade Prompts

```typescript
function UpgradeSection({ tenantId }) {
  const { tier } = useTenantTier(tenantId);

  if (!tier || !tier.canUpgrade) return null;

  return (
    <Card>
      <h3>Unlock More Features</h3>
      <p>Upgrade to access:</p>
      <ul>
        {tier.upgradeOptions?.map(option => (
          <li key={option}>{option} Plan</li>
        ))}
      </ul>
      <Button onClick={() => navigate('/settings/subscription')}>
        View Plans
      </Button>
    </Card>
  );
}
```

## Benefits

### For Individual Tenants
- ✅ Clear tier features
- ✅ Simple upgrade path
- ✅ Usage tracking

### For Chains
- ✅ Organization-wide tier
- ✅ Tenant-specific enhancements
- ✅ Flexible feature distribution
- ✅ Centralized billing

### For Development
- ✅ Single source of truth
- ✅ Type-safe feature checks
- ✅ Easy to test
- ✅ Reusable across components
