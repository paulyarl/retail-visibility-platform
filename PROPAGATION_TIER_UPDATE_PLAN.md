# Propagation Tier Update Plan

**Issue:** Propagation is currently restricted to Organization tier only, but Starter/Professional/Enterprise tiers can have multiple locations and need propagation tools.

**Solution:** Make propagation available starting at Starter tier (when users have 2+ locations)

---

## Files That Need Updates

### 1. Feature Catalog (Core Definition)
**File:** `apps/web/src/lib/features/feature-catalog.ts`

**Current:**
```typescript
{
  id: 'propagation',
  name: 'Chain-Wide Updates',
  requiredTier: 'organization',  // ❌ WRONG
}
```

**Update to:**
```typescript
{
  id: 'propagation',
  name: 'Multi-Location Updates',
  tagline: 'Update all your locations at once',
  description: "Got more than one location? Update prices, add products, or change settings across all your stores with one click. No more updating each location manually!",
  icon: 'propagation',
  pillar: 'scale',
  category: 'locations',
  requiredTier: 'starter',  // ✅ Available when you can have multiple locations
  route: '/propagation',
  requiresMultipleLocations: true,  // Only show if user has 2+ tenants
}
```

---

### 2. Tier Features Configuration
**File:** `apps/web/src/lib/tiers/tier-features.ts`

**Current (lines 139-141):**
```typescript
// Organization tier features
propagation_products: 'organization',
propagation_categories: 'organization',
propagation_gbp_sync: 'organization',
```

**Update to:**
```typescript
// Multi-location features (Starter+)
propagation_products: 'starter',
propagation_categories: 'starter',
propagation_gbp_sync: 'starter',
propagation_hours: 'starter',
propagation_profile: 'starter',

// Advanced propagation (Organization only)
propagation_selective: 'organization',  // Choose specific locations
propagation_scheduling: 'organization',  // Schedule propagation
propagation_rollback: 'organization',    // Rollback changes
```

---

### 3. Features Marketing Page
**File:** `apps/web/src/app/features/page.tsx`

**Current (line 38):**
```typescript
title: 'Organization Propagation Control - Enterprise Command Center',
description: '🚀 REVOLUTIONARY: Manage your entire chain from one dashboard...',
```

**Update to:**
```typescript
title: 'Multi-Location Management - Update All Stores at Once',
description: '🚀 POWERFUL: Manage all your locations from one dashboard. Update prices, add products, or change settings across all your stores with one click. Available on Starter tier and above when you have multiple locations.',
benefits: [
  'Update all locations at once (Starter+)',
  'Push products, categories, hours, and profile info',
  'Test changes before applying',
  'Advanced features: Selective propagation, scheduling, rollback (Organization tier)',
],
tier: 'Starter+ (with multiple locations)',
```

---

### 4. Offerings/Pricing Page
**File:** `apps/web/src/app/(platform)/settings/offerings/page.tsx`

**Current (lines 49-58):**
```typescript
{/* Organization Propagation Control - ENTERPRISE! */}
<div className="bg-gradient-to-br from-emerald-500 to-teal-600...">
  <div className="absolute -top-2 -right-2 bg-amber-400 text-emerald-900...">
    ENTERPRISE
  </div>
  <h3>Organization Propagation Control</h3>
  <ul>
    <li>• 8 propagation types...</li>
  </ul>
</div>
```

**Update to:**
```typescript
{/* Multi-Location Management - STARTER+ */}
<div className="bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-blue-400 rounded-lg p-6 text-white relative shadow-xl">
  <div className="absolute -top-2 -right-2 bg-green-400 text-blue-900 text-xs px-3 py-1 rounded-full font-bold">
    STARTER+
  </div>
  <div className="text-4xl mb-3">🔗</div>
  <h3 className="text-lg font-bold mb-2">Multi-Location Management</h3>
  <ul className="space-y-1 text-sm">
    <li>• Update all locations at once</li>
    <li>• Push products, categories, hours, profile</li>
    <li>• Test before applying chain-wide</li>
    <li>• Save hours of manual work</li>
  </ul>
  <p className="text-xs mt-3 opacity-90">
    Advanced features (selective propagation, scheduling) on Organization tier
  </p>
</div>
```

---

### 5. Dashboard Showcase Component
**File:** `apps/web/src/components/dashboard/WhatYouCanDo.tsx`

**Search for:** Propagation feature display

**Update:**
- Change tier requirement from Organization to Starter
- Update description to emphasize "2+ locations"
- Add note about advanced features on Organization tier

---

### 6. Propagation Settings Page
**File:** `apps/web/src/app/t/[tenantId]/settings/propagation/page.tsx`

**Current (lines 322, 347):**
```typescript
message="The Propagation Control Panel is only available to organization owners..."
description="...Propagation features are only available for chain organizations..."
```

**Update to:**
```typescript
message="The Propagation Control Panel requires multiple locations. Upgrade to Starter tier or higher to manage multiple locations."
description="Propagation features are available when you have 2 or more locations. Upgrade your plan to unlock multi-location management."
```

---

### 7. Propagate Item Modal
**File:** `apps/web/src/components/items/PropagateItemModal.tsx`

**Current (line 134):**
```typescript
description="This location is not part of a chain organization. Item propagation is only available for chain accounts."
```

**Update to:**
```typescript
description="Item propagation is available when you have 2 or more locations. Upgrade to Starter tier or higher to manage multiple locations."
```

---

### 8. Organization Settings Page
**File:** `apps/web/src/app/(platform)/settings/organization/page.tsx`

**Current (line 1152):**
```typescript
<p>📋 8 Types of Propagation Available</p>
```

**Update to:**
```typescript
<p>📋 Multi-Location Propagation (Starter+ with 2+ locations)</p>
<p className="text-xs">Advanced features (selective, scheduling) on Organization tier</p>
```

