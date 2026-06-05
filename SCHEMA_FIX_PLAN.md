# Prisma Schema Fix Plan - Camel vs Snake Case

## Problem Analysis

The build is failing due to a systematic mismatch between:
1. **Code expectations**: camelCase model names (`inventoryItem`, `userTenant`, etc.)
2. **Schema reality**: snake_case model names + many models marked `@@ignore`
3. **Enum inconsistencies**: `UserRole` vs `user_role`

## Root Cause

The schema has duplicate models:
- `InventoryItem` (ignored) - what code expects
- `inventory_item` (active) - what Prisma generates

## Fix Strategy

### Phase 1: Remove Duplicate Models ✅
Remove ignored models that have active snake_case equivalents:
- Remove `InventoryItem` (use `inventory_item`)
- Remove `PhotoAsset` (use `photo_asset`) 
- Remove `ProductPerformance` (use `product_performance`)
- Remove `SyncJob` (use `sync_job`)

### Phase 2: Enable Required Models ✅
Remove `@@ignore` from models that are actively used:
- `barcode_enrichment`
- `barcode_lookup_log`
- `clover_integrations`
- `clover_item_mappings`
- `clover_sync_logs`
- `clover_demo_snapshots`
- `square_integrations`
- `square_product_mappings`
- `square_sync_logs`
- `scan_sessions`
- `scan_results`
- `tenant_category`
- `tenant_feature_flags`
- `tenant_feature_overrides`
- `google_taxonomy`
- `subscription_tiers`
- `tier_change_logs`
- `tier_features`
- `upgrade_requests`
- `organization_requests`
- `outreach_feedback`
- `permission_matrix`
- `permission_audit_log`
- `platform_feature_flags` (already active)
- `feed_push_jobs`
- `directory_settings`
- `directory_support_notes`
- `stripe_webhook_events`
- `sku_billing_policy_history`

### Phase 3: Add Missing Primary Keys ✅
Add `@id` to models that need it:
```prisma
model barcode_enrichment {
  id String @id @default(cuid())
  // ... rest of fields
}
```

### Phase 4: Fix Enum Naming ✅
Update enum imports in TypeScript files:
- `UserRole` → `user_role`
- `UserTenantRole` → `user_tenant_role`
- `AvailabilityStatus` → `availability_status`
- `ProductSource` → `product_source`
- `InventoryItem` → `inventory_item`

### Phase 5: Update Code References ✅
Update all TypeScript files to use correct model names:
- `prisma.inventoryItem` → `prisma.inventory_item`
- `prisma.userTenant` → `prisma.user_tenants`
- `prisma.photoAsset` → `prisma.photo_asset`
- etc.

## Implementation Order

1. **Schema fixes first** - Remove duplicates, enable models, add IDs
2. **Generate Prisma client** - `prisma generate`
3. **Update TypeScript imports** - Fix enum imports
4. **Update model references** - Fix all `prisma.modelName` calls
5. **Test build** - Verify no more errors

## Files to Update

### Schema File
- `apps/api/prisma/schema.prisma`

### TypeScript Files (97+ files need updates)
- All files using `inventoryItem`, `userTenant`, `photoAsset`, etc.
- All files importing `UserRole`, `UserTenantRole`, etc.

## Risk Mitigation

1. **Backup current schema** before changes
2. **Test in development** before production
3. **Update in phases** to isolate issues
4. **Verify all relations** work correctly

## Expected Outcome

After fixes:
- ✅ Build succeeds without TypeScript errors
- ✅ All models available in Prisma client
- ✅ Consistent naming throughout codebase
- ✅ No more `@@ignore` on actively used models
