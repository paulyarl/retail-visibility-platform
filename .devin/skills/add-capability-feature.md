---
description: How to add a new feature key to the centralized features_list table
---

# Add a New Capability Feature

Use this skill when adding a new feature flag to the platform's centralized feature system.

## Feature Data Model

The `features_list` table is the single source of truth for all platform features.

```sql
Table: features_list
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
  key           TEXT UNIQUE NOT NULL          -- machine identifier (snake_case)
  name          TEXT NOT NULL                  -- human-readable label
  description   TEXT                           -- what the feature does
  category      TEXT                           -- grouping bucket (nullable)
  is_active     BOOLEAN DEFAULT true
  sort_order    INTEGER DEFAULT 0
  marketing_name        TEXT
  marketing_description TEXT
  icon_name             TEXT
  created_at, updated_at  TIMESTAMP DEFAULT now()
  created_by, updated_by  TEXT
```

**Important**: `category` is optional. The Admin UI "Add Feature" modal does not send a category, so the backend stores `NULL`. Do not rely on a default category being injected.

## Method 1: Admin UI (Single Feature)

1. Navigate to `/settings/admin/capabilities`
2. Click **Add Feature**
3. Fill in:
   - **Feature Key**: e.g. `product_opt_recently_viewed`
   - **Feature Name**: e.g. `Recently Viewed Products`
   - **Description**: e.g. `Show recently browsed products on product pages`
4. Submit — category will be `NULL` (intentional)

## Method 2: SQL Migration (Bulk Insert)

For onboarding many features at once, create a migration in `database/migrations/`:

```sql
-- Example: insert product-option features
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('product_opt_recently_viewed',     'Recently Viewed Products',    'Show recently browsed products on product pages',       NULL, true, 0, NOW(), NOW()),
  ('product_opt_qr_codes',            'QR Code Sharing',             'Display scannable QR codes on product pages',           NULL, true, 0, NOW(), NOW()),
  ('product_opt_recommended',         'Recommended Products',        'Show "You might also like" recommendations',            NULL, true, 0, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at  = NOW();
```

## Method 3: Prisma Client (Code Path)

If inserting from a seed script or service:

```ts
await prisma.features_list.create({
  data: {
    key:         'product_opt_recently_viewed',
    name:        'Recently Viewed Products',
    description: 'Show recently browsed products on product pages',
    category:    null,        -- do NOT default to 'product_types'
    is_active:   true,
    sort_order:  0,
  },
});
```

## Naming Conventions

- **Prefix by domain**: `product_opt_`, `crm_`, `storefront_`, `integration_`, etc.
- **snake_case**: `product_opt_qr_codes`, not `productOptQrCodes`
- **Key = noun / state = boolean**: key name describes what the feature is; the consuming code resolves it to an `enabled` boolean.

## Post-Insert Checklist (Unified Resolver Architecture)

After adding to `features_list`, the feature is **not automatically available to any tier or merchant**. You must wire it up:

1. **Link to a capability type** (if applicable):
   ```sql
   INSERT INTO capability_features_list (capability_type_id, feature_id, restrictions)
   VALUES (
     (SELECT id FROM capability_type_list WHERE key = 'product_options'),
     (SELECT id FROM features_list WHERE key = 'product_opt_recently_viewed'),
     '{"base_max_items": 100}'
   );
   ```

2. **Enable for tiers** via `tier_features_list`:
   ```sql
   INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled)
   VALUES (
     gen_random_uuid()::text,
     (SELECT id FROM subscription_tiers_list WHERE key = 'discovery'),
     'product_opt_recently_viewed',
     'Recently Viewed',
     (SELECT id FROM capability_type_list WHERE key = 'product_options'),
     true
   );
   ```

