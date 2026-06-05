# Feature Flags System Documentation

## Overview

The Retail Visibility Platform uses a unified feature flag system that supports both platform-wide and tenant-specific feature control with granular override permissions.

## Architecture

### Two-Level Flag System

1. **Platform Flags** - Global feature toggles that affect all tenants
2. **Tenant Flags** - Per-tenant feature toggles that can override platform settings (when permitted)

### Database Schema

```prisma
model PlatformFeatureFlag {
  id                  String   @id @default(cuid())
  flag                String   @unique
  enabled             Boolean  @default(false)
  rollout             String?
  allowTenantOverride Boolean  @default(false) @map("allow_tenant_override")
  updatedAt           DateTime @updatedAt @map("updated_at")
}

model TenantFeatureFlag {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  flag      String
  enabled   Boolean  @default(false)
  rollout   String?
  updatedAt DateTime @updatedAt @map("updated_at")
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, flag])
}
```

## Middleware

### Unified Flag Middleware

```typescript
requireFlag({ 
  flag: string,
  scope: 'platform' | 'tenant',
  tenantParam?: string,
  platformEnvVar?: string 
})
```

#### Platform Scope Logic
1. Check environment variable (e.g., `FF_TENANT_GBP_HOURS_SYNC`)
2. If env not set, check `platform_feature_flags` table
3. If both disabled, return 404

#### Tenant Scope Logic
1. Check platform kill-switch (env OR DB platform flag)
2. If platform disabled AND `allowTenantOverride=false` → Block (404)
3. If platform disabled AND `allowTenantOverride=true` → Check tenant flag
4. If platform enabled → Check tenant flag (must be enabled)

### Override Behavior

| Platform Status | Override Allowed | Tenant Flag | Result |
|----------------|------------------|-------------|--------|
| Disabled | No | Any | ❌ Blocked |
| Disabled | Yes | Enabled | ✅ Allowed |
| Disabled | Yes | Disabled | ❌ Blocked |
| Enabled | Any | Enabled | ✅ Allowed |
| Enabled | Any | Disabled | ❌ Blocked |

## API Endpoints

### Platform Flags

**List all platform flags**
```
GET /api/admin/platform-flags
Authorization: Bearer <token>
Requires: Platform ADMIN role
```

**Update platform flag**
```
PUT /api/admin/platform-flags/:flag
Authorization: Bearer <token>
Requires: Platform ADMIN role

Body:
{
  "enabled": boolean,
  "rollout": string | null,
  "allowTenantOverride": boolean
}
```

### Tenant Flags

**List tenant flags (includes inherited platform flags)**
```
GET /api/admin/tenant-flags/:tenantId
Authorization: Bearer <token>
Requires: Platform ADMIN OR tenant member
```

**Update tenant flag**
```
PUT /api/admin/tenant-flags/:tenantId/:flag
Authorization: Bearer <token>
Requires: Platform ADMIN OR tenant OWNER/ADMIN role

Body:
{
  "enabled": boolean,
  "rollout": string | null
}
```

## Authorization

### Role System

The platform uses a two-level role system:

#### Global Roles (`User.role`)
- **ADMIN** - Platform super admin (can manage everything)
- **OWNER** - Business owner (default for tenant creators)
- **USER** - Regular platform user

#### Tenant-Specific Roles (`UserTenant.role`)
- **OWNER** - Tenant owner (full control)
- **ADMIN** - Tenant admin (can manage settings)
- **MEMBER** - Regular member (can manage inventory)
- **VIEWER** - Read-only access

### Permission Matrix

| Action | Required Permission |
|--------|-------------------|
| View platform flags | Platform ADMIN |
| Modify platform flags | Platform ADMIN |
| View tenant flags | Platform ADMIN OR tenant member |
| Modify tenant flags | Platform ADMIN OR tenant OWNER/ADMIN |

## UI Components

### Platform Flags UI

**Location:** `/settings/admin/features`

**Features:**
- Card-based layout with toggle switches
- Rollout percentage buttons (20%, 50%, Enable All, Disable)
- Strategy display (on, off, pilot, percentage)
- "Allow tenants to override" checkbox
- Flag name badges (e.g., `FF_TENANT_URLS`)

**Current State:** Uses localStorage (legacy system)
**Migration Path:** Needs to be updated to use DB-backed API

### Tenant Flags UI

**Location:** `/admin/tenants/:tenantId/flags`

**Features:**
- Card-based layout matching platform flags
- Toggle switches for enable/disable
- Enabled/Disabled badges
- "Platform Override Allowed" badge for inherited flags
- Rollout notes field

**Inherited Flags:**
When a platform flag has `allowTenantOverride=true`, it automatically appears in the tenant flags UI as a virtual entry, allowing tenants to enable it even if the platform has it disabled.

### Tenant Settings Integration

**Location:** `/t/:tenantId/settings`

The tenant settings page includes a "Tenant Administration" section with cards for:
- **Tenant Users** → `/tenants/:tenantId/users`
- **Feature Flags** (Admin badge) → `/admin/tenants/:tenantId/flags`
- **Business Hours** → `/t/:tenantId/settings/hours`

## Usage Examples

### Example 1: Platform Admin Enables Feature Globally

```typescript
// Platform admin enables a feature for all tenants
PUT /api/admin/platform-flags/gbp_hours
{
  "enabled": true,
  "allowTenantOverride": false
}

// Result: All tenants must enable the flag individually
// Middleware checks: Platform ON → Check tenant flag
```

### Example 2: Platform Admin Allows Tenant Override

