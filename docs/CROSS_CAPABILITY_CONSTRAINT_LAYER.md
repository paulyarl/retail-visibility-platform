# Cross-Capability Constraint Layer (CCL)

**Status**: Approved for implementation
**Date**: 2026-06-26
**Prerequisite**: `docs/CAPABILITY_TYPES_TARGET_ARCHITECTURE.md`, `.devin/skills/capability-data-flow-rules.md`

---

## 1. Problem Statement

The capability architecture has 17 independent resolvers that run in parallel via `Promise.all` in `EffectiveCapabilityResolver.ts`. Each resolver is a pure function `(features, merchantPrefs) => EffectiveXxx` — they operate in **complete isolation**. No resolver can see another resolver's output.

### The Gap

There is no mechanism to express **cross-capability type dependencies**. For example:

- A `service` storefront type requires a `service` product type to be functional
- A `social` storefront type requires `social_commerce_options` to be enabled
- A `digital` product type excludes `shipping` fulfillment

Currently, a merchant could select `storefront_type: service` while their tier doesn't include `product_type: service`, and the system would silently allow this broken configuration.

### Case Study

```
Product Type: service (from product_types capability)
Storefront Type: service (from storefront_types capability)

A service storefront type requires a service product type to be functional and operational.
```

Without CCL, these two capabilities have no awareness of each other. The merchant can select a service storefront without having service products enabled, leading to a non-functional configuration.

---

## 2. Architectural Design

### 2.1 Solution: Post-Resolution Constraint Pass

Add a **Cross-Capability Constraint Layer (CCL)** that runs as a post-resolution pass after all individual resolvers complete:

```
EffectiveCapabilityResolver.ts
  ├─ Step 5:   Promise.all([resolveCommerce, resolveProductType, resolveStorefrontType, ...])
  ├─ Step 5.5: applyCrossCapabilityConstraints(effective)  ← NEW
  ├─ Step 6:   Subscription context overrides
  └─ Step 7+:  Caching, response
```

The CCL does NOT replace or modify individual resolver logic. It runs on the assembled `effective` manifest, checks a constraint registry, and:

1. **Surfaces constraint violations** — structured data the frontend uses to show warnings/blocks
2. **Adjusts effective states** — marks constrained types as `constraint_blocked` so the frontend can prevent selection
3. **Provides resolution hints** — tells the merchant what they need to change

### 2.2 Constraint Types

| Type | Severity | Behavior |
|---|---|---|
| `requires` | `block` | Source type cannot be selected if target condition is not met. Effective type is marked `constraint_blocked`. |
| `requires` | `warn` | Source type works but with warnings. Shown as amber in UI. |
| `recommends` | `warn` | Source type works best with target. Shown as info/warning in UI. |
| `excludes` | `block` | Source and target types are mutually exclusive. Both are marked `constraint_blocked` if both are selected. |
| `implies` | `info` | Selecting source auto-suggests enabling target. No blocking, just a hint. |

### 2.3 Constraint Target Model

```ts
interface ConstraintTarget {
  capability: string;    // key in effective object: 'storefront', 'product_types', etc.
  field: string;         // field to check: 'effective_type', 'allowed_types', 'enabled', etc.
  operator: 'equals' | 'includes' | 'not_includes' | 'is_true' | 'is_false';
  value: string | boolean;
}
```

A constraint evaluates:
- **Source**: When this target matches, the constraint is active
- **Target**: This condition must be satisfied (for `requires`) or must NOT be satisfied (for `excludes`)

### 2.4 Constraint Violation Shape

```ts
interface ConstraintViolation {
  constraint_id: string;
  type: 'requires' | 'recommends' | 'excludes' | 'implies';
  severity: 'block' | 'warn' | 'info';
  source_capability: string;
  source_type: string;
  target_capability: string;
  target_type: string;
  message: string;
  resolution_hint: string;
}
```

### 2.5 Effective State Adjustment

When a `block` constraint is violated, the CCL adds a `constraint_status` field to the affected capability:

```ts
// Added to EffectiveStorefront, EffectiveProductType, etc.
interface ConstraintStatus {
  blocked_types: string[];      // types that cannot be selected due to constraints
  warning_types: string[];      // types that have warnings but are selectable
  active_violations: string[];  // constraint_ids currently affecting this capability
}
```

