---
description: Link existing feature keys to a capability type (Admin UI equivalent)
---

# Link Features to a Capability Type

Use this skill when you need to associate a set of `features_list` keys with a `capability_type_list` record, either via the Admin UI or via SQL.

## What the Admin UI Does

When you click **Update** on the "Edit Capability Type" modal, the frontend sends:

```json
PUT /api/admin/capability-types
{
  "capability_type_key": "product_options",
  "capability_type_name": "Product Options",
  "description": "",
  "category": "product_options",
  "is_active": true,
  "sort_order": 0,
  "allowed_features": [
    "product_digital",
    "product_physical",
    "product_opt_recently_viewed",
    ...
  ]
}
```

The backend (`apps/api/src/routes/admin/capability-types.ts`) executes this transaction:

1. **Upsert** `capability_type_list` (key, name, description, category, is_active, sort_order).
2. **Resolve** each `allowed_features` key to a `features_list.id`.
3. **Delete** all existing rows in `capability_features_list` for this `capability_type_id`.
4. **Insert** fresh rows into `capability_features_list` with `sort_order = index + 1`.
5. **Return** the updated capability type with its joined features.

## Tables Involved

| Table | Role |
|---|---|
| `capability_type_list` | The capability definition (e.g. `product_options`) |
| `features_list` | The master feature registry (e.g. `product_opt_recently_viewed`) |
| `capability_features_list` | **Junction table** linking a capability type to its allowed features |

```sql
-- Junction table schema
capability_features_list
  id                 UUID PRIMARY KEY
  capability_type_id UUID  → capability_type_list.id
  feature_id         UUID  → features_list.id
  restrictions       JSONB
  is_active          BOOLEAN DEFAULT true
  sort_order         INTEGER
  created_at, updated_at TIMESTAMP
```

## SQL Equivalent (Plain SQL / DO Block)

Use `@/database/migrations/link_features_to_capability_type_plain.sql` as a template. The gist:

```sql
DO $$
DECLARE
  v_capability_type_key  TEXT  := 'product_options';
  v_capability_type_name TEXT  := 'Product Options';
  v_feature_keys         TEXT[] := ARRAY[
    'product_digital','product_physical','product_opt_recently_viewed',...
  ];
  v_capability_type_id UUID;
BEGIN
  -- 1. Upsert capability type
  INSERT INTO capability_type_list (key, name, category, is_active, sort_order, created_at, updated_at)
  VALUES (v_capability_type_key, v_capability_type_name, v_capability_type_key, true, 0, NOW(), NOW())
  ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
  RETURNING id INTO v_capability_type_id;

  IF v_capability_type_id IS NULL THEN
    SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = v_capability_type_key;
  END IF;

  -- 2. Wipe old links
  DELETE FROM capability_features_list WHERE capability_type_id = v_capability_type_id;

  -- 3. Re-link with sort_order
  FOR i IN 1 .. array_length(v_feature_keys, 1) LOOP
    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    SELECT v_capability_type_id, fl.id, true, i, NOW(), NOW()
    FROM features_list fl
    WHERE fl.key = v_feature_keys[i];
  END LOOP;
END $$;
```

## SQL Equivalent (psql CLI)

Use `@/database/migrations/link_features_to_capability_type.sql` if you run it via `psql`:

```bash
psql $DATABASE_URL -f database/migrations/link_features_to_capability_type.sql
```

It uses `\set` variables and `unnest(string_to_array(...))` to build the ordered links.

## Important Behaviours

- **Replace, not merge**: The backend deletes every existing `capability_features_list` row for the type before inserting the new set. If you omit a previously-linked feature key, it is removed.
- **Order matters**: `sort_order` is set from the array / list position. The Admin UI and Kanban display use this order.
- **Missing keys are skipped**: The plain-SQL version raises a `NOTICE` and continues; the backend returns `400 invalid_features` if any key is missing.

## Post-Link Checklist

Linking features to a capability type only makes them **available at the capability level**. For tenants to actually use them:

1. **Enable for tiers** in `tier_features_list`:
   ```sql
   INSERT INTO tier_features_list (tier_id, capability_type_id, feature_key, is_enabled)
   VALUES (
     (SELECT id FROM subscription_tiers_list WHERE tier_key = 'discovery'),
     (SELECT id FROM capability_type_list WHERE key = 'product_options'),
     'product_opt_recently_viewed',
     true
   );
   ```

2. **Update the backend service** (`ProductOptionsService`, `CrmOptionsService`, etc.) to resolve the new feature key.

3. **Update the frontend resolver** (`CapabilityResolutionService`) to expose the new flag.

4. **Add a merchant toggle** on the settings page if the feature should be configurable per-tenant.

## Verification Queries

```sql
-- Show all features linked to a capability type
SELECT
  ctl.key AS capability_type,
  fl.key  AS feature_key,
  fl.name AS feature_name,
  cfl.sort_order
FROM capability_features_list cfl
JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
JOIN features_list fl ON fl.id = cfl.feature_id
WHERE ctl.key = 'product_options'
ORDER BY cfl.sort_order;

-- Show which tiers have a specific feature enabled
SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
FROM tier_features_list tfl
JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
WHERE tfl.feature_key = 'product_opt_recently_viewed';
```

## Common Pitfalls

- **Forgetting `tier_features_list`**: The feature may be linked to the capability type but still disabled for every tier.
- **Stale sort_order**: If you re-order the array and re-run the script, the new `sort_order` values are applied immediately.
- **Case-sensitive keys**: `features_list.key` is case-sensitive. Always use the exact key stored in the database.