```typescript
// Platform admin allows tenants to opt-in even if platform disabled
PUT /api/admin/platform-flags/experimental_feature
{
  "enabled": false,
  "allowTenantOverride": true
}

// Tenant owner enables it for their tenant
PUT /api/admin/tenant-flags/tenant123/experimental_feature
{
  "enabled": true
}

// Result: Feature works for tenant123 even though platform disabled
// Middleware checks: Platform OFF + Override ON → Check tenant flag → ON
```

### Example 3: Emergency Kill Switch

```typescript
// Platform admin disables feature globally without override
PUT /api/admin/platform-flags/problematic_feature
{
  "enabled": false,
  "allowTenantOverride": false
}

// Result: Feature disabled for ALL tenants immediately
// Middleware checks: Platform OFF + Override OFF → Block (404)
```

## Environment Variables

Platform flags can be controlled via environment variables as a master kill-switch:

```bash
# Enable platform flag via env (overrides DB)
FF_TENANT_GBP_HOURS_SYNC=true

# Disable platform flag via env (overrides DB)
FF_TENANT_GBP_HOURS_SYNC=false
```

**Priority:** Environment variable > Database flag

## Migration Guide

### Migrating from localStorage to Database

The current platform flags UI (`/settings/admin/features`) uses localStorage. To migrate:

1. **Export existing flags:**
   ```javascript
   const flags = JSON.parse(localStorage.getItem('feature_flags') || '{}');
   ```

2. **Seed database:**
   ```typescript
   for (const [flag, config] of Object.entries(flags)) {
     await prisma.platformFeatureFlag.upsert({
       where: { flag },
       update: { 
         enabled: config.strategy === 'on',
         rollout: config.rollout || null,
       },
       create: { 
         flag,
         enabled: config.strategy === 'on',
         rollout: config.rollout || null,
         allowTenantOverride: false,
       },
     });
   }
   ```

3. **Update UI to use API:**
   - Replace localStorage reads with `GET /api/admin/platform-flags`
   - Replace localStorage writes with `PUT /api/admin/platform-flags/:flag`
   - Wire up `allowTenantOverride` checkbox

## Best Practices

### 1. Use Descriptive Flag Names
```typescript
// Platform flags (start with FF_)
FF_TENANT_GBP_HOURS_SYNC
FF_ITEMS_V2_GRID
FF_BUSINESS_PROFILE

// Custom tenant flags (start with TENANT_)
TENANT_CUSTOM_CHECKOUT
TENANT_BETA_FEATURE
TENANT_SPECIAL_PRICING

// Bad
FEATURE_1
NEW_THING
TEST
```

### 2. Custom Tenant Flags (Advanced)

**Naming Convention:**
- Custom tenant flags MUST start with `TENANT_` prefix
- Example: `TENANT_CUSTOM_FEATURE`, `TENANT_BETA_TEST`

**Important Notes:**
- Custom flags do NOT affect functionality until code is deployed
- Requires developer to add middleware or UI checks
- Used for tenant-specific customizations
- Not recommended for common platform usage

**When to Use:**
- Tenant-specific feature development
- A/B testing with specific tenants
- Beta testing with volunteer tenants
- Unique requirements for individual tenants

**UI Validation:**
The tenant flags UI enforces:
- Custom flags must start with `TENANT_` prefix
- Warning dialog explains advanced nature
- "Custom Flag" badge for visual distinction

### 2. Set Override Permissions Carefully
- **Don't allow override** for critical features or security-sensitive flags
- **Allow override** for experimental features or tenant-specific preferences
- **Document** why override is allowed/disallowed

### 3. Use Rollout Notes
```typescript
{
  "rollout": "Pilot: 5 tenants in US-East region"
}
```

### 4. Clean Up Old Flags
Periodically review and remove flags that are:
- Fully rolled out (100% enabled)
- No longer needed
- Replaced by newer features

## Troubleshooting

### Flag Not Working for Tenant

1. **Check platform flag status:**
   ```sql
   SELECT * FROM platform_feature_flags WHERE flag = 'your_flag';
   ```

2. **Check tenant flag status:**
   ```sql
   SELECT * FROM tenant_feature_flags 
   WHERE tenant_id = 'your_tenant_id' AND flag = 'your_flag';
   ```

3. **Check override permission:**
   - If platform disabled and `allowTenantOverride=false`, tenant cannot enable
   - If platform enabled, tenant must also enable

4. **Check environment variable:**
   - Env vars override database settings
   - Check `process.env.FF_YOUR_FLAG`

### 403 Forbidden When Modifying Tenant Flags

**Cause:** User doesn't have required role

**Solution:**
- Verify user has `OWNER` or `ADMIN` role in `user_tenants` table
- Platform admins bypass this check automatically

### Tenant Can't See Inherited Flags

**Cause:** Platform flag doesn't have `allowTenantOverride=true`

**Solution:**
```typescript
PUT /api/admin/platform-flags/your_flag
{
  "allowTenantOverride": true
}
```

## Security Considerations

1. **Platform flags are admin-only** - Only platform admins can modify platform flags
2. **Tenant flags require ownership** - Only tenant owners/admins can modify their tenant's flags
3. **Override is opt-in** - Tenants cannot override unless explicitly allowed
4. **Environment variables are master** - Env vars override DB for emergency control
5. **Audit logging** - All flag changes should be logged (TODO: implement audit trail)

## Future Enhancements

- [ ] Audit trail for flag changes
- [ ] Scheduled flag rollouts (enable at specific date/time)
- [ ] A/B testing support with percentage-based rollouts
- [ ] Flag dependencies (flag A requires flag B)
- [ ] Bulk flag operations
- [ ] Flag analytics (usage metrics, performance impact)
- [ ] Automated flag cleanup suggestions

## Related Documentation

- [Authentication & Authorization](./AUTH_SYSTEM.md)
- [Tenant Management](./TENANT_MANAGEMENT.md)
- [API Reference](./API_REFERENCE.md)
