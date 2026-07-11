---
description: Master orchestration skill that connects all capability skills into a single end-to-end deployment pipeline — from feature definition through database seeding, backend resolver, API routes, frontend services, dashboard display, and verification
---

# Capability Deployment Flow — End-to-End Orchestration

This skill is the **connective tissue** that links all capability-related skills into a single deployment pipeline. Use it as the entry point when adding, modifying, or debugging any capability. It tells you which skill to invoke at each phase and ensures nothing is missed.

## When to Use This Skill

- Adding a **new capability type** (e.g., a new domain like `loyalty_options`)
- Adding a **new feature key** to an existing capability (e.g., `crm_inquiry_auto_response`)
- Modifying the **merchant preference model** of a capability (e.g., adding per-feature toggles)
- Debugging a capability that **isn't showing correctly** on the dashboard or settings page
- Auditing the **data flow consistency** of an existing capability

## The 8-Phase Deployment Pipeline

```
Phase 1: Define          → canonical-features.ts + tier-hierarchies.ts
Phase 2: Seed DB         → features_list + capability_features_list + tier_features_list
Phase 3: Store Prefs     → tenant_*_options_settings table + Prisma schema
Phase 4: Resolve         → XxxResolver.ts + types.ts + EffectiveCapabilityResolver.ts
Phase 4.5: Constraints   → capability_constraints_list DB table + CapabilityConstraintRegistry.ts fallback (if cross-capability deps)
Phase 5: Route           → xxx-options-settings.ts (GET + PUT + tier filtering + cache invalidation + constraint validation)
Phase 6: Map             → UnifiedCapabilityService.ts + CapabilityResolutionService.ts
Phase 7: Display         → PlanSummaryPanel.tsx + CapabilityShowcase.tsx + settings page
Phase 8: Verify          → verify-capability-deployment.md checklist + pnpm checkapi/checkweb
```

Each phase below specifies: **what to do**, **which skill to reference**, and **the consistency rules that apply**.

---

## Phase 1: Define the Feature

**Skill**: `capability-system-integration.md` (Step 1)

**What**:
- Add the feature key to `packages/feature-definitions/src/definitions/canonical-features.ts`
- Add the feature key to the appropriate tier in `packages/feature-definitions/src/definitions/tier-hierarchies.ts`
- Features cascade upward via spread (`...LOWER_TIER_FEATURES`)

**Rules**:
- Feature keys MUST be `snake_case` with domain prefix (e.g., `crm_inquiry_auto_response`, `faq_kb_rag_retrieval`)
- Feature keys MUST follow the canonical naming convention (R15 in `capability-data-flow-rules.md`): `<capability_key>_enabled`, `<capability_key>_<group>_<feature>`
- For options capabilities, features MUST be organized into groups with group gates (R16): `<capability_key>_<group>_enabled` / `_disabled`
- The `key` field is the machine identifier; `name` is human-readable
- `category` is optional — Admin UI sends `NULL`

**Decision point**: Is this a new capability domain or a new feature in an existing domain?
- **New domain** → Also follow `capability-system-integration.md` Step 2 to create a `capability_type_list` entry
- **Existing domain** → Skip to Phase 2 and link the feature to the existing capability type

---

## Phase 2: Seed the Database

**Skill**: `add-capability-feature.md` (Methods 1-3 + Post-Insert Checklist steps 1-2) + `link-features-to-capability-type.md`

**What**:
1. Insert the feature into `features_list` (via Admin UI, SQL migration, or Prisma client)
2. Link the feature to its capability type via `capability_features_list`
3. Enable the feature for each tier via `tier_features_list`

**SQL pattern**:
```sql
-- 1. Insert feature
INSERT INTO features_list (key, name, description, is_active, sort_order, created_at, updated_at)
VALUES ('crm_inquiry_auto_response', 'Auto Response', '...', true, 0, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- 2. Link to capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order)
VALUES (
  (SELECT id FROM capability_type_list WHERE key = 'crm_options'),
  (SELECT id FROM features_list WHERE key = 'crm_inquiry_auto_response'),
  true, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM capability_features_list WHERE capability_type_id = (SELECT id FROM capability_type_list WHERE key = 'crm_options'))
);

-- 3. Enable for tiers
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled)
SELECT gen_random_uuid()::text, stl.id, 'crm_inquiry_auto_response', 'Auto Response',
  (SELECT id FROM capability_type_list WHERE key = 'crm_options'), true
FROM subscription_tiers_list stl
WHERE stl.tier_key IN ('commitment', 'professional');
```