---

### 9. Permission System Documentation
**File:** `apps/web/src/hooks/dashboard/PERMISSION_SYSTEM.md`

**Current (line 101):**
```markdown
#### 3. Propagation (Organization tier, Manage permission)
```

**Update to:**
```markdown
#### 3. Propagation (Starter tier, Manage permission, 2+ locations required)

```typescript
// Level 1: Tenant must have Starter tier or higher
// Level 2: User must have canManage permission (ADMIN+)
// Level 3: User must have 2+ locations

const canPropagate = canAccess('propagation', 'canManage');

// ✅ ADMIN on Starter tier with 3 locations → TRUE
// ❌ ADMIN on Starter tier with 1 location → FALSE (needs 2+)
// ❌ MEMBER on Starter tier with 3 locations → FALSE (no canManage)
```
```

---

### 10. Access Control Documentation
**Files:**
- `apps/web/src/lib/auth/PROTECTED_CARD_USAGE.md`
- `apps/web/src/lib/auth/MIGRATION_GUIDE.md`
- `apps/web/src/lib/auth/ACCESS_CONTROL_DESIGN.md`

**Update all references:**
- Change `ORGANIZATION_ADMIN` to `STARTER_ADMIN` for propagation
- Update examples to show Starter tier with multiple locations
- Add notes about Organization tier advanced features

---

## Implementation Strategy

### Phase 1: Core Feature Update
1. Update `feature-catalog.ts` - Change tier requirement
2. Update `tier-features.ts` - Move propagation features to Starter
3. Add `requiresMultipleLocations` logic to feature display

### Phase 2: UI/Marketing Updates
4. Update `/features` page - Change messaging and tier badge
5. Update `/settings/offerings` page - Move to Starter section
6. Update dashboard showcase - Adjust tier display

### Phase 3: Settings & Modals
7. Update propagation settings page - Change access messages
8. Update propagate item modal - Change error messages
9. Update organization page - Clarify tier requirements

### Phase 4: Documentation
10. Update all permission system docs
11. Update access control examples
12. Update migration guides

---

## Testing Checklist

### Tier-Based Testing
- [ ] **Google-Only (1 location):** Propagation NOT shown
- [ ] **Starter (1 location):** Propagation NOT shown
- [ ] **Starter (3 locations):** Propagation SHOWN and works
- [ ] **Professional (10 locations):** Propagation SHOWN and works
- [ ] **Enterprise (25 locations):** Propagation SHOWN and works
- [ ] **Organization (unlimited):** Propagation SHOWN with advanced features

### Role-Based Testing
- [ ] **VIEWER:** Cannot see propagation (no canManage)
- [ ] **MEMBER:** Cannot see propagation (no canManage)
- [ ] **ADMIN:** Can see and use propagation (has canManage)
- [ ] **OWNER:** Can see and use propagation (has canManage)
- [ ] **PLATFORM_ADMIN:** Can see and use all propagation features

### UI Testing
- [ ] Features page shows correct tier (Starter+)
- [ ] Offerings page shows in Starter section
- [ ] Dashboard showcase shows when 2+ locations
- [ ] Propagation settings accessible on Starter tier
- [ ] Error messages updated for tier requirements
- [ ] Documentation examples are accurate

---

## Communication Plan

### User-Facing Changes
**Announcement:** "Multi-Location Management Now Available on Starter Tier!"

**Key Messages:**
- Propagation is now available starting at Starter tier
- Requires 2+ locations to use
- Save hours by updating all locations at once
- Advanced features (selective, scheduling) still Organization tier

### Documentation Updates
- Update help docs
- Update tier comparison chart
- Update feature matrix
- Update getting started guide

---

## Rollout Plan

### Pre-Launch
1. Update all code files
2. Test thoroughly across all tiers
3. Update documentation
4. Prepare announcement

### Launch
1. Deploy changes to staging
2. Verify all tests pass
3. Deploy to production
4. Send announcement email
5. Update marketing materials

### Post-Launch
1. Monitor usage metrics
2. Track support tickets
3. Gather user feedback
4. Iterate on messaging

---

## Success Metrics

### Adoption
- % of Starter tier users with 2+ locations using propagation
- % of Professional tier users using propagation
- % of Enterprise tier users using propagation

### Business Impact
- Reduction in manual update time
- Increase in multi-location account retention
- Upgrade rate from single to multi-location plans

### User Satisfaction
- Support ticket reduction
- Feature satisfaction scores
- User testimonials

---

## Risk Mitigation

### Potential Issues
1. **Confusion about tier requirements**
   - Solution: Clear messaging "Starter+ with 2+ locations"

2. **Users expect it with 1 location**
   - Solution: Show upgrade prompt to add more locations

3. **Organization tier users feel devalued**
   - Solution: Emphasize advanced features (selective, scheduling, rollback)

4. **Performance with many locations**
   - Solution: Batch processing, progress indicators

---

## Advanced Features (Organization Tier Only)

Keep these exclusive to Organization tier to maintain differentiation:

1. **Selective Propagation** - Choose specific locations
2. **Scheduled Propagation** - Schedule updates for later
3. **Propagation Rollback** - Undo changes if needed
4. **Propagation Templates** - Save common configurations
5. **Propagation Analytics** - Track propagation success rates
6. **Propagation Approvals** - Multi-step approval workflow

---

## Estimated Effort

**Development:** 2-3 days
- Code updates: 1 day
- Testing: 1 day
- Documentation: 0.5 day

**Total:** ~3 days for complete rollout

---

**Status:** Ready to implement
**Priority:** High - Improves value proposition for Starter/Professional/Enterprise tiers
**Impact:** Significant - Makes multi-location management actually usable for 90% of multi-location customers
