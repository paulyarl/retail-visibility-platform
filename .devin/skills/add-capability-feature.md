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

## Post-Insert Checklist

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
   INSERT INTO tier_features_list (tier_id, feature_key, capability_type_id, is_enabled)
   VALUES (
     (SELECT id FROM subscription_tiers_list WHERE tier_key = 'discovery'),
     'product_opt_recently_viewed',
     (SELECT id FROM capability_type_list WHERE key = 'product_options'),
     true
   );
   ```

3. **Update the backend `*OptionsService`** to resolve the new feature key into a state flag.

4. **Update the frontend `CapabilityResolutionService`** to expose the new flag to React components.

5. **Add a toggle** on the merchant settings page if this feature should be merchant-configurable.

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

## Common Pitfalls

- **Do not assume `category` is required** — the schema allows `NULL` and the Admin UI does not send it.
- **Do not forget tier_features_list** — a feature in `features_list` alone is invisible to tenants until a tier row enables it.
- **Do not forget the frontend resolver** — the feature may be enabled in the DB but still unavailable to React if `CapabilityResolutionService` doesn't map the key.