**Rules**:
- A feature in `features_list` alone is **invisible** to tenants until a `tier_features_list` row enables it
- Use `ON CONFLICT (key) DO UPDATE` for idempotent migrations
- Run `node scripts/fix_feature_key_spaces.js` if feature keys have whitespace issues

---

## Phase 3: Create Merchant Preference Storage

**Skill**: `add-capability-feature.md` (Post-Insert Checklist step 3) + `capability-system-integration.md` (Step 2)

**What**:
1. Add column to the appropriate `tenant_*_options_settings` table
2. Update Prisma schema model to match
3. Run `pnpm prisma db pull && pnpm prisma generate` in `apps/api/`

**Table mapping** (see `add-capability-feature.md` for full table):

| Capability Type | Merchant Gate Table |
|---|---|
| `storefront_types` | `tenant_storefront_type_settings` |
| `storefront_options` | `tenant_storefront_options_settings` |
| `product_types` | `tenant_product_types_settings` |
| `product_options` | `tenant_product_options_settings` |
| `crm_options` | `tenant_crm_options_settings` |
| `faq_options` | `tenant_faq_options_settings` |
| `chatbot_options` | `tenant_chatbot_options_settings` |
| `social_commerce_options` | `tenant_social_commerce_options_settings` |
| `directory_entry` | `tenant_storefront_options_settings` (page_type = 'directory_entry') |

**Types/Options split pattern** (R14 in `capability-data-flow-rules.md`): Domains that have both entity-type gating and display/behavior features MUST be split into `<domain>_types` and `<domain>_options`. Each gets its own capability type, resolver, service, API route, and settings table. See `docs/CAPABILITY_TYPES_TARGET_ARCHITECTURE.md` for the canonical design.

**Decision point**: Is this a master toggle or a per-feature toggle?
- **Master toggle** (e.g., `crm_enabled`, `faq_enabled`): Single boolean column. When `enabled` is true, ALL tier-allowed features are effectively on. No per-feature merchant gating. See R11 in `capability-data-flow-rules.md`.
- **Per-feature toggle** (e.g., `chatbot_static_enabled`, `chatbot_widget_enabled`): Individual boolean columns. Tier-allowed features that merchant hasn't enabled show as `merchant-gated` (amber). See R5 in `capability-data-flow-rules.md`.

---

## Phase 4: Build the Backend Resolver

**Skill**: `capability-system-integration.md` (Step 3) + `capability-data-flow-rules.md` (Layer 1 + Rules R1, R2)

**What**:
1. Add the `EffectiveXxx` interface to `apps/api/src/services/resolvers/types.ts`
2. Update or create the resolver function in `apps/api/src/services/resolvers/XxxResolver.ts`
3. Wire the resolver into the orchestrator `EffectiveCapabilityResolver.ts`

**Required output fields** (from `capability-data-flow-rules.md`):
```ts
interface EffectiveXxx {
  enabled: boolean;                    // master gate: tier AND merchant master switch
  is_flexible: boolean;                // tier allows all features
  allowed_*_types: SomeType[];         // tier-allowed feature keys (HARD GATE)
  can_use_*: boolean;                  // effective: tier allows AND merchant enabled (SOFT GATE)
  *_available: boolean;                // convenience: enabled AND at least one effective type active
  merchant_preferences: Record<...>;   // preserved merchant prefs for settings pages
}
```

**Resolver signature**:
```ts
export function resolveXxxOptions(
  features: Record<string, boolean>,
  merchantPrefs?: XxxMerchantSettings | null
): EffectiveXxx
```

**Orchestrator wiring** (`EffectiveCapabilityResolver.ts`):
```ts
resolveXxxOptions(
  rawCaps.capabilities.xxx_options?.features || {},
  merchantBundle.xxxOptions
),
```

**Rules**:
- R1: Resolver MUST accept `merchantPrefs` and produce both `allowed_*` (tier-only) and `can_use_*` / `effective_*` (tier + merchant)
- R2: `enabled` = tier feature enabled AND merchant master switch on
- R3: `*Available` is convenience only — never use as sole tier check in dashboard
- R23: Every individual feature flag check MUST include `flexible ||` prefix — including standalone booleans outside group arrays. Flexible tiers unlock ALL features in the capability; missing the prefix causes features to stay disabled on flexible tiers.
- For choice-based config (layouts, types, modes): compute a single `effective_*` value, not just raw merchant preference
- Trim feature keys to avoid whitespace issues: `cleanFeatures[key.trim()] = val`

