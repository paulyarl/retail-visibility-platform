# Capability Constraint Relationships

## Purpose

Admins can define cross-capability constraint relationships via the admin UI at `/settings/admin/capabilities` → **Constraints** tab. These relationships are declarative rules that cause constraint violations when broken. They are **not pre-determined** — admins can create, edit, and delete them at runtime without code changes.

## How It Works

### Data Flow

1. Admin creates a constraint via the Constraints tab (or via SQL INSERT into `capability_constraints_list`)
2. `CapabilityConstraintService.ts` loads active constraints from DB (60s in-memory cache)
3. `CapabilityConstraintResolver.applyCrossCapabilityConstraints()` evaluates all constraints against the assembled effective capability manifest during resolution (Step 5.5)
4. Violations are surfaced to:
   - **Dashboard** — `ConstraintAlertBanner` (block=red, warn=amber) + `CapabilityShowcase` row-level warnings + `PlanSummaryPanel` constraint section
   - **Settings PUT handlers** — `validateProposedChange()` blocks writes that would introduce `block`-severity violations (returns 403 `constraint_violation`)
5. Static fallback: `CapabilityConstraintRegistry.ts` seeds 6 initial constraints. If DB is empty or unreachable, these are used instead.

### Constraint Structure

Each constraint has:

| Field | Description | Allowed Values |
|---|---|---|
| `constraint_id` | Unique identifier | Any string (e.g. `digital_excludes_shipping`) |
| `type` | Relationship type | `requires`, `recommends`, `excludes`, `implies` |
| `severity` | Enforcement level | `block` (403 on write), `warn` (dashboard warning), `info` (informational) |
| `source_capability` | The IF-side capability key | `storefront`, `product_types`, `fulfillment`, etc. |
| `source_field` | The IF-side field | `effective_type`, `effective_types`, `enabled`, etc. |
| `source_operator` | How to compare | `equals`, `includes`, `not_includes`, `is_true`, `is_false` |
| `source_value` | The value to compare | Any string (e.g. `digital`, `service`, `true`) |
| `target_capability` | The THEN-side capability key | Same as source |
| `target_field` | The THEN-side field | Same as source |
| `target_operator` | How to compare | Same as source |
| `target_value` | The expected value | Any string |
| `message` | Human-readable explanation | Shown on dashboard |
| `resolution_hint` | What the merchant should do | Shown on dashboard |
| `is_active` | Whether the constraint is enforced | `true` / `false` |
| `sort_order` | Display ordering | Integer |

### Relationship Types

- **`requires`** — The target condition MUST be satisfied when the source condition matches. Use with `block` severity to prevent invalid configurations.
- **`recommends`** — The target condition SHOULD be satisfied. Use with `warn` severity to surface recommendations without blocking.
- **`excludes`** — The target condition must NOT be satisfied when the source condition matches. Use with `warn` or `block` severity.
- **`implies`** — The source condition implies the target condition. Use with `info` severity for documentation purposes.

### Severity Levels

- **`block`** — Prevents the write. `validateProposedChange()` returns a 403 `constraint_violation` error. Dashboard shows a red `ShieldAlert` banner.
- **`warn`** — Allows the write but surfaces a warning. Dashboard shows an amber `AlertTriangle` on the affected capability row and in the alert banner.
- **`info`** — Informational only. No enforcement, no dashboard alert. Used for documentation.

## Real Examples

### Example 1: Service Storefront Requires Service Product Type (block)

**Rule:** If a merchant selects `service` as their storefront type, their tier must include `service` in the allowed product types.

```
constraint_id:     storefront_service_requires_product_service
type:              requires
severity:          block
source_capability: storefront
source_field:      effective_type
source_operator:   equals
source_value:      service
target_capability: product_types
target_field:      allowed_types
target_operator:   includes
target_value:      service
message:           Service storefront requires Service product type
resolution_hint:   Enable service product type in your tier or select a different storefront type
```

**What happens when violated:**
- A merchant on a tier without `service` product type tries to set their storefront to `service`
- The PUT handler in `storefront-type-settings.ts` calls `validateProposedChange()` with a simulated effective manifest
- The resolver detects the `block` violation and returns 403 `constraint_violation`
- The merchant sees the error message and resolution hint

### Example 2: Digital Products Exclude Shipping Fulfillment (warn)

**Rule:** If a merchant has `digital` in their effective product types, shipping fulfillment should be disabled.