The frontend uses `blocked_types` to disable selection controls and show constraint messages.

---

## 3. Constraint Registry — Initial Constraints

### 3.1 Case Study: Service Storefront ↔ Service Product

```ts
{
  id: 'storefront_service_requires_product_service',
  type: 'requires',
  severity: 'block',
  source: { capability: 'storefront', field: 'effective_type', operator: 'equals', value: 'service' },
  target: { capability: 'product_types', field: 'allowed_types', operator: 'includes', value: 'service' },
  message: 'Service storefront requires Service product type',
  resolution_hint: 'Enable service product type in your tier or select a different storefront type',
}
```

### 3.2 Full Initial Registry

| ID | Type | Severity | Source | Target | Message |
|---|---|---|---|---|---|
| `storefront_service_requires_product_service` | requires | block | storefront.effective_type = service | product_types.allowed_types includes service | Service storefront requires Service product type |
| `storefront_social_requires_social_commerce` | requires | block | storefront.effective_type = social | social_commerce_options.enabled = true | Social storefront requires Social Commerce enabled |
| `storefront_retail_recommends_product_physical` | recommends | warn | storefront.effective_type = retail | product_types.allowed_types includes physical | Retail storefront works best with Physical products |
| `storefront_online_recommends_product_digital` | recommends | warn | storefront.effective_type = online | product_types.allowed_types includes digital | Online storefront works best with Digital products |
| `product_service_recommends_fulfillment_service` | recommends | warn | product_types.effective_type = service | fulfillment.shows_service = true | Service products work best with service fulfillment |
| `product_digital_excludes_fulfillment_shipping` | excludes | warn | product_types.effective_type = digital | fulfillment.shows_shipping = true | Digital products typically don't need shipping fulfillment |

### 3.3 Extensibility

The registry is code-based initially. Future phases can migrate to a database table (`capability_constraints_list`) for admin-configurable constraints. The resolver interface is the same either way — the registry is the single source of truth.

---

## 4. Data Flow

### 4.1 Read-Time Flow (GET /effective-capabilities)

```
1. EffectiveCapabilityResolver fetches tier features + merchant settings
2. 17 individual resolvers run in parallel → produce EffectiveXxx objects
3. CCL runs on the assembled effective manifest:
   a. For each constraint in registry:
      - Evaluate source target against effective state
      - If source matches, evaluate target target
      - If target condition not met → create ConstraintViolation
   b. Collect all violations
   c. For block violations: add blocked_types to affected capabilities
4. Response includes effective manifest + constraint_violations array
5. Frontend renders violations as warnings/blocks in settings UI
```

### 4.2 Write-Time Flow (PUT /xxx-settings)

```
1. Merchant saves settings (e.g., selects storefront_type: service)
2. API route handler:
   a. Fetches current effective capabilities
   b. Simulates the change (applies the new merchant pref to the effective state)
   c. Runs CCL on the simulated state
   d. If any block violations → 403 constraint_violation with violation details
   e. If only warn violations → 200 with warnings in response
   f. If no violations → 200 success
3. Frontend shows constraint errors or warnings
```

### 4.3 Frontend Display Flow

```
1. useCapabilityAccess hook fetches effective-capabilities
2. Constraint violations are available in the response
3. Settings pages:
   - Check blocked_types before rendering selection controls
   - Disable blocked type options with tooltip explaining why
   - Show warning badges for warning_types
4. Dashboard:
   - PlanSummaryPanel shows constraint warnings in capability summary
   - CapabilityShowcase shows constraint status per capability
```

---

## 5. Setup & Deployment Flow

### 5.1 Where CCL Fits in the 8-Phase Pipeline

```
Phase 1: Define          → No change (feature keys are per-capability)
Phase 2: Seed DB         → No change (tier features are per-capability)
Phase 3: Store Prefs     → No change (merchant prefs are per-capability)
Phase 4: Resolve         → Individual resolvers unchanged. CCL runs AFTER all resolvers.
Phase 5: Route           → PUT handlers add constraint validation before saving
Phase 6: Map             → Frontend mapper includes constraint fields
Phase 7: Display         → Settings pages use constraint_status to block/warn
Phase 8: Verify          → Verify constraint violations surface correctly
```