**Special case — Org-scoped capabilities**: Use `add-org-capability.md`. Org resolvers do NOT accept merchant prefs (they are org-scoped, not tenant-scoped). Pass `capability_enabled` instead.

**Special case — BSaaS (purchasable) features**: Use `add-bsaas-feature.md`. The resolver is source-agnostic — purchased features auto-merge into the same `mergedFeatures` map. No resolver changes needed for most BSaaS features.

**Special case — Expired/inactive tenants**: When `resolveEffectiveCapabilities` returns null (tenant exists but has no resolvable tier data), the route handler in `tenant-capabilities.ts` falls back to `buildExpiredCapabilitiesResponse()`. This function MUST include an entry for every capability domain with all fields set to disabled/falsy values. When adding a new capability domain, add it to `buildExpiredCapabilitiesResponse` with a complete disabled object matching the `EffectiveXxx` interface. See R13 in `capability-data-flow-rules.md`.

---

## Phase 4.5: Add Cross-Capability Constraints (If Applicable)

**Skill**: `capability-data-flow-rules.md` (Rules R18-R22)

**When**: Add a constraint when the new capability has a dependency on another capability's type or state (e.g., "service storefront requires service product type"). Skip this phase if no cross-capability dependency exists.

**What**:
1. Insert a row into the `capability_constraints_list` DB table (via SQL migration or admin API)
2. Also add a static fallback entry in `CapabilityConstraintRegistry.ts` (used when DB is unavailable)
3. If the constraint is `block` severity, add write-time validation to the PUT handler (Phase 5)

**Method A: SQL Migration** (recommended for initial seeding):
```sql
INSERT INTO capability_constraints_list
  (constraint_id, type, severity, source_capability, source_field, source_operator, source_value,
   target_capability, target_field, target_operator, target_value, message, resolution_hint, sort_order)
VALUES
  ('my_constraint_id', 'requires', 'block',
   'my_capability', 'effective_type', 'equals', 'my_type',
   'other_capability', 'allowed_types', 'includes', 'my_type',
   'My capability requires Other capability type',
   'Enable Other capability type or select a different type',
   10)
ON CONFLICT (constraint_id) DO NOTHING;
```

**Method B: Admin API** (for runtime management):
```bash
curl -X POST /api/admin/capability-constraints \
  -H 'Content-Type: application/json' \
  -d '{
    "constraint_id": "my_constraint_id",
    "type": "requires",
    "severity": "block",
    "source_capability": "my_capability",
    "source_field": "effective_type",
    "source_operator": "equals",
    "source_value": "my_type",
    "target_capability": "other_capability",
    "target_field": "allowed_types",
    "target_operator": "includes",
    "target_value": "my_type",
    "message": "My capability requires Other capability type",
    "resolution_hint": "Enable Other capability type or select a different type"
  }'
```

**Static fallback** in `CapabilityConstraintRegistry.ts`:
```ts
export const CAPABILITY_CONSTRAINTS: CrossCapabilityConstraint[] = [
  // ... existing constraints
  {
    id: 'my_constraint_id',
    type: 'requires',
    severity: 'block',
    source: { capability: 'my_capability', field: 'effective_type', operator: 'equals', value: 'my_type' },
    target: { capability: 'other_capability', field: 'allowed_types', operator: 'includes', value: 'my_type' },
    message: 'My capability requires Other capability type',
    resolution_hint: 'Enable Other capability type or select a different type',
  },
];
```

**Rules**:
- R18: Constraints run as a post-resolution pass (Step 5.5 in `EffectiveCapabilityResolver.ts`) — never inside individual resolvers
- R19: Violations are surfaced in `constraint_violations` + `constraint_status`, not silently applied
- R20: All constraints MUST be in the DB table — the static array is fallback only
- R21: Constraints are declarative data, not imperative code
- R22: PUT handlers with `block` constraints MUST call `await validateProposedChange()` before persisting