```
constraint_id:     product_digital_excludes_fulfillment_shipping
type:              excludes
severity:          warn
source_capability: product_types
source_field:      effective_types
source_operator:   includes
source_value:      digital
target_capability: fulfillment
target_field:      shows_shipping
target_operator:   is_true
target_value:      true
message:           Digital products typically do not need shipping fulfillment
resolution_hint:   Consider disabling shipping fulfillment if you only sell digital products
```

**What happens when violated:**
- A merchant has `digital` product types and shipping fulfillment enabled
- The resolver detects the `warn` violation during effective capability resolution
- The dashboard shows an amber `AlertTriangle` on the fulfillment capability row
- `ConstraintAlertBanner` shows the warning with a "Resolve" link to fulfillment settings
- The write is NOT blocked — the merchant can proceed but is informed

### Example 3: Social Storefront Requires Social Commerce (block)

**Rule:** If a merchant selects `social` as their storefront type, the social commerce capability must be enabled.

```
constraint_id:     storefront_social_requires_social_commerce
type:              requires
severity:          block
source_capability: storefront
source_field:      effective_type
source_operator:   equals
source_value:      social
target_capability: social_commerce_options
target_field:      enabled
target_operator:   is_true
target_value:      true
message:           Social storefront requires Social Commerce to be enabled
resolution_hint:   Enable Social Commerce in your plan or select a different storefront type
```

## Creating a New Constraint via Admin UI

1. Navigate to `/settings/admin/capabilities`
2. Click the **Constraints** tab
3. Click **+ Add Constraint**
4. Fill in the form:
   - Enter a unique `constraint_id` (snake_case, descriptive)
   - Select `type` and `severity`
   - Define the **Source** (IF condition): capability key, field, operator, value
   - Define the **Target** (THEN condition): capability key, field, operator, value
   - Write a clear `message` and `resolution_hint`
   - Set `is_active` to true
5. Click **Create**
6. The constraint is enforced within 60 seconds (cache TTL) or immediately on cache invalidation

## Creating a New Constraint via SQL

```sql
INSERT INTO capability_constraints_list (
  constraint_id, type, severity,
  source_capability, source_field, source_operator, source_value,
  target_capability, target_field, target_operator, target_value,
  message, resolution_hint, is_active, sort_order
) VALUES (
  'my_new_constraint',
  'requires', 'block',
  'product_types', 'effective_types', 'includes', 'subscription',
  'commerce', 'enabled', 'is_true', 'true',
  'Subscription products require commerce to be enabled',
  'Enable commerce in your plan settings',
  true, 10
);
```

## Key Files

| File | Role |
|---|---|
| `apps/api/src/routes/admin/capability-constraints.ts` | Admin CRUD API (GET, POST, PUT, DELETE) |
| `apps/api/src/services/resolvers/CapabilityConstraintService.ts` | Loads constraints from DB with 60s cache, falls back to static registry |
| `apps/api/src/services/resolvers/CapabilityConstraintResolver.ts` | Evaluates constraints against effective capability manifest |
| `apps/api/src/services/resolvers/CapabilityConstraintRegistry.ts` | Static seed constraints (6 initial rules) |
| `apps/web/src/admin/components/CapabilityManagement.tsx` | Admin UI Constraints tab (CRUD form + list) |
| `apps/web/src/services/AdminCapabilityService.ts` | Frontend service proxying to admin constraint API |
| `apps/web/src/components/dashboard/ConstraintAlertBanner.tsx` | Dashboard banner for block/warn violations |
| `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | Per-capability-row constraint warning indicators |
| `database/migrations/058_capability_constraints.sql` | Migration creating `capability_constraints_list` table |

## Common Pitfalls

- **Wrong field name** — The `source_field` and `target_field` must match actual fields in the effective capability objects. Check `apps/api/src/services/resolvers/types.ts` for the correct field names (e.g. `effective_type` for storefront, `effective_types` for product_types).
- **Using `equals` on array fields** — Array fields like `effective_types` and `allowed_types` require `includes` or `not_includes`, not `equals`.
- **Setting `block` on `warn`-appropriate rules** — Over-blocking can prevent merchants from making legitimate configuration changes. Use `warn` for recommendations and `block` only for truly invalid configurations.
- **Forgetting to invalidate cache** — The admin UI and API both call `invalidateConstraintCache()` on writes, but if you insert via SQL directly, the 60s cache delay applies unless you restart the API or wait.
- **Creating circular constraints** — Two constraints that block each other (e.g. A requires B, B excludes A) will create an unresolvable configuration. Test new constraints against existing ones mentally before creating them.
