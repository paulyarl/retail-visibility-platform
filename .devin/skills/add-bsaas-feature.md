---
description: How to add, gate, and surface à la carte purchased features (BSaaS) that bypass tier gates via the tenant_feature_purchases table
---

# BSaaS Feature Purchase Integration Guide

This document describes how to add a purchasable feature to the VisibleShelf platform so it flows through the existing `EffectiveCapabilityResolver` as a third merge source — alongside org-tier and tenant-tier features — enabling à la carte feature sales outside of subscription tiers.

## Architecture Overview

The BSaaS system has **5 layers**, all of which must be understood when adding a purchased feature:

```
1. Definition Layer (code)     → canonical-features.ts (feature must exist here first)
2. Database Layer (seeded)     → features_list + capability_features_list + tenant_feature_purchases
3. Resolver Layer (runtime)    → EffectiveCapabilityResolver.fetchRawCapabilities() (auto-merges purchases)
4. Admin API Layer (CRUD)      → admin/feature-purchases.ts (grant, update, revoke)
5. Frontend Layer (merchant)   → UnifiedCapabilityService (unchanged — reads unified endpoint)
```

**Key insight**: The resolver, per-domain resolvers, and frontend are **source-agnostic**. They only ask "is this feature in the allowed list?" — not "how did it get there?" The purchase mechanism simply adds feature keys to the same `mergedFeatures` map that tier features populate. No downstream changes are needed for most features.

## The Three Feature Sources

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  tier_features   │  │  tier_features   │  │ tenant_feature_      │
│  _list (org)     │  │  _list (tenant)  │  │ purchases (BSaaS)    │
│                  │  │                  │  │                      │
│  Tier gate       │  │  Tier gate       │  │  Purchased service   │
│  (bundled)       │  │  (bundled)       │  │  (à la carte)        │
└────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘
         │                     │                       │
         └──────────┬──────────┘                       │
                    │  most-permissive-wins            │
                    │  (already exists)                │
                    ▼                                  │
         ┌──────────────────────┐                     │
         │  mergedFeatures Map  │◄────────────────────┘
         │  (OR merge)          │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Per-domain resolvers│
         │  (unchanged)         │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  EffectiveCapabilities│
         │  (single source of   │
         │   truth — unchanged) │
         └──────────────────────┘
```

## Step-by-Step: Adding a Purchasable Feature

### 1. Definition Layer

**File**: `packages/feature-definitions/src/definitions/canonical-features.ts`

The feature must already exist in `CANONICAL_FEATURES`. If it's a new feature, add it there first:

```ts
'my_purchasable_feature': {
  key: 'my_purchasable_feature',
  name: 'My Purchasable Feature',
  description: 'What this feature does',
  category: 'product' | 'commerce' | 'analytics' | 'branding' | 'integration' | 'ui',
  metadata: { ... }
},
```

**File**: `packages/feature-definitions/src/definitions/tier-hierarchies.ts`

Add the feature to the appropriate tier(s). Purchasable features are typically available in higher tiers (bundled) and sold à la carte to lower tiers. Add to `PROFESSIONAL_FEATURES` or above — lower tiers will purchase via `tenant_feature_purchases`.

### 2. Database Layer

**Seed the feature** (if not already in the database):

1. **`features_list`** — Create the feature entry with the key
2. **`capability_features_list`** — Link the feature to its capability type (e.g., `chatbot_options`, `crm_options`)
3. **`tier_features_list`** — Enable the feature for tiers where it's bundled

**Create the purchase table entry** (runtime, via admin API):

```sql
INSERT INTO tenant_feature_purchases (tenant_id, feature_key, source, status, expires_at)
VALUES ('tenant-uuid', 'my_purchasable_feature', 'bsaas', 'active', NULL);
```

The `tenant_feature_purchases` table schema:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Auto-generated |
| `tenant_id` | VARCHAR(255) FK | References `tenants.id` ON DELETE CASCADE |
| `feature_key` | TEXT | Must match a key in `features_list` |
| `source` | VARCHAR(50) | `bsaas`, `promo`, `addon`, `comp`, `tier_overage` |
| `status` | VARCHAR(20) | `active`, `suspended`, `expired`, `cancelled` |
| `purchased_at` | TIMESTAMPTZ | When the purchase was made |
| `expires_at` | TIMESTAMPTZ | NULL = never expires |
| `metadata` | JSONB | Arbitrary metadata (e.g., price, billing ID) |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

**Unique constraint**: `(tenant_id, feature_key)` — one active purchase per feature per tenant.

**Check constraints**: `status IN ('active', 'suspended', 'expired', 'cancelled')` and `source IN ('bsaas', 'promo', 'addon', 'comp', 'tier_overage')`.

**Migration file**: `database/migrations/043_tenant_feature_purchases.sql`

### 3. Resolver Layer (Automatic — No Changes Needed)

**File**: `apps/api/src/services/EffectiveCapabilityResolver.ts`

The `fetchRawCapabilities()` function already handles purchased features. After merging org-tier and tenant-tier features, it queries `tenant_feature_purchases` and merges active, non-expired purchases into the same `mergedFeatures` map:

```ts
// 1. Merge tier features (org-tier + tenant-tier) — most-permissive-wins
// 2. Merge purchased features — active purchases override tier gates
const purchases = await prisma.tenant_feature_purchases.findMany({
  where: {
    tenant_id: tenantId,
    status: 'active',
    OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
  },
  select: { feature_key: true },
});