**Constraint fields reference**:
| Field | Description | Valid Values |
|---|---|---|
| `type` | Constraint type | `requires`, `recommends`, `excludes`, `implies` |
| `severity` | Violation severity | `block` (enforced at write-time), `warn` (UI only), `info` (UI only) |
| `source_capability` | Key in `effective` object | `storefront`, `product_types`, `fulfillment`, etc. |
| `source_field` | Field on the source capability | `effective_type`, `enabled`, etc. |
| `source_operator` | Comparison operator | `equals`, `includes`, `not_includes`, `is_true`, `is_false` |
| `source_value` | Value to compare | String or boolean (stored as text, `true`/`false` for booleans) |
| `target_*` | Same fields for the target capability | Same as above |

---

## Phase 5: Create the API Route

**Skill**: `capability-system-integration.md` (Step 4) + `capability-data-flow-rules.md` (Layer 3 + Rules R6, R7)

**What**:
1. Create or update `apps/api/src/routes/xxx-options-settings.ts`
2. Implement GET endpoint: returns `{ success, settings, tierState }` with tier-filtered settings
3. Implement PUT endpoint: validates against tier, persists merchant prefs, invalidates cache
4. Add Zod validation schema for all fields including enum values

**URL namespace selection** (from `docs/AUTH_SCOPE_ISOLATION_SPEC.md` FR-1, FR-2):
- **Public capability routes** (readable by storefront/product pages without auth) MUST be mounted at `/api/public/tenants/:tenantId/*` using a `mergeParams` router.
- **Private capability routes** (dashboard/settings only) MUST stay at `/api/tenants/:tenantId/*` with per-route `authenticateToken`.
- **Dual-scope routes** (e.g., `effective-capabilities`) get two endpoints: public summary at `/api/public/tenants/:tenantId/*` (no auth, `detail=full` ignored) + private full detail at `/api/tenants/:tenantId/*` (auth required, `?detail=full` returns raw gates).
- **Never** use `router.use(authenticateToken)` at the router level in orchestrator-mounted sub-routers — use per-route `authenticateToken` only. See `AUTH_SCOPE_ISOLATION_SPEC.md` FR-3.

**GET endpoint pattern**:
```ts
router.get('/:tenantId/xxx-options', authenticateToken, async (req, res) => {
  const tierState = await resolveEffectiveCapabilities(tenantId, { detail: 'summary' });
  if (!tierState?.effective.xxx?.enabled) {
    return res.json({ success: true, settings: ALL_FALSE, tierState: tierState?.effective.xxx });
  }
  const rawSettings = await prisma.tenant_xxx_settings.findUnique({ ... }) || DEFAULTS;
  const tierFiltered = filterByTier(rawSettings, tierState.effective.xxx);
  res.json({ success: true, settings: tierFiltered, tierState: tierState.effective.xxx });
});
```

**PUT endpoint pattern**:
```ts
router.put('/:tenantId/xxx-options', authenticateToken, async (req, res) => {
  // 1. Fetch tier state
  // 2. Reject if capability disabled (403 capability_disabled)
  // 3. For each field: reject if tier doesn't allow (403 tier_restricted)
  // 4. Persist filtered settings
  // 5. Invalidate cache: invalidateEffectiveCapabilities(tenantId)
});
```

