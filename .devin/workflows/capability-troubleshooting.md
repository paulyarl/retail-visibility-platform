---
description: Troubleshoot capability gate errors (merchant_gate_disabled, tier_restricted, capability_disabled)
---

# Capability Gate Troubleshooting

When a tenant dashboard or widget shows `merchant_gate_disabled` or `403 Forbidden` on a capability-gated endpoint, follow these steps:

## 1. Identify the Error

- **Error code**: `merchant_gate_disabled` — CRM (or other capability) is disabled for the tenant
- **Error code**: `capability_disabled` — Capability options are disabled for the tenant's tier
- **Error code**: `tier_restricted` — A specific sub-feature is not available on the tenant's current plan
- **HTTP status**: 403 Forbidden

Common endpoints affected:
- `/api/tenant/crm/stats` — CRM tenant widget
- `/api/tenant/crm/*` — All CRM tenant routes
- `/api/tenants/:tenantId/crm-options` — CRM options settings

## 2. Check Tenant's Current Capabilities

```bash
# Get tenant's tier and all capabilities
curl http://localhost:4000/api/tenants/{tenantId}/capabilities
```

Look for the relevant capability type (e.g., `crm_options`) in the response. If it's missing entirely, the tier doesn't have it assigned.

## 3. Check Tier Capability Assignment

```bash
# List capabilities for a specific tier
curl http://localhost:4000/api/admin/tier-capabilities?tierKey={tier_key} \
  -H "Authorization: Bearer {token}"
```

If the capability type (e.g., `crm_options`) is not listed, it needs to be added to the tier.

## 4. Add Missing Capability to Tier

Use the admin capabilities page at `/settings/admin/capabilities` or API:

```bash
curl -X POST http://localhost:4000/api/admin/tier-capabilities \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "tier_key": "omnichannel",
    "capability_type_key": "crm_options",
    "capability_enabled": true,
    "is_highlighted": true,
    "highlight_order": 1,
    "marketing_name": "CRM Options",
    "features": [
      {"feature_key": "crm_enabled", "is_enabled": true},
      {"feature_key": "crm_flexible", "is_enabled": true},
      {"feature_key": "crm_contact_management", "is_enabled": true},
      {"feature_key": "crm_inquiry_product_enabled", "is_enabled": true},
      {"feature_key": "crm_inquiry_storefront_enabled", "is_enabled": true}
    ]
  }'
```

**IMPORTANT**: Feature keys must NOT have leading/trailing spaces. The admin UI may inadvertently introduce spaces (e.g., `"  crm_enabled"` instead of `"crm_enabled"`). The backend now trims keys automatically, but existing corrupted data needs cleanup.

## 5. Fix Spaced Feature Keys (Data Corruption)

If feature keys have leading/trailing spaces in the database, `CrmOptionsService.resolveFromFeatures()` will fail to match `crm_enabled` because it finds `  crm_enabled` instead.

**Symptoms**: Tenant has the capability assigned, but `resolveCrmOptionsState()` still returns `enabled: false`.

**Diagnose**:
```sql
-- Check for spaced keys
SELECT id, feature_key, '>' || feature_key || '<' as quoted_key
FROM tier_features_list
WHERE feature_key != trim(feature_key);
```

**Fix**:
```bash
# Run the cleanup script
psql $DATABASE_URL -f scripts/cleanup-spaced-feature-keys.sql
```

Or manually:
```sql
UPDATE tier_features_list
SET feature_key = trim(feature_key), updated_at = now()
WHERE feature_key != trim(feature_key);

UPDATE features_list
SET key = trim(key), updated_at = now()
WHERE key != trim(key);
```

## 6. Verify Resolution

```bash
# Check tenant capabilities again
curl http://localhost:4000/api/tenants/{tenantId}/capabilities

# Check CRM options capability state
curl http://localhost:4000/api/tenants/{tenantId}/crm-options/capability \
  -H "Authorization: Bearer {token}"

# Test the gated endpoint
curl http://localhost:4000/api/tenant/crm/stats \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-ID: {tenantId}"
```

## 7. Seed CRM Capabilities (Bulk)

If CRM capabilities are missing across multiple tiers, run the seed script:

```bash
cd apps/api
npx tsx prisma/seed-crm-capabilities.ts
```

This seeds `crm_options` capability features for all standard tiers (discovery, storefront, commitment, ecommerce, omnichannel, professional, enterprise, etc.).

## Architecture Reference

### How Capability Gating Works

1. **`CrmOptionsService.resolveCrmOptionsState(tenantId)`** — Resolves CRM options from tenant's tier capabilities
   - Looks up tenant's `subscription_tier` and org's tier
   - Queries `tier_features_list` for CRM feature keys (`crm_*`)
   - Returns `CrmOptionsState` with `enabled: true/false`

2. **`checkCrmEnabled()`** — Middleware in tenant CRM routes (`apps/api/src/routes/crm/tenant/crm-tenant.ts:38`)
   - Calls `resolveCrmOptionsState()`
   - Returns 403 `merchant_gate_disabled` if `enabled === false`

3. **`CrmTenantWidget`** — Frontend widget on tenant dashboard
   - Calls `/api/tenant/crm/stats`
   - On `merchant_gate_disabled`, shows disabled state message

### Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/services/CrmOptionsService.ts` | Resolves CRM capability state from tier features |
| `apps/api/src/routes/crm/tenant/crm-tenant.ts` | Tenant CRM routes with `checkCrmEnabled` gate |
| `apps/api/src/routes/admin/tier-capabilities.ts` | Admin API for assigning capabilities to tiers |
| `apps/api/src/routes/admin/capability-types.ts` | Admin API for managing capability types |
| `apps/api/prisma/seed-crm-capabilities.ts` | Bulk seed CRM features across all tiers |
| `apps/web/src/components/crm/CrmTenantWidget.tsx` | Tenant dashboard CRM widget |
| `apps/web/src/admin/components/CapabilityManagement.tsx` | Admin capability management UI |
| `scripts/cleanup-spaced-feature-keys.sql` | SQL cleanup for corrupted feature keys |
