# Protected Card Usage Guide

## Overview

The `ProtectedCard` component and utilities extend the centralized access control system to handle conditional rendering of settings cards based on user permissions.

## Benefits

- ✅ Consistent card visibility logic
- ✅ No duplicate access checks
- ✅ Automatic loading states
- ✅ Clean, declarative syntax
- ✅ Centralized permission management

## Usage Examples

### Example 1: Basic Protected Card

```typescript
import { ProtectedCard } from '@/lib/auth/ProtectedCard';
import { AccessPresets } from '@/lib/auth/useAccessControl';

<ProtectedCard 
  tenantId={tenantId}
  accessOptions={AccessPresets.ORGANIZATION_ADMIN}
  fetchOrganization={true}
>
  <SettingCard
    title="Propagation Control Panel"
    description="Manage multi-location propagation"
    href={`/t/${tenantId}/settings/propagation`}
    icon={<PropagationIcon />}
    color="bg-indigo-500"
    badge="Chain"
  />
</ProtectedCard>
```

### Example 2: Multiple Cards with Different Access Levels

```typescript
// In settings page
const cards = [
  // Always visible
  <SettingCard key="account" {...accountCard} />,
  
  // Only for org admins
  <ProtectedCard 
    key="propagation"
    tenantId={tenantId}
    accessOptions={AccessPresets.ORGANIZATION_ADMIN}
    fetchOrganization={true}
  >
    <SettingCard {...propagationCard} />
  </ProtectedCard>,
  
  // Only for platform admins
  <ProtectedCard 
    key="platform-admin"
    tenantId={tenantId}
    accessOptions={AccessPresets.PLATFORM_ADMIN_ONLY}
  >
    <SettingCard {...platformAdminCard} />
  </ProtectedCard>,
];
```

### Example 3: Show Locked State Instead of Hiding

```typescript
<ProtectedCard 
  tenantId={tenantId}
  accessOptions={AccessPresets.TENANT_ADMIN}
  hideWhenDenied={false}  // Show locked state instead of hiding
>
  <SettingCard {...premiumFeatureCard} />
</ProtectedCard>
```

### Example 4: Custom Denied Content

```typescript
<ProtectedCard 
  tenantId={tenantId}
  accessOptions={AccessPresets.ORGANIZATION_ADMIN}
  deniedContent={
    <div className="p-4 bg-neutral-100 rounded-lg text-center">
      <p className="text-sm text-neutral-600">
        Upgrade to Chain plan to unlock this feature
      </p>
      <Button href="/upgrade">Upgrade Now</Button>
    </div>
  }
>
  <SettingCard {...chainFeatureCard} />
</ProtectedCard>
```

### Example 5: Using useCardAccess Hook

```typescript
import { useCardAccess } from '@/lib/auth/ProtectedCard';
import { AccessPresets } from '@/lib/auth/useAccessControl';

function SettingsPage({ tenantId }: { tenantId: string }) {
  // Check multiple permissions at once
  const access = useCardAccess(tenantId, {
    canViewPropagation: AccessPresets.ORGANIZATION_ADMIN,
    canViewAdmin: AccessPresets.PLATFORM_ADMIN_ONLY,
    canViewBilling: AccessPresets.TENANT_OWNER_ONLY,
  });

  return (
    <div>
      {access.canViewPropagation && <PropagationCard />}
      {access.canViewAdmin && <AdminCard />}
      {access.canViewBilling && <BillingCard />}
    </div>
  );
}
```

### Example 6: Conditional Array Filtering

```typescript
import { conditionalCard } from '@/lib/auth/ProtectedCard';

const { hasAccess: canViewPropagation } = useAccessControl(
  tenantId,
  AccessPresets.ORGANIZATION_ADMIN
);

const cards = [
  basicCard,
  settingsCard,
  conditionalCard(propagationCard, canViewPropagation),
  conditionalCard(adminCard, isPlatformAdmin),
].filter(Boolean);  // Remove null entries
```

## Settings Page Integration

### Before (Manual Filtering)

```typescript
const settingsGroups = [
  {
    title: 'Organization Management',
    cards: [
      {
        title: 'Propagation Control Panel',
        // ...
      },
    ].filter(card => {
      // Custom access logic per card
      if (card.requiresOrgAdmin) {
        return user.isOrgAdmin;
      }
      return true;
    }),
  },
];
```

### After (Centralized)

