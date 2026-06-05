# Migration Verification Checklist

## Pre-Migration State (localStorage)

Current flag states that MUST be preserved:

| Flag | Current State | Must Remain |
|------|--------------|-------------|
| `FF_MAP_CARD` | `strategy: 'off'` | ❌ Disabled |
| `FF_SWIS_PREVIEW` | `strategy: 'off'` | ❌ Disabled |
| `FF_BUSINESS_PROFILE` | `strategy: 'on'` | **✅ ENABLED** |
| `FF_DARK_MODE` | `strategy: 'off'` | ❌ Disabled |
| `FF_GOOGLE_CONNECT_SUITE` | `strategy: 'pilot'` | ❌ Disabled |
| `FF_APP_SHELL_NAV` | `strategy: 'off'` | ❌ Disabled |
| `FF_TENANT_URLS` | `strategy: 'off'` | ❌ Disabled |
| `FF_ITEMS_V2_GRID` | `strategy: 'off'` | ❌ Disabled |
| `FF_CATEGORY_MANAGEMENT_PAGE` | `strategy: 'on'` | **✅ ENABLED** |
| `FF_CATEGORY_QUICK_ACTIONS` | `strategy: 'off'` | ❌ Disabled |

## Critical Verification Steps

### Step 1: Before Running Seed Script

```bash
# Verify current production state
# Check that these features are working:
- [ ] Business Profile pages load correctly
- [ ] Category Management is accessible
- [ ] All other features behave as expected
```

### Step 2: Run Seed Script

```bash
cd apps/api
npx ts-node src/scripts/seed-platform-flags.ts
```

**Expected Output:**
```
🌱 Seeding platform feature flags...

⏸️ 🔓 FF_MAP_CARD
   Google Maps integration for tenant locations with privacy controls

⏸️ 🔓 FF_SWIS_PREVIEW
   Product preview widget showing live inventory feed

✅ 🔒 FF_BUSINESS_PROFILE
   Complete business profile management and onboarding

⏸️ 🔓 FF_DARK_MODE
   Dark theme support across the platform (coming soon)

⏸️ 🔒 FF_GOOGLE_CONNECT_SUITE
   Pilot: Google Merchant Center + Business Profile integration (v1: read-only)

⏸️ 🔒 FF_APP_SHELL_NAV
   Enable the new header and Tenant Switcher (URL-driven tenant context)

⏸️ 🔒 FF_TENANT_URLS
   Enable tenant-scoped routes like /t/{tenantId}/items and /t/{tenantId}/settings

⏸️ 🔓 FF_ITEMS_V2_GRID
   Enable the new high-performance items grid (virtualized, faster filters)

✅ 🔒 FF_CATEGORY_MANAGEMENT_PAGE
   Enable category management page and features

⏸️ 🔓 FF_CATEGORY_QUICK_ACTIONS
   Enable quick actions for category management

✅ Platform flags seeded successfully!
```

**Legend:**
- ✅ = Enabled
- ⏸️ = Disabled
- 🔓 = Tenant override allowed
- 🔒 = Tenant override blocked

### Step 3: Database Verification

```sql
-- Verify all flags are present
SELECT flag, enabled, allow_tenant_override 
FROM platform_feature_flags 
ORDER BY flag;

-- Expected results:
-- FF_APP_SHELL_NAV              | false | false
-- FF_BUSINESS_PROFILE            | TRUE  | false  ← ENABLED
-- FF_CATEGORY_MANAGEMENT_PAGE    | TRUE  | false  ← ENABLED
-- FF_CATEGORY_QUICK_ACTIONS      | false | true
-- FF_DARK_MODE                   | false | true
-- FF_GOOGLE_CONNECT_SUITE        | false | false
-- FF_ITEMS_V2_GRID               | false | true
-- FF_MAP_CARD                    | false | true
-- FF_SWIS_PREVIEW                | false | true
-- FF_TENANT_URLS                 | false | true
```

### Step 4: UI Verification

Navigate to `/settings/admin/platform-flags`

**Check each flag:**

