# V2 Platform Migration Plan

## Overview

The V2 platform migration represents a fundamental realignment from tier-based to feature-based commerce logic, introducing new pricing tiers and business model alignment. This migration affects database structure, checkout flows, admin interfaces, and customer-facing pages.

## Migration Scope

### Phase 1: Database & Backend ✅ COMPLETED
- [x] Create commerce features in `tier_features_list`
- [x] Update pricing (Commitment: $99→$79, add E-commerce $99, Omnichannel $149)
- [x] Add commerce features to all tiers
- [x] Create V2 trial tiers
- [x] Update API endpoints to return commerce features

### Phase 2: Checkout Flow ✅ COMPLETED
- [x] Update checkout logic to use feature-based approach
- [x] Add backward compatibility for tier-based logic
- [x] Test commerce mode detection

### Phase 3: Admin Interfaces 🔄 IN PROGRESS
- [ ] Update admin tier management UI
- [ ] Add feature management interface
- [ ] Update tenant creation/upgrade flows
- [ ] Add V2 tier selection in admin

### Phase 4: Customer-Facing Pages 📋 PENDING
- [ ] Update pricing page with new tiers
- [ ] Update upgrade/downgrade flows
- [ ] Update tier comparison tables
- [ ] Update dashboard tier displays

### Phase 5: Migration Tools 📋 PENDING
- [ ] Create Professional tier deprecation tool
- [ ] Build tenant migration wizard
- [ ] Add bulk tier update capabilities
- [ ] Create migration reporting

---

## Detailed Impact Analysis

### 1. Database Changes

#### Completed Changes
```sql
-- New commerce features
commerce_disabled     | Discovery, Storefront, google_only, expired_trial
commerce_enabled     | All commerce-capable tiers
commerce_deposit_only| Commitment tier
commerce_full_payment | Professional, Organization
commerce_flexible | Enterprise, Chain Professional

-- New V2 tiers (inactive)
ecommerce     | $99/mo | Tier 4
omnichannel   | $149/mo | Tier 5

-- Pricing updates
commitment     | $79/mo (was $99)
```

#### Pending Changes
- [ ] Activate V2 tiers when ready
- [ ] Migrate Professional tenants to E-commerce or Omnichannel
- [ ] Update sort orders for new tier structure

### 2. API Changes

#### Completed Changes
- `/api/tenants/:id/payment-gateways/public` now returns `commerce_features`
- Feature-based checkout mode detection

#### Pending Changes
- [ ] Update admin tier APIs to include feature management
- [ ] Add V2 tier activation endpoints
- [ ] Update tenant upgrade APIs with feature validation

### 3. Frontend Changes

#### Completed Changes
- Checkout page uses feature-based logic
- Backward compatibility maintained

#### Pending Changes
- [ ] **Pricing Page** (`/pricing`)
  - Update tier cards to show new structure
  - Add E-commerce and Omnichannel tiers
  - Remove Professional tier (or mark deprecated)
  - Update pricing displays

- [ ] **Admin Tier Management** (`/admin/tiers`)
  - Add feature toggles for each tier
  - Show commerce feature assignments
  - Add V2 tier activation controls
  - Update tier creation forms

- [ ] **Tenant Dashboard** (`/dashboard`)
  - Update tier display to show V2 alignment
  - Add upgrade prompts based on features
  - Update tier comparison tools

- [ ] **Upgrade/Downgrade Flows**
  - Update Stripe checkout to use new pricing
  - Add feature-based upgrade recommendations
  - Update confirmation dialogs

### 4. Admin Tools

#### New Tools Needed
- [ ] **Feature Management Interface**
  - Toggle commerce features per tier
  - Bulk feature updates
  - Feature impact preview

- [ ] **Tenant Migration Tool**
  - Professional → E-commerce/Omnichannel migration
  - Bulk tenant updates
  - Migration preview and confirmation

- [ ] **V2 Tier Activation**
  - Staged rollout controls
  - Feature validation
  - Rollback capabilities

---

## Migration Strategy

### Phase 1: Foundation ✅ COMPLETED
**Goal**: Enable feature-based logic without disrupting existing tenants
**Status**: Database migrated, checkout updated, backward compatible

### Phase 2: Admin Preparation 🔄 IN PROGRESS  
**Goal**: Prepare admin tools for V2 tier management
**Timeline**: 1-2 weeks

### Phase 3: Customer Migration 📋 PENDING
**Goal**: Migrate existing tenants to V2 structure
**Timeline**: 2-3 weeks

### Phase 4: V2 Launch 📋 PENDING
**Goal**: Activate V2 tiers and retire Professional
**Timeline**: 1 week

---

## Risk Assessment

