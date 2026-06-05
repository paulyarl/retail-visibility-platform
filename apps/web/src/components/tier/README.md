# Tier-Based Feature Gating Components

## Overview
Centralized components for controlling feature access based on subscription tiers.

## Components

### TierGate
Declarative component that shows/hides content based on tier feature access.

#### Basic Usage
```tsx
import { TierGate } from '@/components/tier/TierGate';

<TierGate feature="storefront" tier={tenant.subscriptionTier}>
  <StorefrontContent />
</TierGate>
```

#### With Tenant ID (for upgrade links)
```tsx
<TierGate 
  feature="quick_start_wizard" 
  tier={tenant.subscriptionTier}
  tenantId={tenant.id}
>
  <QuickStartWizard />
</TierGate>
```

#### Custom Fallback
```tsx
<TierGate 
  feature="api_access" 
  tier={tier}
  fallback={<CustomUpgradeMessage />}
>
  <ApiSettings />
</TierGate>
```

#### Hide Without Prompt
```tsx
<TierGate feature="white_label" tier={tier} showUpgrade={false}>
  <WhiteLabelSettings />
</TierGate>
```

### TierBadge
Small inline badge showing feature requires upgrade.

```tsx
import { TierBadge } from '@/components/tier/TierGate';

<button>
  Advanced Settings
  <TierBadge feature="api_access" tier={tier} />
</button>
```

## Hook Usage

### useTierAccess
React hook for programmatic tier checking.

```tsx
import { useTierAccess } from '@/lib/tiers';

function MyComponent({ tenant }) {
  const { hasFeature, requiresUpgrade, tierDisplay } = useTierAccess(tenant.subscriptionTier);
  
  // Conditional rendering
  if (!hasFeature('storefront')) {
    return <UpgradePrompt />;
  }
  
  // Check upgrade requirements
  const upgrade = requiresUpgrade('quick_start_wizard');
  if (upgrade.required) {
    console.log(`Upgrade to ${upgrade.targetTierDisplay} for $${upgrade.upgradeCost} more`);
  }
  
  // Multiple feature checks
  const canUseAdvanced = hasFeature('api_access') && hasFeature('custom_domain');
  
  return (
    <div>
      <h1>Current Tier: {tierDisplay}</h1>
      {hasFeature('product_scanning') && <ScanButton />}
      {hasFeature('gbp_integration') && <GBPSettings />}
    </div>
  );
}
```

## Available Features

### Trial Tier
- `google_shopping`
- `basic_product_pages`
- `qr_codes_512`

### Google-Only Tier ($29/mo)
- All Trial features
- `google_merchant_center`
- `performance_analytics`
- **NO** `storefront` (key differentiator)

### Starter Tier ($49/mo)
- All Google-Only features
- `storefront`
- `product_search`
- `mobile_responsive`
- `enhanced_seo`
- `basic_categories`

### Professional Tier ($499/mo)
- All Starter features
- `quick_start_wizard` ⚠️ High-value
- `product_scanning` ⚠️ High-value
- `gbp_integration` ⚠️ High-value
- `custom_branding`
- `business_logo`
- `qr_codes_1024`
- `image_gallery_5`
- `interactive_maps`
- `privacy_mode`
- `custom_marketing_copy`
- `priority_support`

### Enterprise Tier ($999/mo)
- All Professional features
- `unlimited_skus`
- `white_label`
- `custom_domain`
- `qr_codes_2048`
- `image_gallery_10`
- `api_access`
- `advanced_analytics`
- `dedicated_account_manager`
- `sla_guarantee`
- `custom_integrations`

### Organization Tier ($999/mo)
- All Professional features
- `propagation_products`
- `propagation_categories`
- `propagation_gbp_sync`
- `propagation_hours`
- `propagation_profile`
- `propagation_flags`
- `propagation_roles`
- `propagation_brand`
- `organization_dashboard`
- `hero_location`
- `strategic_testing`
- `unlimited_locations`
- `shared_sku_pool`
- `centralized_control`

## Migration Guide

### Before (Manual Checks)
```tsx
// ❌ Old way - manual tier checking
if (tenant.subscriptionTier === 'google_only') {
  return <div>Upgrade to access storefront</div>;
}

return <StorefrontContent />;
```

### After (Centralized)
```tsx
// ✅ New way - declarative tier gating
<TierGate feature="storefront" tier={tenant.subscriptionTier}>
  <StorefrontContent />
</TierGate>
```

### Benefits
1. **Consistent UX**: Upgrade prompts look the same everywhere
2. **Centralized Logic**: Change tier rules in one place
3. **Type Safety**: Feature names are validated
4. **Automatic Pricing**: Shows correct upgrade costs
5. **Easy Testing**: Mock tier access in tests

## Testing

```tsx
import { render } from '@testing-library/react';
import { TierGate } from '@/components/tier/TierGate';

test('shows content for starter tier with storefront', () => {
  const { getByText } = render(
    <TierGate feature="storefront" tier="starter">
      <div>Storefront Content</div>
    </TierGate>
  );
  
  expect(getByText('Storefront Content')).toBeInTheDocument();
});

test('shows upgrade prompt for google_only tier without storefront', () => {
  const { getByText } = render(
    <TierGate feature="storefront" tier="google_only">
      <div>Storefront Content</div>
    </TierGate>
  );
  
  expect(getByText(/Feature Not Available/i)).toBeInTheDocument();
  expect(getByText(/Starter/i)).toBeInTheDocument();
});
```

## Related Files
- `apps/web/src/lib/tiers/tier-features.ts` - Feature definitions
- `apps/web/src/lib/tiers/useTierAccess.ts` - React hook
- `apps/api/src/middleware/tier-access.ts` - Backend enforcement
- `docs/TIER_BASED_FEATURE_SYSTEM.md` - Architecture docs