3. **Add a merchant gate storage table column** if the feature is tenant-configurable:

   Each capability domain has a dedicated `tenant_*_options_settings` table for merchant preferences. Use the correct table for your domain:

   | Capability Type Key | Merchant Gate Table | Prisma Model |
   |---|---|---|
   | `commerce_types` | `tenant_commerce_settings` | `tenant_commerce_settings` |
   | `payment_gateway_options` | `tenant_payment_gateway_settings` | `tenant_payment_gateway_settings` |
   | `storefront_types` | `tenant_storefront_type_settings` | `tenant_storefront_type_settings` |
   | `fulfillment_options` | `tenant_fulfillment_settings` | `tenant_fulfillment_settings` |
   | `barcode_scan_options` | `tenant_barcode_scan_settings` | `tenant_barcode_scan_settings` |
   | `product_options` | `tenant_product_options_settings` | `tenant_product_options_settings` |
   | `featured_options` | `tenant_featured_options_settings` | `tenant_featured_options_settings` |
   | `integration_options` | `tenant_integration_settings` | `tenant_integration_settings` |
   | `quickstart_options` | `tenant_quickstart_options_settings` | `tenant_quickstart_options_settings` |
   | `storefront_options` | `tenant_storefront_options_settings` | `tenant_storefront_options_settings` |
   | `directory_entry` | `tenant_storefront_options_settings` (page_type = 'directory_entry') | `tenant_storefront_options_settings` |
   | `faq_options` | `tenant_faq_options_settings` | `tenant_faq_options_settings` |
   | `crm_options` | `tenant_crm_options_settings` | `tenant_crm_options_settings` |
   | `chatbot_options` | `tenant_chatbot_options_settings` | `tenant_chatbot_options_settings` |

   ```sql
   ALTER TABLE tenant_product_options_settings
     ADD COLUMN IF NOT EXISTS product_opt_<feature> boolean DEFAULT true;
   ```
   Then update the Prisma schema to match:
   ```prisma
   product_opt_<feature> Boolean? @default(true)
   ```
   Run `pnpm prisma db pull && pnpm prisma generate` in `apps/api/` to sync the Prisma client after schema changes.

4. **Update the backend resolver** in `apps/api/src/services/resolvers/{Domain}Resolver.ts`:
   - Map the new feature key to an `allowed_*` array or boolean in the resolver output.
   - If merchant-configurable, read the new column from `merchantBundle.{domain}` and apply it to compute `effective_*` values.
   - **Choice-based config (layouts, types, modes):** compute an `effective_*` single value from `allowed_*` ∩ `merchant_prefs.*` with fallback. Do not expose raw merchant preference as the resolved value.
   - **Non-boolean config (fees, timings, limits):** selectively add the needed scalar fields to the resolver output. Do not dump the entire raw merchant settings blob.
   - **Adding a new enum value to an existing type union** (e.g. adding `'social'` to `StorefrontTypeValue`): also update the Zod validation schema in the route file at `apps/api/src/routes/{domain}-settings.ts`. The `z.enum([...])` must include every value in the type union — TypeScript will not catch a mismatch because Zod enums are runtime constructs. A missing value will cause the PUT endpoint to 400-reject the new value before it reaches the tier gate.

5. **Wire into the orchestrator** in `apps/api/src/services/EffectiveCapabilityResolver.ts`:
   - Ensure `fetchMerchantSettings()` fetches the correct settings table (already covered if you used an existing table).
   - Add the new resolver to the `Promise.all` dispatch block if it is a new domain.
   - Include the resolved state in the final `EffectiveCapabilities` return object.

6. **Add cache invalidation** in the settings PUT handler for the domain:
   ```ts
   import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
   // after successful prisma update:
   invalidateEffectiveCapabilities(tenantId);
   ```

7. **Update the frontend mapper** in `apps/web/src/services/UnifiedCapabilityService.ts`:
   - Add the new field to the `BackendEffective{Domain}` interface.
   - Map it in the `map{Domain}` function.
   - If a new domain entirely, add it to `AllCapabilitiesState` in `CapabilityResolutionService.ts` (types only) and `mapAll` in `UnifiedCapabilityService.ts`.

8. **Add a toggle** on the merchant settings page if this feature should be merchant-configurable.

9. **Update the PlanSummaryPanel** in `apps/web/src/components/settings/PlanSummaryPanel.tsx`:
   - Add the capability type key to the `CAPABILITY_DISPLAY` map with a label, icon, and `settingsPath`.
   - Add a summary block in `resolveCapabilitySummaries()` that reads from the mapped state (e.g. `caps.chatbotOptions`) and pushes feature labels + statuses.
   - If the capability is entirely new, also add it to `AllCapabilitiesState` in `CapabilityResolutionService.ts` and `mapAll` in `UnifiedCapabilityService.ts` (covered in step 7).

10. **Update the CapabilityShowcase** in `apps/web/src/components/dashboard/CapabilityShowcase.tsx`:
    - Add a row to the `rows` array in the `useMemo` block for the new capability.
    - Extract the state from `cap.<domain>Options` and compute `tier` / `merchantGated` status.
    - Provide a `label`, `icon` (from lucide-react), `detail` string (list active sub-features or "Not available"), and `settingsLink` (e.g. `/t/${tenantId}/bot/options`).
    - This is the "Your Capabilities" card on the tenant dashboard — a capability missing from this array will not appear on the dashboard even if it works functionally.

