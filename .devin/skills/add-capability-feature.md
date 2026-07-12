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
- **`_disabled` meta-key**: Every capability type MUST have a `{prefix}_disabled` feature key in `features_list`, linked via `capability_features_list`. This allows explicit disengagement of a capability from a tier. See R17 in `capability-data-flow-rules.md` for the full precedence rules.
- **Default disabled when nothing is enabled**: When neither `_enabled` nor `_disabled` is set AND no individual feature in the domain is enabled, the resolver returns `enabled = false`. However, if any individual feature is enabled, the capability is implicitly enabled. See R17 in `capability-data-flow-rules.md`.

## Step 0: Seed Feature Keys into the Database (Mandatory — Do Not Skip)

**Before writing any resolver logic, frontend mapper code, or type definitions, you MUST create a SQL migration to seed the new feature keys into `features_list` and link them to their capability type in `capability_features_list`.**

This is the most commonly missed step. Without it, the feature keys exist only in code — the Admin UI cannot see them, admins cannot assign them to tiers, and the capability type shows no features for the new group.

### What to seed

For every feature key referenced in a resolver (`!!features.<key>`), insert a row into `features_list`:

```sql
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('<capability_key>_<group>',              '<Group Name>',         'Group gate description',     '<capability_type>', true, <n>, NOW(), NOW()),
  ('<capability_key>_<group>_on',           '<Group> (On)',         'Group ON gate',              '<capability_type>', true, <n>, NOW(), NOW()),
  ('<capability_key>_<group>_off',          '<Group> (Off)',        'Group OFF gate',             '<capability_type>', true, <n>, NOW(), NOW()),
  ('<capability_key>_<group>_<feature>',    '<Feature Name>',       'Individual feature',         '<capability_type>', true, <n>, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW();
```

Then link them to the capability type:

```sql
DO $$
DECLARE
  v_cap_id TEXT;
  v_key    TEXT;
  v_feat_id TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = '<capability_type>';
  IF v_cap_id IS NULL THEN RAISE NOTICE 'Capability type not found'; RETURN; END IF;
  FOREACH v_key IN ARRAY ARRAY['<key1>', '<key2>', ...] LOOP
    SELECT id INTO v_feat_id FROM features_list WHERE key = v_key;
    IF v_feat_id IS NOT NULL THEN
      INSERT INTO capability_features_list (capability_type_id, feature_id)
      VALUES (v_cap_id, v_feat_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
```

### Where to put the migration

Create a numbered SQL file in `database/migrations/` (e.g., `102_storefront_opt_qr_styled_features.sql`). Follow the idempotent pattern with `ON CONFLICT (key) DO UPDATE`.

### Verification

After running the migration, verify in the Admin UI at `/settings/admin/capabilities`:
- The new feature keys appear in the feature list
- The capability type shows the new features in its feature list
- The features are available for tier assignment in the tier management UI

**If you skip this step, the resolver will silently return `false` for all new features because the keys are not in any tier's `tier_features_list` — and admins have no way to add them because they don't appear in the UI.**

## Post-Insert Checklist (Unified Resolver Architecture)

After seeding feature keys into `features_list`, the feature is **not automatically available to any tier or merchant**. You must wire it up:

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
   - **MUST prefix every individual feature check with `flexible ||`** (R23 in `capability-data-flow-rules.md`). When a tier has `*_flexible` enabled, ALL features in the capability are unlocked — the resolver must honor this for every flag, including standalone booleans that are not part of any `allowed_*_types` array. Example: `expiryMonitorEnabled: flexible || !!features.featured_expiry_monitor`. Forgetting the `flexible ||` prefix causes the feature to stay disabled on flexible tiers even though the admin intended full access.
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