```typescript
const settingsGroups = [
  {
    title: 'Organization Management',
    cards: [
      <ProtectedCard 
        tenantId={tenantId}
        accessOptions={AccessPresets.ORGANIZATION_ADMIN}
      >
        <SettingCard
          title="Propagation Control Panel"
          // ...
        />
      </ProtectedCard>,
    ],
  },
];
```

## Advanced Patterns

### Pattern 1: Nested Access Checks

```typescript
<ProtectedCard 
  tenantId={tenantId}
  accessOptions={{ requireOrganization: true }}
>
  <div>
    <h3>Organization Features</h3>
    
    <ProtectedCard 
      tenantId={tenantId}
      accessOptions={AccessPresets.ORGANIZATION_ADMIN}
    >
      <AdminOnlyFeature />
    </ProtectedCard>
    
    <ProtectedCard 
      tenantId={tenantId}
      accessOptions={AccessPresets.ORGANIZATION_MEMBER}
    >
      <MemberFeature />
    </ProtectedCard>
  </div>
</ProtectedCard>
```

### Pattern 2: Dynamic Access Options

```typescript
function DynamicCard({ feature, tenantId }: Props) {
  const accessOptions = useMemo(() => {
    switch (feature.tier) {
      case 'premium':
        return AccessPresets.ORGANIZATION_ADMIN;
      case 'basic':
        return AccessPresets.TENANT_ADMIN;
      default:
        return AccessPresets.AUTHENTICATED;
    }
  }, [feature.tier]);

  return (
    <ProtectedCard 
      tenantId={tenantId}
      accessOptions={accessOptions}
    >
      <FeatureCard {...feature} />
    </ProtectedCard>
  );
}
```

### Pattern 3: Batch Access Checks for Performance

```typescript
// Check all permissions once
const access = useCardAccess(tenantId, {
  propagation: AccessPresets.ORGANIZATION_ADMIN,
  billing: AccessPresets.TENANT_OWNER_ONLY,
  admin: AccessPresets.PLATFORM_ADMIN_ONLY,
  settings: AccessPresets.TENANT_ADMIN,
});

// Use results to conditionally render
const organizationCards = [
  access.propagation && propagationCard,
  access.billing && billingCard,
].filter(Boolean);

const adminCards = [
  access.admin && platformAdminCard,
  access.settings && settingsCard,
].filter(Boolean);
```

## Migration Strategy

1. **Identify cards with access restrictions**
   - Look for `adminOnly`, `platformAdminOnly`, custom filters
   
2. **Wrap with ProtectedCard**
   - Choose appropriate `AccessPresets`
   - Set `fetchOrganization` if needed
   
3. **Remove old access logic**
   - Delete custom filter functions
   - Remove manual permission checks
   
4. **Test all user roles**
   - Platform admin
   - Organization admin
   - Tenant admin
   - Tenant member

## Best Practices

1. ✅ Use `ProtectedCard` for all conditional cards
2. ✅ Use `AccessPresets` instead of custom options when possible
3. ✅ Set `fetchOrganization={true}` for org-related features
4. ✅ Use `hideWhenDenied={true}` (default) for cleaner UI
5. ✅ Use `useCardAccess` for multiple checks to avoid redundant API calls
6. ❌ Don't mix ProtectedCard with manual access checks
7. ❌ Don't duplicate access logic in multiple places

## Performance Considerations

- `ProtectedCard` makes API calls - use `useCardAccess` for multiple cards
- Loading states are handled automatically
- Cards are hidden during loading to prevent flashing
- Consider memoization for expensive card renders

## Testing

```typescript
describe('ProtectedCard', () => {
  it('shows card when user has access', () => {
    mockAccessControl({ hasAccess: true });
    render(<ProtectedCard><Card /></ProtectedCard>);
    expect(screen.getByRole('card')).toBeInTheDocument();
  });

  it('hides card when user lacks access', () => {
    mockAccessControl({ hasAccess: false });
    render(<ProtectedCard><Card /></ProtectedCard>);
    expect(screen.queryByRole('card')).not.toBeInTheDocument();
  });

  it('shows locked state when hideWhenDenied is false', () => {
    mockAccessControl({ hasAccess: false });
    render(<ProtectedCard hideWhenDenied={false}><Card /></ProtectedCard>);
    expect(screen.getByRole('img', { name: /lock/i })).toBeInTheDocument();
  });
});
```

## Summary

The `ProtectedCard` system extends centralized access control to UI rendering, ensuring:
- Consistent visibility rules
- No duplicate permission checks
- Clean, declarative code
- Easy maintenance
- Single source of truth

Use it for ALL conditional cards in settings pages and dashboards!