## Verification Queries

```sql
-- Verify the feature exists
SELECT key, name, description, category, is_active
FROM features_list
WHERE key = '<feature_key>';

-- Verify tier assignment
SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
FROM tier_features_list tfl
JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
WHERE tfl.feature_key = '<feature_key>';

-- Verify capability_type linkage
SELECT ctl.key AS capability_type, fl.key AS feature
FROM capability_features_list cfl
JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
JOIN features_list fl ON fl.id = cfl.feature_id
WHERE fl.key = '<feature_key>';
```

## Verification (Unified Endpoint)

After completing the checklist, confirm the resolved state is available from the single source of truth:

```bash
# Public endpoint (no auth)
curl -s "http://localhost:3001/api/tenants/<tenantId>/effective-capabilities" \
  | jq '.data.effective.<domain>.<new_field>'

# Example: verify a new product option
curl -s "http://localhost:3001/api/tenants/tid-xxx/effective-capabilities" \
  | jq '.data.effective.product_options.recently_viewed_enabled'

# Full detail (includes merchant preferences)
curl -s "http://localhost:3001/api/tenants/<tenantId>/effective-capabilities?detail=full" \
  | jq '.data.gates.tier_hard.<domain>'
```

Also run type checks:
```bash
pnpm checkapi   # backend types
pnpm checkweb   # frontend types
```

## Unified Architecture Notes

### The `effective_*` Single-Value Pattern
For choice-based features (layouts, storefront types, payment modes), the backend resolver must compute a single resolved value, not just expose `allowed_*` and raw merchant preference separately:

- `allowed_layouts: ['classic', 'immersive']` (tier hard gate)
- `merchant_prefs.storefront_layout: 'immersive'` (merchant choice)
- **Output:** `effective_layout: 'immersive'` (computed by resolver)

The frontend `UnifiedCapabilityService` maps `effective_layout` directly into `StorefrontOptionsState.effectiveLayout`. No client-side logic.

### Avoid Raw Settings Dumps
Do not return the entire raw `merchant_preferences` blob in the effective state. It bloats the payload and leaks internal schema. Expose only the scalar values the frontend actually needs (e.g. `delivery_fee_cents`, `pickup_ready_time_minutes`). Boolean toggles are readable from `merchantPreferences` on the effective state object.

### Feature-Map Guards Are Obsolete
After unification, `features` on every state object is always `{}` (legacy compatibility). Do not guard UI rendering with `Object.keys(X.features).length > 0`. Use `X.enabled` instead.

## Common Pitfalls

- **Do not assume `category` is required** — the schema allows `NULL` and the Admin UI does not send it.
- **Do not forget tier_features_list** — a feature in `features_list` alone is invisible to tenants until a tier row enables it.
- **Do not forget the backend resolver** — the feature may be enabled in the DB but still unavailable to the frontend if the domain resolver in `apps/api/src/services/resolvers/` doesn't map the key into `allowed_*` / `effective_*`.
- **Do not forget cache invalidation** — after adding a merchant gate column and its settings PUT handler, ensure the handler calls `invalidateEffectiveCapabilities(tenantId)` or the unified endpoint will serve stale data for up to 60 seconds.
- **Do not duplicate resolution logic in the frontend** — `CapabilityResolutionService.ts` is obsolete. All resolution belongs in the backend resolver. The frontend `UnifiedCapabilityService` only maps.
- **Do not forget the Zod validation schema** — when adding a new enum value to a capability's type union (e.g. `'social'` in `StorefrontTypeValue`), the `z.enum([...])` in the route file must be updated to include it. TypeScript will not catch this because Zod enums are runtime constructs. A missing value causes the PUT endpoint to 400-reject the new value before it reaches the tier gate, even though the resolver, service, and frontend all accept it.
- **Do not forget the PlanSummaryPanel** — a capability missing from `CAPABILITY_DISPLAY` and `resolveCapabilitySummaries()` in `PlanSummaryPanel.tsx` will not appear in the tenant's plan summary card, even though it works functionally.
- **Do not forget the CapabilityShowcase** — a capability missing from the `rows` array in `CapabilityShowcase.tsx` will not appear in the "Your Capabilities" card on the tenant dashboard, even though it works functionally.