7. **Add cross-capability constraint** (if the new capability depends on another capability's type or state):
   - Insert a row into the `capability_constraints_list` DB table (via SQL migration or admin API at `/api/admin/capability-constraints`)
   - Also add a static fallback entry in `CapabilityConstraintRegistry.ts`
   - If the constraint is `block` severity, add `await validateProposedChange()` to the PUT handler after the tier gate
   - See `capability-deployment-flow.md` Phase 4.5 and `capability-data-flow-rules.md` Rules R18-R22 for full details

8. **Update the frontend mapper** in `apps/web/src/services/UnifiedCapabilityService.ts`:
   - Add the new field to the `BackendEffective{Domain}` interface.
   - Map it in the `map{Domain}` function.
   - **For existing domains**: add the new field to the domain's `*State` interface in `apps/web/src/services/CapabilityResolutionService.ts` (e.g. `ProductOptionsState`). The hooks use these state types, so a missing field won't be accessible via `useProductOptionsCapability` / similar hooks even if the backend returns it.
   - If a new domain entirely, also add it to `AllCapabilitiesState` in `CapabilityResolutionService.ts` (types only) and `mapAll` in `UnifiedCapabilityService.ts`.

9. **Add a toggle** on the merchant settings page if this feature should be merchant-configurable.
   - Add the field to the settings `interface`, initial `useState` defaults, and the `loadSettings` response mapping in the settings client component (e.g. `ProductOptionsSettingsClient.tsx`).
   - Destructure the tier-gate boolean from the capability hook data (e.g. `showsSupplierCatalog = productOptionsCap.data?.showsSupplierCatalog ?? true`).
   - Render a toggle row in the appropriate group card, following the same pattern as existing features (tier-gated `Switch` with "Not included in your plan" label when disabled).

10. **Update the PlanSummaryPanel** in `apps/web/src/components/settings/PlanSummaryPanel.tsx`:
   - Add the capability type key to the `CAPABILITY_DISPLAY` map with a label, icon, and `settingsPath`.
   - Add a summary block in `resolveCapabilitySummaries()` that reads from the mapped state (e.g. `caps.chatbotOptions`) and pushes feature labels + statuses.
   - If the capability is entirely new, also add it to `AllCapabilitiesState` in `CapabilityResolutionService.ts` and `mapAll` in `UnifiedCapabilityService.ts` (covered in step 8).

11. **Update the CapabilityShowcase** in `apps/web/src/components/dashboard/CapabilityShowcase.tsx`:
    - Add a row to the `rows` array in the `useMemo` block for the new capability.
    - Extract the state from `cap.<domain>Options` and compute `tier` / `merchantGated` status.
    - Provide a `label`, `icon` (from lucide-react), `detail` string (list active sub-features or "Not available"), and `settingsLink` (e.g. `/t/${tenantId}/bot/options`).
    - This is the "Your Capabilities" card on the tenant dashboard — a capability missing from this array will not appear on the dashboard even if it works functionally.

12. **Update the TierFeaturesClient** in `apps/web/src/app/t/[tenantId]/settings/tier-features/TierFeaturesClient.tsx`:
    - Add an entry to the `CAPABILITY_META` array with the capability type key, a human-readable label, and the flexible feature key(s) for that domain.
    - Add a corresponding entry in the `summarizeResolvedCapabilities` function that reads from the `AllCapabilitiesState` domain field and returns `{ key, label, enabled, flexible, detail }`.
    - The capability type key must match what `getCapabilityTypeForFeature()` returns for features in this domain (i.e. the key from `CAPABILITY_FEATURE_PREFIXES` in `CapabilityResolutionService.ts`).
    - The flexible key(s) must match the `*_flexible` feature key defined in the backend resolver.
    - A capability missing from `CAPABILITY_META` will not appear in the tier comparison table or the resolved capabilities section on the tier-features settings page.

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
# Public endpoint (no auth) — summary only
curl -s "http://localhost:3001/api/public/tenants/<tenantId>/effective-capabilities" \
  | jq '.data.effective.<domain>.<new_field>'

# Example: verify a new product option
curl -s "http://localhost:3001/api/public/tenants/tid-xxx/effective-capabilities" \
  | jq '.data.effective.product_options.recently_viewed_enabled'

# Full detail (includes merchant preferences) — requires auth headers
# This is the PRIVATE endpoint; detail=full is blocked on the public endpoint.
curl -s "http://localhost:3001/api/tenants/<tenantId>/effective-capabilities?detail=full" \
  -H 'x-auth0-id: <auth0Id>' -H 'x-auth0-email: <email>' \
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
- **Do not forget the merchant settings toggle** — a feature wired in the backend resolver, Zod schema, and `UnifiedCapabilityService` mapper will still be invisible to merchants if the settings client component (e.g. `ProductOptionsSettingsClient.tsx`) doesn't render a toggle for it. This is the most commonly skipped step — the backend and mapper work silently, but the merchant has no UI to control it.
- **Do not forget the `*State` type in `CapabilityResolutionService.ts`** — when adding a field to an existing domain, the `BackendEffective{Domain}` interface in `UnifiedCapabilityService.ts` and the `{Domain}State` interface in `CapabilityResolutionService.ts` must both be updated. The hook (e.g. `useProductOptionsCapability`) returns `CapabilityHookState<{Domain}State>`, so a field missing from the State type is inaccessible even if the mapper and backend are correct.
- **Do not forget the PlanSummaryPanel** — a capability missing from `CAPABILITY_DISPLAY` and `resolveCapabilitySummaries()` in `PlanSummaryPanel.tsx` will not appear in the tenant's plan summary card, even though it works functionally.
- **Do not forget the CapabilityShowcase** — a capability missing from the `rows` array in `CapabilityShowcase.tsx` will not appear in the "Your Capabilities" card on the tenant dashboard, even though it works functionally.
- **Do not forget CCL write-time validation** — if a `block` severity constraint references the new capability, the PUT handler MUST call `await validateProposedChange()` with a simulated effective state before persisting. Forgetting this allows invalid configurations to be saved. See R22 in `capability-data-flow-rules.md`.
- **Do not forget the `flexible ||` prefix on standalone feature flags** — when adding a new feature flag to a resolver, always prefix the check with `flexible ||` (R23). Standalone booleans outside the group array pattern (e.g., `featured_expiry_monitor`) are the most commonly missed. Without the prefix, the feature stays disabled on flexible tiers even though the admin granted full capability access via `*_flexible`.
- **Do not forget the TierFeaturesClient** — a capability missing from `CAPABILITY_META` and `summarizeResolvedCapabilities` in `TierFeaturesClient.tsx` will not appear in the tier comparison table or the "Your Resolved Capabilities" section on the `/t/[tenantId]/settings/tier-features` page, even though it works functionally. This is the page where tenants compare what they have vs what higher tiers offer.
- **Do not forget the `_disabled` meta-key** — when adding a new capability type, you MUST create a `{prefix}_disabled` feature key in `features_list` and link it via `capability_features_list`. Without it, admins cannot explicitly disengage the capability from a tier, and `checkCapabilityEngagement` cannot block purchases for disabled capabilities. See migration `086_capability_type_disabled_keys.sql` for the pattern.
- **Do not fail-open when nothing is enabled** — resolvers MUST default to `enabled = false` when no `_enabled`, no `_disabled`, no `_flexible`, AND no individual features are enabled in the domain. However, if any individual feature is enabled, the capability is implicitly enabled (R17 step 4). See R17 in `capability-data-flow-rules.md`.
- **Do not mount public capability routes under `/api/tenants/`** — public routes (readable by storefront/product pages without auth) MUST be at `/api/public/tenants/:tenantId/*`. A public route at `/api/tenants/...` will be blocked by router-level auth middleware from sibling routers (e.g., `tenant-users.ts` applies `router.use(authenticateToken)` which bleeds into all subsequent routes). See `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1, FR-2.
- **Do not write resolver logic before seeding feature keys into `features_list`** — The most common capability implementation miss is adding resolver code, frontend mappers, and type definitions without creating the SQL migration to insert the feature keys into `features_list` and link them via `capability_features_list`. The resolver silently returns `false` for all unseeded keys, and the Admin UI shows no new features for the capability type. Always create the migration FIRST (see Step 0 above), run it, verify in the Admin UI, then proceed with resolver and frontend work.