**Rules**:
- R6: GET MUST return `tierState` in the response
- R7: Settings MUST be tier-filtered (force false when tier doesn't allow, even if merchant pref is true)
- Zod validation schema MUST include all enum values from the type union (runtime gap — TypeScript won't catch)
- Cache invalidation is CRITICAL — without it, unified endpoint serves stale data for up to 60 seconds

---

## Phase 6: Map to Frontend State

**Skill**: `capability-system-integration.md` (Step 5) + `capability-data-flow-rules.md` (Layer 4 + Rule R9) + `deploy-service-extending-base-singleton.md`

**What**:
1. Add the `BackendEffectiveXxx` interface to `UnifiedCapabilityService.ts`
2. Add the `XxxOptionsState` interface to `CapabilityResolutionService.ts`
3. Write the `mapXxx(b: BackendEffectiveXxx): XxxOptionsState` mapper function
4. If new domain: add to `AllCapabilitiesState` and `mapAll()`
5. Add `getXxxState(tenantId)` method to `UnifiedCapabilityService`
6. Add `useXxxCapability` hook to `useCapabilityAccess.ts`

**Mapping rules**:
- Backend `snake_case` → Frontend `camelCase` (R10)
- Map ALL fields: `allowed_*_types` → `allowed*Types`, `can_use_*` → `canUse*`, `merchant_preferences` → `merchantPreferences`, `*_available` → `*Available`
- Do NOT add resolution logic in the frontend — the backend already resolved everything
- `features` on every state object is always `{}` (legacy compatibility) — use `enabled` instead
- Fallback resolvers in `CapabilityResolutionService.ts` MUST include `merchantPreferences: null`

**Frontend service pattern** (from `deploy-service-extending-base-singleton.md` + `AUTH_SCOPE_ISOLATION_SPEC.md` FR-2a):
- Use `TenantApiSingleton` for merchant-scoped services — MUST call `/api/tenants/...` endpoints
- Use `PublicApiSingleton` for public storefront reads — MUST call `/api/public/...` endpoints
- **URL prefix MUST match base class auth scope**: a `PublicApiSingleton` service MUST NOT call `/api/tenants/...` endpoints. A `TenantApiSingleton` service MUST NOT call `/api/public/...` endpoints.
- For dual-scope data (e.g., `effective-capabilities`): the `PublicApiSingleton` service calls `/api/public/tenants/...` (summary), and a separate `TenantApiSingleton` service calls `/api/tenants/...` (full detail with auth).
- Never use direct `fetch` calls — always extend the singleton base

---

## Phase 7: Display on Dashboard

**Skill**: `capability-data-flow-rules.md` (Layer 6 + Rules R2-R5, R11, R12) + `add-capability-feature.md` (Steps 9-10)

**What**:
1. Add capability to `CAPABILITY_DISPLAY` map in `PlanSummaryPanel.tsx`
2. Add summary block in `resolveCapabilitySummaries()` in `PlanSummaryPanel.tsx`
3. Add row to `rows` array in `CapabilityShowcase.tsx`
4. Create or update the settings page at `apps/web/src/app/t/[tenantId]/settings/xxx/`

### PlanSummaryPanel Rules

- Use `caps.xxx.enabled` to decide whether to show the capability (R2)
- Use `allowed*Types` arrays to determine WHICH features to show (R4)
- Use `canUse*` / `effective*` to determine STATUS: `'enabled'` or `'merchant-gated'` (R4)
- Tier-allowed features that merchant hasn't enabled MUST show as `'merchant-gated'` (amber), NOT hidden (R5)

**Master-toggle capabilities** (FAQ, CRM): All tier-allowed features show as `'enabled'` — never `'merchant-gated'` (R11)

**Per-feature toggle capabilities** (Chatbot, Social Commerce, Storefront Options): Use `addXxx(label, tierAllowed, effective)` pattern

### CapabilityShowcase Rules

- Use `cap?.enabled` for the `*Tier` variable — NOT `*Available` (R2, R3)
- Use `allowed*Types` arrays for detail parts
- For `merchantGated` computation: compare group-level allowed count vs effective count (R12)

```ts
// CORRECT (group-level):
const allowedCount = (cap?.allowedResponseEngines.length > 0 ? 2 : 0) + ...;
const effectiveCount = (cap?.staticEnabled ? 1 : 0) + (cap?.dynamicEnabled ? 1 : 0) + ...;
const merchantGated = tier && effectiveCount < allowedCount;

// WRONG (individual type counting — always over-counts):
const allowedCount = cap?.allowedResponseEngines.length + cap?.allowedSkillTypes.length + ...;
```

**Master-toggle capabilities**: `merchantGated = false` (R11)

### Settings Page

- Use `useXxxCapability(tenantId)` hook for tier state
- Use `xxxOptionsService.getOptions()` for merchant prefs
- `isTierAllowed` function MUST use `allowed*Types` arrays for tier checks — NOT effective flags (`*Enabled`) or `isFlexible`-only (R25)
- Group toggles use `allowed*Types.length > 0`; individual features use `allowed*Types.includes(key)`
- Disable toggles when tier doesn't allow; show 'Not in your plan' label (R5)
- Show 'Not included in your plan' messaging when `tierState.enabled` is false
- Call PUT endpoint on save

---

## Phase 8: Verify End-to-End

**Skill**: `verify-capability-deployment.md`

**What**:
1. Run database verification queries (check `features_list`, `capability_features_list`, `tier_features_list`)
2. Verify backend resolver accepts merchant prefs and computes effective fields
3. Verify API route returns `tierState` and tier-filters settings
4. Verify unified endpoint returns the capability under `effective.<domain>`
5. Verify frontend mapper maps all fields correctly
6. Verify React hook uses `UnifiedCapabilityService` (not old `CapabilityResolutionService`)
7. Verify settings page gates toggles by tier
8. Verify PlanSummaryPanel and CapabilityShowcase display the capability
9. Run type checks: `pnpm checkapi` and `pnpm checkweb`

**Common root causes** (from `verify-capability-deployment.md`):
1. Feature key whitespace in DB
2. Missing `capability_type_id` in query
3. `effective_*` not computed in resolver
4. Feature-map guards (`Object.keys(X.features).length > 0` always false)
5. Frontend trying to resolve instead of map
6. Raw settings dump bloating payload
7. Cache not invalidated after settings update
8. Wrong property name on state object
9. Zod schema enum out of sync with type union
10. Missing `flexible ||` prefix on standalone feature flags (R23) — feature stays disabled on flexible tiers

---

## Skill Cross-Reference Matrix

| Phase | Primary Skill | Supporting Skills |
|---|---|---|
| 1. Define | `capability-system-integration.md` | — |
| 2. Seed DB | `add-capability-feature.md` | `link-features-to-capability-type.md` |
| 3. Store Prefs | `add-capability-feature.md` | `capability-system-integration.md` |
| 4. Resolve | `capability-system-integration.md` | `capability-data-flow-rules.md`, `add-org-capability.md`, `add-bsaas-feature.md` |
| 5. Route | `capability-system-integration.md` | `capability-data-flow-rules.md` |
| 6. Map | `capability-system-integration.md` | `capability-data-flow-rules.md`, `deploy-service-extending-base-singleton.md` |
| 7. Display | `capability-data-flow-rules.md` | `add-capability-feature.md` |
| 8. Verify | `verify-capability-deployment.md` | `capability-data-flow-rules.md` |

## Decision Tree: Which Skills to Use

```
Starting point: "I need to add or fix a capability"
│
├── New capability domain (e.g., loyalty_options)?
│   → Follow all 8 phases. Start with capability-system-integration.md
│
├── New feature in existing domain (e.g., crm_inquiry_auto_response)?
│   → Follow phases 1-3, 4 (update resolver), 5 (update route), 6 (update mapper), 7 (update display), 8
│   → Primary skill: add-capability-feature.md
│
├── Fixing a capability that isn't showing on dashboard?
│   → Start with verify-capability-deployment.md (Phase 8)
│   → Then jump to the broken phase
│
├── Fixing data flow consistency (badge shows wrong status)?
│   → Use capability-data-flow-rules.md (Rules R1-R12)
│   → Check Phase 4 (resolver) and Phase 7 (display)
│
├── Adding org-level capability?
│   → Use add-org-capability.md (org-scoped, no merchant prefs)
│
├── Adding purchasable (BSaaS) feature?
│   → Use add-bsaas-feature.md (auto-merges into features map)
│   → Also check store-purchases-capability-checklist.md for companion purchase requirements
│
├── Adding chatbot skill?
│   → Use add-chatbot-skill.md
│
└── Need to create a new frontend service?
    → Use deploy-service-extending-base-singleton.md
```

## Quick Checklist (Print This)

When deploying a capability change, verify ALL of these:

- [ ] Feature key exists in `features_list`
- [ ] Feature key follows canonical naming convention (R15): `<capability_key>_<group>_<feature>`
- [ ] For options capabilities, group gates exist (R16): `<capability_key>_<group>_enabled` / `_disabled`
- [ ] Feature linked to capability type in `capability_features_list`
- [ ] Feature enabled for appropriate tiers in `tier_features_list`
- [ ] If new domain with types + options: both capability types created (R14)
- [ ] Merchant pref column exists in `tenant_*_options_settings` + Prisma schema
- [ ] Resolver accepts `merchantPrefs` and computes `allowed_*` + `can_use_*` / `effective_*`
- [ ] Resolver follows enablement precedence (R17): `*_disabled` > `*_enabled` > `*_flexible` > features
- [ ] Every individual feature flag check in the resolver includes `flexible ||` prefix (R23) — including standalone booleans outside group arrays
- [ ] Resolver returns `merchant_preferences` field
- [ ] Orchestrator passes `merchantBundle.xxx` to resolver
- [ ] If cross-capability dependency exists: insert constraint into `capability_constraints_list` DB table (R20)
- [ ] Also add static fallback entry in `CapabilityConstraintRegistry.ts` (used when DB is unavailable)
- [ ] Constraint is declarative (source target, target target, type, severity) — no imperative logic (R21)
- [ ] If constraint is `block` severity: add `validateProposedChange()` call to PUT handler (R22)
- [ ] `validateProposedChange()` call is awaited (async — loads from DB via `getActiveConstraints()`)
- [ ] API GET returns `{ success, settings, tierState }` with tier-filtered settings
- [ ] API PUT validates against tier (403 tier_restricted / capability_disabled)
- [ ] API PUT calls `invalidateEffectiveCapabilities(tenantId)`
- [ ] Zod schema includes all enum values
- [ ] Frontend `BackendEffectiveXxx` interface matches backend output
- [ ] `mapXxx()` maps all fields including `merchant_preferences`
- [ ] Fallback resolver in `CapabilityResolutionService.ts` includes `merchantPreferences: null`
- [ ] `useXxxCapability` hook uses `UnifiedCapabilityService` (not `CapabilityResolutionService`)
- [ ] `PlanSummaryPanel` has entry in `CAPABILITY_DISPLAY` + summary block in `resolveCapabilitySummaries()`
- [ ] `CapabilityShowcase` has row in `rows` array with correct `merchantGated` computation
- [ ] Settings page gates toggles by tier state
- [ ] Expired/inactive tenant returns 200 with disabled capabilities (not 404) — see R13 in `capability-data-flow-rules.md`
- [ ] `buildExpiredCapabilitiesResponse` includes the new capability domain with all fields disabled
- [ ] `buildExpiredCapabilitiesResponse` includes `constraint_violations: []` and `constraint_status: {}`
- [ ] **Subscription-status override** (`EffectiveCapabilityResolver.ts` Step 6): If the capability involves writes, purchases, or active operations, add `result.effective.<domain>.enabled = false` to the `isReadOnly` block. If it involves creating new entities, also add to `isLimited` block. See R23 in `capability-data-flow-rules.md`
- [ ] **Frontend `deriveInternalStatus` sync**: If the backend `deriveInternalStatus` has a tier-to-status mapping the frontend lacks, add it to `apps/web/src/lib/subscription-status.ts`. See R24 in `capability-data-flow-rules.md`
- [ ] **Frontend status display prefers backend**: Components displaying subscription status (e.g., `SubscriptionDisplayCard`) should use `capabilities.subscriptionContext.internalStatus` when available, falling back to `deriveInternalStatus()`. See R24
- [ ] If adding a cross-capability constraint: insert into `capability_constraints_list` DB table + add static fallback in `CapabilityConstraintRegistry.ts` (R20)
- [ ] **Update `CONSTRAINT_METADATA`** in `apps/api/src/routes/admin/capability-constraints.ts` — add an entry for the new capability domain with its key, label, fields (with correct `value_type`, `operators`, and `values` derived from the `EffectiveXxx` interface in `types.ts`). Without this, the new capability won't appear in the constraint form dropdowns.
- [ ] Settings page `isTierAllowed` uses `allowed*Types` arrays, not effective flags or `isFlexible`-only (R25)
- [ ] Settings page group toggles use `allowed*Types.length > 0`, not `*Enabled` effective flags (R25)
- [ ] `CAPABILITY_DISPLAY` `settingsPath` points to actual settings page URL, not parent route (R26)
- [ ] **Route URL namespace matches auth scope**: public routes at `/api/public/tenants/:tenantId/*`, private routes at `/api/tenants/:tenantId/*` (see `AUTH_SCOPE_ISOLATION_SPEC.md` FR-1, FR-2)
- [ ] **Frontend service base class matches route auth scope**: `PublicApiSingleton` → `/api/public/...` URL, `TenantApiSingleton` → `/api/tenants/...` URL (see `AUTH_SCOPE_ISOLATION_SPEC.md` FR-2a)
- [ ] **No `router.use(authenticateToken)` at router level** in orchestrator-mounted sub-routers — use per-route `authenticateToken` only (see `AUTH_SCOPE_ISOLATION_SPEC.md` FR-3)
- [ ] `pnpm checkapi` passes with zero TS errors
- [ ] `pnpm checkweb` passes with zero TS errors