- [ ] `FF_MAP_CARD` - Toggle is OFF, Override checkbox is CHECKED
- [ ] `FF_SWIS_PREVIEW` - Toggle is OFF, Override checkbox is CHECKED
- [ ] `FF_BUSINESS_PROFILE` - **Toggle is ON**, Override checkbox is UNCHECKED
- [ ] `FF_DARK_MODE` - Toggle is OFF, Override checkbox is CHECKED
- [ ] `FF_GOOGLE_CONNECT_SUITE` - Toggle is OFF, Override checkbox is UNCHECKED
- [ ] `FF_APP_SHELL_NAV` - Toggle is OFF, Override checkbox is UNCHECKED
- [ ] `FF_TENANT_URLS` - Toggle is OFF, Override checkbox is UNCHECKED
- [ ] `FF_ITEMS_V2_GRID` - Toggle is OFF, Override checkbox is CHECKED
- [ ] `FF_CATEGORY_MANAGEMENT_PAGE` - **Toggle is ON**, Override checkbox is UNCHECKED
- [ ] `FF_CATEGORY_QUICK_ACTIONS` - Toggle is OFF, Override checkbox is CHECKED

### Step 5: Functional Verification

**Test enabled features still work:**

- [ ] Navigate to Business Profile page
  - URL: `/settings/tenant` or `/t/{tenantId}/settings`
  - Verify page loads correctly
  - Verify all profile fields are accessible
  
- [ ] Navigate to Category Management
  - URL: `/t/{tenantId}/categories` or similar
  - Verify categories list loads
  - Verify can create/edit categories

**Test disabled features remain disabled:**

- [ ] Verify Map Card is NOT visible (if it has UI)
- [ ] Verify SWIS Preview is NOT visible (if it has UI)
- [ ] Verify Dark Mode toggle is NOT available
- [ ] Verify Items V2 Grid is NOT active (old grid still in use)

### Step 6: Middleware Verification

**Test platform flag enforcement:**

```bash
# If you have middleware protecting routes, test them:
# Example: Business Hours sync (if using FF_TENANT_GBP_HOURS_SYNC)

# Should work (flag enabled):
curl -X POST http://localhost:4000/api/tenant/{tenantId}/gbp/hours/mirror \
  -H "Authorization: Bearer {token}"

# Should return 404 if flag disabled:
curl -X POST http://localhost:4000/api/some-disabled-feature \
  -H "Authorization: Bearer {token}"
```

### Step 7: Tenant Override Verification

**Test override functionality:**

1. Navigate to `/settings/admin/platform-flags`
2. Find `FF_MAP_CARD` (disabled, override allowed)
3. Navigate to `/admin/tenants/{tenantId}/flags`
4. Verify `FF_MAP_CARD` appears with "Platform Override Allowed" badge
5. Enable it for the tenant
6. Verify tenant can use the feature even though platform disabled

### Step 8: Rollback Verification

**Ensure rollback is possible:**

- [ ] Legacy system still accessible at `/settings/admin/features`
- [ ] localStorage flags still present in browser
- [ ] Can toggle flags in legacy system
- [ ] Environment variables still override DB (test with `FF_BUSINESS_PROFILE=false`)

## Post-Migration Checklist

- [ ] All 10 flags seeded successfully
- [ ] Database query shows correct enabled states
- [ ] UI shows correct toggle positions
- [ ] UI shows correct override checkboxes
- [ ] Business Profile feature works
- [ ] Category Management feature works
- [ ] Disabled features remain disabled
- [ ] Tenant override works for allowed flags
- [ ] Legacy system still accessible
- [ ] No errors in browser console
- [ ] No errors in API logs

## Rollback Plan

If issues are detected:

1. **Immediate:** Use legacy system at `/settings/admin/features`
2. **Emergency:** Set environment variables to override DB:
   ```bash
   FF_BUSINESS_PROFILE=true
   FF_CATEGORY_MANAGEMENT_PAGE=true
   ```
3. **Full Rollback:** Clear `platform_feature_flags` table:
   ```sql
   DELETE FROM platform_feature_flags;
   ```

## Success Criteria

✅ Migration is successful when:
- All flags match pre-migration state
- No production features are disrupted
- UI correctly reflects database state
- Tenant override functionality works
- Legacy system remains available
- No errors in logs or console

## Sign-Off

- [ ] Technical Lead: Verified database state
- [ ] QA: Verified UI functionality
- [ ] Product: Verified no feature disruption
- [ ] DevOps: Verified rollback capability

**Date:** _____________  
**Approved By:** _____________