// For each purchase:
// - If feature already in mergedFeatures: set is_enabled = true
// - If feature not in mergedFeatures: resolve its capability_type from
//   features_list + capability_features_list, then add it
```

**What this means for new features**: If the feature key already exists in `features_list` and is linked to a `capability_type_list` entry via `capability_features_list`, the resolver will automatically:
- Add it to the correct capability domain in the `capabilities` map
- Set it to `true` in the features record
- Pass it through to the per-domain resolver
- Include it in the `EffectiveCapabilities` output

**No resolver changes are needed** unless the feature introduces a new sub-category or allowed array (see "When Resolver Changes ARE Needed" below).

### 4. Admin API Layer

**File**: `apps/api/src/routes/admin/feature-purchases.ts`

The admin CRUD API is already implemented and mounted at `/api/admin/feature-purchases`. It provides:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/feature-purchases` | GET | List all purchases (filter by `tenantId`, `featureKey`, `status`, `source`) |
| `/api/admin/feature-purchases` | POST | Grant a feature to a tenant (upsert — updates if already exists) |
| `/api/admin/feature-purchases/:id` | PUT | Update status (activate/suspend/cancel) or expiry |
| `/api/admin/feature-purchases/:id` | DELETE | Revoke a purchase |

**Granting a feature** (POST):
```json
{
  "tenant_id": "tenant-uuid",
  "feature_key": "chatbot_skill_crm_assistant",
  "source": "bsaas",
  "expires_at": "2026-12-31T23:59:59Z",
  "metadata": { "price_cents": 1900, "billing_cycle": "monthly" }
}
```

**Critical**: Every purchase change calls `invalidateEffectiveCapabilities(tenantId)` to bust the cache, ensuring the unified endpoint serves fresh data on the next request.

**Audit logging**: All purchase changes are logged via the `audit()` function with `entity_type: 'feature_purchase'`.

### 5. Frontend Layer (No Changes for Most Features)

**File**: `apps/web/src/services/UnifiedCapabilityService.ts`

The frontend reads the unified endpoint (`GET /api/tenants/:tenantId/effective-capabilities`). Since purchased features are merged into the same capabilities output, the frontend mapper picks them up automatically.

**No changes needed** when:
- The feature key already has a corresponding field in the `Effective{Domain}` interface
- The per-domain resolver already maps this feature to an `allowed_*` array or boolean
- The frontend settings page already has a UI toggle for this feature

**Changes needed** when:
- The feature is entirely new (not just a new purchase of an existing feature key) — follow the full `capability-system-integration.md` guide first
- The feature introduces a new UI element that should show a "Purchased" badge instead of "Included in plan"

## When Resolver Changes ARE Needed

The automatic merge handles most cases. You need resolver changes only when:

### Case 1: New Sub-Category or Allowed Array

If the purchased feature introduces a new skill type, response engine, or other sub-category that has its own `allowed_*` array, you must add it to the resolver's mapping logic.

**Example**: Adding `chatbot_skill_crm_assistant` as a new bot skill type:

1. Add `'chatbot_skill_crm_assistant'` to `ChatbotSkillType` in `resolvers/types.ts`
2. In `ChatbotOptionsResolver.ts`, add it to the `allowed_skill_types` array when the feature is enabled:
   ```ts
   if (feat.chatbot_skill_crm_assistant) allowedSkillTypes.push('chatbot_skill_crm_assistant');
   ```
3. Mirror in frontend types and mappers

### Case 2: New Capability Domain

If the purchased feature belongs to a capability type that doesn't have a resolver yet, follow the full `capability-system-integration.md` guide to create the resolver, types, route, and frontend mapper.

### Case 3: Purchase-Only Display Logic

If you need the frontend to distinguish "purchased" from "tier-included" features (e.g., showing a "Purchased" badge), you would need to:
1. Add a `purchased_feature_keys: string[]` field to the `EffectiveCapabilities` output
2. Populate it in `fetchRawCapabilities()` from the purchases query
3. Map it in `UnifiedCapabilityService.ts`
4. Use it in `CapabilityShowcase.tsx` to show the badge

This is **not yet implemented** — currently, purchased features are indistinguishable from tier-included features in the unified output. This is by design: the source-agnostic principle means the system doesn't care how a feature was enabled.

## Cache Invalidation

The `EffectiveCapabilityResolver` caches `EffectiveCapabilities` per tenant. When a purchase is created, updated, or revoked, the admin route calls:

```ts
import { invalidateEffectiveCapabilities } from '../../services/EffectiveCapabilityResolver';

invalidateEffectiveCapabilities(tenant_id);
```

