# Platform Flags Migration Scripts

## Seed Platform Flags to Database

This script migrates the default platform feature flags from localStorage to the database.

### Prerequisites

- Database connection configured in `.env`
- Prisma client generated (`npx prisma generate`)
- Migration applied (`npx prisma migrate deploy` or `npx prisma db push`)

### Run the Seed Script

```bash
cd apps/api
npx ts-node src/scripts/seed-platform-flags.ts
```

### What It Does

1. Creates or updates platform flags in the `platform_feature_flags` table
2. Sets default values for:
   - `enabled` - Whether the flag is active
   - `rollout` - Description/notes about the flag
   - `allowTenantOverride` - Whether tenants can override platform settings

### Default Flags (State Preservation)

The script seeds these flags **matching current localStorage state**:

| Flag | Enabled | Override Allowed | Description | localStorage |
|------|---------|------------------|-------------|--------------|
| `FF_MAP_CARD` | ❌ No | ✅ Yes | Google Maps integration | `strategy: 'off'` |
| `FF_SWIS_PREVIEW` | ❌ No | ✅ Yes | Product preview widget | `strategy: 'off'` |
| `FF_BUSINESS_PROFILE` | **✅ YES** | ❌ No | Business profile (deployed) | `strategy: 'on'` ✅ |
| `FF_DARK_MODE` | ❌ No | ✅ Yes | Dark theme support | `strategy: 'off'` |
| `FF_GOOGLE_CONNECT_SUITE` | ❌ No | ❌ No | Google integrations (pilot) | `strategy: 'pilot'` |
| `FF_APP_SHELL_NAV` | ❌ No | ❌ No | New header and tenant switcher | `strategy: 'off'` |
| `FF_TENANT_URLS` | ❌ No | ❌ No | Tenant-scoped routes | `strategy: 'off'` |
| `FF_ITEMS_V2_GRID` | ❌ No | ✅ Yes | High-performance items grid | `strategy: 'off'` |
| `FF_CATEGORY_MANAGEMENT_PAGE` | **✅ YES** | ❌ No | Category management (deployed) | `strategy: 'on'` ✅ |
| `FF_CATEGORY_QUICK_ACTIONS` | ❌ No | ✅ Yes | Category quick actions | `strategy: 'off'` |

**⚠️ Important:** Only 2 flags are enabled by default:
- `FF_BUSINESS_PROFILE` - Already deployed in production
- `FF_CATEGORY_MANAGEMENT_PAGE` - Already deployed in production

All other flags remain disabled to match current behavior.

### After Seeding

1. **Verify in database:**
   ```sql
   SELECT flag, enabled, allow_tenant_override FROM platform_feature_flags;
   ```

2. **Access the UI:**
   - Navigate to `/settings/admin/platform-flags`
   - Verify all flags are visible
   - Test toggle switches and override checkboxes

3. **Update environment variables (optional):**
   - Remove localStorage-based flag overrides
   - Use env vars only for emergency kill-switches

### Customizing Default Flags

Edit `src/scripts/seed-platform-flags.ts` and modify the `DEFAULT_FLAGS` array:

```typescript
{
  flag: 'FF_YOUR_FLAG',
  enabled: false,
  rollout: 'Description of your flag',
  allowTenantOverride: true,
}
```

### Troubleshooting

**Error: "Cannot find module '../prisma'"**
- Run `npx prisma generate` first

**Error: "Table 'platform_feature_flags' doesn't exist"**
- Run the migration: `npx prisma migrate deploy` or `npx prisma db push`

**Flags not showing in UI:**
- Check browser console for API errors
- Verify authentication (must be platform ADMIN)
- Check API logs for authorization failures

### Re-running the Script

The script uses `upsert`, so it's safe to run multiple times. Existing flags will be updated with new values.

To reset all flags to defaults:
```bash
npx ts-node src/scripts/seed-platform-flags.ts
```

## Next Steps

After seeding:
1. ✅ Flags are in database
2. ✅ UI is functional at `/settings/admin/platform-flags`
3. ✅ Tenant override feature is enabled
4. 🔄 Migrate users from `/settings/admin/features` (legacy) to new system
5. 🔄 Update documentation links
6. 🔄 Train team on new features