### High Risk Areas
1. **Professional Tenant Migration**: Existing Professional tenants need migration path
2. **Pricing Page Updates**: Customer-facing changes need careful coordination
3. **Stripe Integration**: New pricing tiers require Stripe product updates

### Medium Risk Areas
1. **Admin UI Changes**: Feature management complexity
2. **Backward Compatibility**: Ensuring old logic still works during transition
3. **Data Consistency**: Feature assignments across all tiers

### Low Risk Areas
1. **Database Migration**: Already completed and tested
2. **Checkout Logic**: Feature-based approach is backward compatible

---

## Technical Implementation Plan

### 1. Admin Tier Management Updates

#### Files to Update
```
apps/web/src/app/admin/tiers/page.tsx
apps/web/src/components/admin/TierManagement.tsx
apps/web/src/components/admin/TierForm.tsx
apps/api/src/routes/admin/tiers.ts
```

#### Changes Required
- Add commerce feature toggles
- Update tier forms for V2 structure
- Add feature validation
- Update API endpoints

### 2. Pricing Page Updates

#### Files to Update
```
apps/web/src/app/pricing/page.tsx
apps/web/src/components/pricing/TierCard.tsx
apps/web/src/components/pricing/TierComparison.tsx
```

#### Changes Required
- New tier structure display
- Updated pricing
- Feature-based comparisons
- Remove/modify Professional tier

### 3. Tenant Migration Tools

#### New Components Needed
```
apps/web/src/components/admin/TenantMigration.tsx
apps/web/src/components/admin/FeatureManager.tsx
apps/api/src/routes/admin/migration.ts
```

#### Functionality
- Bulk tenant updates
- Migration preview
- Feature assignment tools
- Progress tracking

---

## Testing Strategy

### 1. Unit Tests
- [ ] Feature-based checkout logic
- [ ] Commerce feature detection
- [ ] Tier migration functions

### 2. Integration Tests
- [ ] API endpoint changes
- [ ] Database migration validation
- [ ] Stripe integration with new pricing

### 3. End-to-End Tests
- [ ] Complete checkout flows for each commerce mode
- [ ] Admin tier management workflows
- [ ] Tenant migration processes

### 4. User Acceptance Testing
- [ ] Admin team testing of new tools
- [ ] Customer feedback on pricing changes
- [ ] Migration tool validation

---

## Rollback Plan

### Database Rollback
```sql
-- Restore from backup tables
DROP TABLE subscription_tiers_list;
ALTER TABLE subscription_tiers_list_v1_backup RENAME TO subscription_tiers_list;

DROP TABLE tier_features_list;
ALTER TABLE tier_features_list_v1_backup RENAME TO tier_features_list;
```

### Code Rollback
- Git revert of frontend changes
- API endpoint versioning
- Feature flags for gradual rollout

---

## Success Metrics

### Technical Metrics
- [ ] All tenants have correct commerce features assigned
- [ ] Checkout flows work for all commerce modes
- [ ] Admin tools function without errors
- [ ] Zero data loss during migration

### Business Metrics
- [ ] Professional tenants successfully migrated
- [ ] New tier adoption rates
- [ ] Upgrade/downgrade conversion rates
- [ ] Customer satisfaction scores

---

## Timeline

| Phase | Duration | Start Date | End Date | Status |
|-------|----------|------------|----------|---------|
| Phase 1: Foundation | 1 week | May 6 | May 13 | ✅ Complete |
| Phase 2: Admin Prep | 2 weeks | May 13 | May 27 | 🔄 In Progress |
| Phase 3: Customer Migration | 3 weeks | May 27 | Jun 17 | 📋 Pending |
| Phase 4: V2 Launch | 1 week | Jun 17 | Jun 24 | 📋 Pending |

**Total Migration Time**: 7 weeks

---

## Next Steps

1. **Immediate (This Week)**
   - Complete admin tier management updates
   - Begin pricing page redesign
   - Create feature management interface

2. **Next Week**
   - Build tenant migration tools
   - Update Stripe products for new pricing
   - Start internal testing

3. **Following Weeks**
   - Customer migration execution
   - V2 tier activation
   - Monitor and optimize

---

## Dependencies

### External Dependencies
- [ ] Stripe product/pricing updates
- [ ] Email communications for tenant notifications
- [ ] Documentation updates

### Internal Dependencies
- [ ] Database backup procedures
- [ ] Testing environment setup
- [ ] Admin team training

---

## Contact Points

**Technical Lead**: Database and API changes
**Frontend Lead**: UI/UX updates and customer-facing changes  
**Product Lead**: Migration strategy and customer communication
**DevOps Lead**: Deployment and rollback procedures

---

*Last Updated: May 13, 2026*
*Next Review: May 20, 2026*
