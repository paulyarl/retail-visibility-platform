# Phase 3 Override Testing Guide

## Current Status
✅ Database table `tenant_feature_overrides` exists (0 records)
✅ Backend API deployed
✅ Tier middleware updated

## Test Scenario

### Test 1: Grant Product Scanning to Google-Only Tier

**Tenant**: Plainfield Grocery (cmhomilz90002o33aym2v960g)
**Current Tier**: Google-Only ($29/mo)
**Feature to Grant**: `product_scanning` (normally requires Professional $499/mo)

### Steps to Test

#### 1. Create Override via Prisma Studio

1. Open Prisma Studio (already open)
2. Click `TenantFeatureOverride` table
3. Click "Add record" button
4. Fill in fields:
   ```
   id: (leave blank - auto-generated)
   tenantId: cmhomilz90002o33aym2v960g
   feature: product_scanning
   granted: true
   reason: Phase 3 testing - Grant scanning to Google-Only tier
   expiresAt: (leave null for permanent, or set to 2024-12-31T23:59:59.000Z)
   grantedBy: admin_test
   createdAt: (leave blank - auto-generated)
   updatedAt: (leave blank - auto-generated)
   ```
5. Click "Save 1 change"
6. Verify record appears in table

#### 2. Test Feature Access

**Before Override:**
- Visit: https://retail-visibility-platform-web-git-staging-paul-yarls-projects.vercel.app/t/cmhomilz90002o33aym2v960g/scan
- Expected: "Feature Not Available" prompt
- Shows: "This feature requires Professional tier"

**After Override:**
- Refresh the same page
- Expected: Page loads normally (scan interface appears)
- No upgrade prompt

#### 3. Verify in Logs

Check Vercel logs for:
```
[Feature Access] Override used: product_scanning for tenant cmhomilz90002o33aym2v960g (reason: Phase 3 testing)
```

#### 4. Test Other Features (Should Still Be Blocked)

- Visit: https://retail-visibility-platform-web-git-staging-paul-yarls-projects.vercel.app/t/cmhomilz90002o33aym2v960g/quick-start
- Expected: Still blocked (no override for quick_start_wizard)

### Test 2: Test Expiration

#### Create Expired Override

1. In Prisma Studio, add another record:
   ```
   tenantId: cmhomilz90002o33aym2v960g
   feature: gbp_integration
   granted: true
   reason: Testing expiration
   expiresAt: 2024-01-01T00:00:00.000Z (past date)
   grantedBy: admin_test
   ```

2. Try to access GBP settings:
   - Visit: https://retail-visibility-platform-web-git-staging-paul-yarls-projects.vercel.app/t/cmhomilz90002o33aym2v960g/settings/gbp-category
   - Expected: Still blocked (expired override is ignored)

### Test 3: Test Revoke

#### Create Revoke Override

1. Find a Professional tier tenant (or upgrade your test tenant temporarily)
2. Create override:
   ```
   tenantId: <PROFESSIONAL_TENANT_ID>
   feature: product_scanning
   granted: false  ← REVOKE
   reason: Testing revoke - temporarily disable scanning
   expiresAt: null
   grantedBy: admin_test
   ```

3. Try to access scanning:
   - Expected: Blocked even though tier includes it
   - Shows: "Feature Not Available"

## Verification Checklist

- [ ] Override record created in database
- [ ] Feature access granted to lower tier
- [ ] Page loads without upgrade prompt
- [ ] Server logs show override usage
- [ ] Other features still blocked (no override)
- [ ] Expired override is ignored
- [ ] Revoke override blocks access

## Expected Database State After Tests

```sql
SELECT 
  id,
  feature,
  granted,
  reason,
  expires_at,
  created_at
FROM tenant_feature_overrides
WHERE tenant_id = 'cmhomilz90002o33aym2v960g';
```

Should show:
```
| feature           | granted | reason                  | expires_at |
|-------------------|---------|-------------------------|------------|
| product_scanning  | true    | Phase 3 testing         | null       |
| gbp_integration   | true    | Testing expiration      | 2024-01-01 |
```

## Cleanup After Testing

```sql
-- Remove test overrides
DELETE FROM tenant_feature_overrides 
WHERE reason LIKE '%testing%' OR reason LIKE '%Phase 3%';
```

Or via Prisma Studio:
1. Select the test records
2. Click "Delete" button
3. Confirm deletion

## Success Criteria

✅ Override grants access to blocked feature
✅ Page loads without errors
✅ Logs show override usage
✅ Expired overrides are ignored
✅ Revoke overrides block access
✅ No side effects on other features

## Troubleshooting

### Override Not Working
- Check `granted` field is `true`
- Check `expiresAt` is null or future date
- Check `tenantId` matches exactly
- Check `feature` name matches exactly (case-sensitive)
- Check Prisma Client was regenerated

### Still Seeing Upgrade Prompt
- Clear browser cache
- Check server logs for errors
- Verify override record exists
- Check middleware is calling `checkTierAccessWithOverrides()`

### 500 Errors
- Check Vercel logs for stack trace
- Verify Prisma Client includes `tenantFeatureOverride` model
- Check database connection

## Next Steps After Verification

1. ✅ Verify basic override works
2. Create admin UI for managing overrides
3. Add cleanup job for expired overrides
4. Update frontend to show override indicators
5. Add audit logging for override changes