### 5.2 New Files

| File | Purpose |
|---|---|
| `apps/api/src/services/resolvers/CapabilityConstraintRegistry.ts` | Constraint definitions |
| `apps/api/src/services/resolvers/CapabilityConstraintResolver.ts` | Post-resolution pass logic |

### 5.3 Modified Files

| File | Change |
|---|---|
| `apps/api/src/services/resolvers/types.ts` | Add `ConstraintViolation`, `ConstraintStatus`, update `EffectiveCapabilities` |
| `apps/api/src/services/resolvers/index.ts` | Export `applyCrossCapabilityConstraints` |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Call CCL after resolver parallel phase |
| `apps/api/src/routes/tenant-capabilities.ts` | Include constraint fields in `buildExpiredCapabilitiesResponse` |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Map constraint fields to frontend state |
| `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | Expose constraint violations in hook |

### 5.4 No Database Changes Required

The CCL is a pure computation layer. Constraints are defined in code, evaluated at runtime, and surfaced in the API response. No new tables, columns, or migrations are needed for Phase 1.

Future phases may add a `capability_constraints_list` table for admin-configurable constraints, but the initial implementation is code-only.

---

## 6. Implementation Plan

### Phase 1: Core CCL (This PR)

1. Create `CapabilityConstraintRegistry.ts` with initial constraints
2. Create `CapabilityConstraintResolver.ts` — evaluates constraints against effective manifest
3. Update `types.ts` — add constraint types to `EffectiveCapabilities`
4. Wire into `EffectiveCapabilityResolver.ts` — run after resolver parallel phase
5. Update `buildExpiredCapabilitiesResponse` — include empty constraint arrays
6. Verify with `pnpm checkapi`

### Phase 2: Frontend Integration (Next)

1. Map constraint fields in `UnifiedCapabilityService.ts`
2. Expose in `useCapabilityAccess.ts` hook
3. Settings pages: disable blocked types, show warnings
4. Dashboard: show constraint status in capability summaries

### Phase 3: Write-Time Validation (Next)

1. Add constraint validation to PUT handlers in settings routes
2. Return 403 with constraint violation details when blocked
3. Return 200 with warnings when only warn-level constraints

### Phase 4: DB-Driven Constraints (Future)

1. Create `capability_constraints_list` table
2. Admin UI for managing constraints
3. Registry loads from DB with code fallback

---

## 7. Design Rules

### R18: Cross-Capability Constraints Are Post-Resolution

Cross-capability constraints MUST run as a post-resolution pass, never inside individual resolvers. Individual resolvers remain pure functions of `(features, merchantPrefs)`. The CCL operates on the assembled `effective` manifest.

**Rationale**: Keeping individual resolvers isolated preserves their testability, reusability, and parallel execution. The CCL is a separate concern — it's about relationships between capabilities, not about individual capability resolution.

### R19: Constraint Violations Are Surfaced, Not Silently Applied

When a `block` constraint is violated, the CCL MUST:
1. Add the violation to `constraint_violations` array in the response
2. Mark the affected type in the source capability's `constraint_status.blocked_types`
3. NOT silently change the `effective_type` or `enabled` field

**Rationale**: Silently changing effective states would be confusing — the merchant selected a type, and the system should explain why it won't work rather than silently reverting it. The frontend uses `blocked_types` to prevent the selection in the UI.

### R20: Constraint Registry Is the Single Source of Truth

All cross-capability constraints MUST be defined in `CapabilityConstraintRegistry.ts`. No ad-hoc constraint checks in individual resolvers, routes, or frontend components.

### R21: Constraints Are Declarative

Constraints are declared as data (source target, target target, type, severity), not as imperative code. The `CapabilityConstraintResolver` evaluates all constraints uniformly. This enables future migration to a database-driven registry without changing the evaluation logic.

### R22: Write-Time Validation Mirrors Read-Time Evaluation

PUT handlers MUST use the same `applyCrossCapabilityConstraints` function to validate settings changes. The evaluation logic is identical — the only difference is the input (simulated effective state vs. current effective state).