This busts the cache for that tenant, ensuring the next request to the unified endpoint re-queries the database (including the purchases table).

**Important**: If you add purchase-granting logic outside the admin API (e.g., a checkout flow, a Stripe webhook), you **must** call `invalidateEffectiveCapabilities(tenantId)` after any purchase change.

## Expiry Handling

Purchases have two layers of expiry protection:

1. **Runtime check**: `fetchRawCapabilities()` filters purchases with `OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }]`. Expired purchases are simply not merged.
2. **Housekeeping function**: `expire_feature_purchases()` SQL function marks `status = 'expired'` for purchases past their `expires_at`. A scheduled job should call this periodically to keep the table clean.

You do not need to handle expiry in resolvers or frontend — expired purchases disappear from the capabilities output automatically.

## Existing Purchasable Feature Keys

Any key in `features_list` can be purchased. The following are planned BSaaS offerings:

| Feature Key | Capability Domain | Bundled Tier | BSaaS Target |
|-------------|-------------------|--------------|--------------|
| `chatbot_external_embed` | chatbot_options | Professional+ | All lower tiers |
| `chatbot_skill_crm_assistant` | chatbot_options | Professional+ | All lower tiers |
| `chatbot_skill_order_tracking` | chatbot_options | Storefront+ | Discovery tier |
| `chatbot_skill_cross_merchant` | chatbot_options | Enterprise | All lower tiers |
| `crm_enabled` | crm_options | Professional+ | All lower tiers |

## Testing Checklist

When adding a new purchasable feature, verify:

- [ ] Feature key exists in `features_list` and `canonical-features.ts`
- [ ] Feature is linked to a `capability_type_list` entry via `capability_features_list`
- [ ] Feature is enabled in `tier_features_list` for at least one tier (where bundled)
- [ ] Granting the feature via `POST /api/admin/feature-purchases` succeeds
- [ ] `GET /api/tenants/:tenantId/effective-capabilities` returns the feature as enabled for a tenant that purchased it but doesn't have it in their tier
- [ ] Revoking the purchase via `DELETE /api/admin/feature-purchases/:id` removes the feature from the capabilities output
- [ ] Cache invalidation works — changes are visible immediately without restart
- [ ] Expired purchases (`expires_at < NOW()`) are not included in the capabilities output
- [ ] `npx tsc --noEmit --project apps/api` passes
- [ ] `npx tsc --noEmit --project apps/web` passes

## Worked Example: Granting `chatbot_skill_order_tracking` to a Discovery Tenant

1. **Verify feature exists**:
   ```sql
   SELECT * FROM features_list WHERE key = 'chatbot_skill_order_tracking';
   ```

2. **Grant via admin API**:
   ```bash
   curl -X POST /api/admin/feature-purchases \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "discovery-tenant-uuid",
       "feature_key": "chatbot_skill_order_tracking",
       "source": "bsaas",
       "expires_at": null
     }'
   ```

3. **Verify capabilities**:
   ```bash
   curl /api/tenants/discovery-tenant-uuid/effective-capabilities
   # → caps.effective.chatbot.allowed_skill_types now includes 'chatbot_skill_order_tracking'
   ```

4. **Bot skill service**:
   ```ts
   const caps = await resolveEffectiveCapabilities(tenantId);
   const skillAvailable = caps.effective.chatbot.allowed_skill_types.includes('chatbot_skill_order_tracking');
   // → true (even though tenant is Discovery tier, which doesn't include this skill)
   ```

5. **Revoke**:
   ```bash
   curl -X DELETE /api/admin/feature-purchases/<purchase-id>
   # → Feature immediately removed from capabilities output
   ```

## File Reference

| File | Purpose |
|------|---------|
| `database/migrations/043_tenant_feature_purchases.sql` | Table creation + FK + indexes + expiry function |
| `apps/api/prisma/schema.prisma` | `tenant_feature_purchases` Prisma model |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | `fetchRawCapabilities()` — merges purchases into features map |
| `apps/api/src/routes/admin/feature-purchases.ts` | Admin CRUD API (grant, update, revoke) |
| `apps/api/src/routes/mounts/admin-routes.ts` | Mounts admin routes at `/api/admin/feature-purchases` |
| `docs/BSAAS_PHASED_PLAN.md` | Full phased plan for BSaaS + bot portability |
| `.devin/skills/capability-system-integration.md` | Companion guide for tier-gated capability integration |

## Related Documents

- **`capability-system-integration.md`** — Read this first if the feature is new to the platform. BSaaS only adds a purchase mechanism for existing feature keys; the feature must flow through all 5 layers of the capability system first.
- **`docs/CHATBOT_SKILL_EXTENSION_GUIDE.md`** — Guide for adding new bot skills, which can then be made purchasable via BSaaS.
- **`docs/BSAAS_PHASED_PLAN.md`** — The full phased plan covering purchased features, external embed licensing, WordPress plugin, and CRM assistant skill.
