---
description: Rules for consistent capability data flow from backend resolver through API route to frontend dashboard display
---

# Capability Data Flow Consistency Rules

This skill defines the canonical pattern for how a tier-gated capability flows from backend resolver to dashboard UI. All existing and new capabilities MUST follow these rules to ensure consistent merchant-gating display across `PlanSummaryPanel` and `CapabilityShowcase`.

## Architecture: 6 Layers

```
1. Resolver Layer (backend)   → XxxResolver.ts — computes effective state from tier features + merchant prefs
2. Orchestrator Layer          → EffectiveCapabilityResolver.ts — dispatches to all resolvers, returns unified manifest
3. API Route Layer             → xxx-options-settings.ts — GET returns { settings, tierState }, PUT saves merchant prefs
4. Frontend Service Layer      → UnifiedCapabilityService.ts — maps snake_case backend to camelCase frontend state
5. React Hook Layer            → useCapabilityAccess.ts — fetches state, provides { data, loading, error, refetch }
6. Dashboard Display Layer     → PlanSummaryPanel.tsx + CapabilityShowcase.tsx — renders capability summaries
```

## The Canonical Pattern (Tier-Gated + Merchant-Gated)

Capabilities with both tier hard-gates and merchant soft-gates follow this pattern. This is the REQUIRED pattern for all capabilities.

### Layer 1: Resolver

**File**: `apps/api/src/services/resolvers/XxxResolver.ts`

**Signature**: `resolveXxx(features: Record<string, boolean>, merchantPrefs: XxxMerchantSettings | null): EffectiveXxx`

**Required output fields**:

```ts
interface EffectiveXxx {
  enabled: boolean;                    // master gate: tier enabled AND merchant master switch on
  is_flexible: boolean;                // tier allows all features
  allowed_*_types: SomeType[];         // tier-allowed feature keys (HARD GATE — what the plan permits)
  can_use_*: boolean;                  // effective flags: tier allows AND merchant enabled (SOFT GATE applied)
  // OR effective_*: boolean[];        // alternative naming: effective_types, effective_shows_*
  *_available: boolean;                // convenience: enabled AND at least one effective type is active
  merchant_preferences: Record<...>;   // preserved merchant prefs for settings pages
}
```

**Key rule**: The resolver MUST accept `merchantPrefs` and produce both `allowed_*_types` (tier-only) and `can_use_*` / `effective_*` (tier + merchant). The `enabled` field is the master gate (tier AND merchant master switch). The `*_available` field is a convenience flag that requires at least one effective feature to be active.

### Layer 2: Orchestrator

**File**: `apps/api/src/services/EffectiveCapabilityResolver.ts`

The orchestrator MUST pass `merchantBundle.xxx` to the resolver. Capabilities that pass only `(features)` or `(features, capabilityEnabled)` are incomplete — they skip merchant preferences entirely.

### Layer 3: API Route

**File**: `apps/api/src/routes/xxx-options-settings.ts`

**GET endpoint pattern**:

```ts
router.get('/:tenantId/xxx-options', authenticateToken, async (req, res) => {
  const caps = await resolveEffectiveCapabilities(tenantId, { detail: 'summary' });
  const tierState = caps?.effective.xxx;

  if (!tierState || !tierState.enabled) {
    // Return all-false settings when tier-disabled
    return res.json({ success: true, settings: allOff, tierState });
  }

  const merchantPrefs = await prisma.tenant_xxx_options_settings.findUnique({ ... });
  const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

  // Tier-filter: force off any setting not allowed by tier
  const tierFilteredSettings = {};
  for (const key of FEATURE_KEYS) {
    const isAllowed = tierState.is_flexible || tierState.allowed_*_types.includes(key);
    tierFilteredSettings[key] = isAllowed ? !!rawSettings[key] : false;
  }

  res.json({ success: true, settings: tierFilteredSettings, tierState });
});
```

**Required response shape**: `{ success: boolean, settings: Record<string, boolean>, tierState: EffectiveXxx }`

**Key rules**:
- MUST return `tierState` in the response (the storefront-options-settings route violates this)
- MUST tier-filter settings (force false when tier doesn't allow, even if merchant pref is true)
- MUST return all-false settings when tier is disabled

### Layer 4: Frontend Service Mapping

**File**: `apps/web/src/services/UnifiedCapabilityService.ts`

**Mapping function**: `mapXxx(b: BackendEffectiveXxx): XxxState`

Maps snake_case backend fields to camelCase frontend state. Must map ALL fields including `allowed_*_types` → `allowed*Types`, `can_use_*` → `canUse*`, `*_available` → `*Available`, `merchant_preferences` → `merchantPreferences`.

### Layer 5: React Hook

**File**: `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts`

```ts
export function useXxxCapability(tenantId: string | null): CapabilityHookState<XxxState> {
  // Fetches via UnifiedCapabilityService.getInstance().getXxxState(tenantId)
  // Returns { data, loading, error, refetch }
}
```

### Layer 6: Dashboard Display

#### PlanSummaryPanel.tsx

**Tier check**: Use `caps.xxx.enabled` to decide whether to show the capability.

**Feature display**: Use `allowed*Types` arrays to determine WHICH features to show. Use `canUse*` / `effective*` to determine the STATUS of each feature.

```ts
// CORRECT pattern:
if (cap.allowedMetaTypes.length > 0) {
  specifics.push('Meta Commerce');
  statuses.push({
    label: 'Meta Commerce',
    status: cap.canUseMetaCatalog || cap.canUseMetaShop ? 'enabled' : 'merchant-gated'
  });
}

// WRONG pattern (uses group flags that conflate tier + merchant):
if (cap.metaEnabled) {  // ❌ This is false when merchant hasn't toggled on
  specifics.push('Meta Commerce');
  statuses.push({ label: 'Meta Commerce', status: 'enabled' });
}
```

**Key rule**: Tier-allowed features that the merchant hasn't enabled yet MUST show as `merchant-gated` (amber), NOT be hidden. Only features not allowed by the tier should be hidden entirely.

#### CapabilityShowcase.tsx

**Tier check**: Use `cap?.enabled` for the `*Tier` variable. Do NOT use `*Available` flags (e.g., `crmAvailable`, `chatbotAvailable`) — these require merchant prefs to be active and will hide tier-allowed features.

**Detail parts**: Use `allowed*Types` arrays to list available feature groups. Use `canUse*` / `effective*` for the detail text.

```ts
// CORRECT:
const xxxTier = cap?.enabled ?? false;
if (cap?.allowedMetaTypes.length ?? 0) > 0) detailParts.push('Meta');

// WRONG:
const xxxTier = cap?.xxxAvailable ?? false;  // ❌ Hides tier-allowed features
if (cap?.metaEnabled) detailParts.push('Meta');  // ❌ Only shows merchant-enabled
```

## Resolved Inconsistencies (Gap-Filling Results)

All inconsistencies identified in the original audit have been resolved. The following changes were made:

### Resolved: Resolvers Missing Merchant Preferences

| Capability | Before | After |
|---|---|---|
| FAQ Options | `resolveFaqOptions(features)` | `resolveFaqOptions(features, merchantPrefs)` — master toggle `faq_enabled` |
| CRM Options | `resolveCrmOptions(features, capabilityEnabled)` | `resolveCrmOptions(features, merchantPrefs)` — master toggle `crm_enabled` |
| Chatbot Options | `resolveChatbotOptions(features, capabilityEnabled)` | `resolveChatbotOptions(features, merchantPrefs)` — per-feature toggles + `can_use_widget_*` |
| Org Options | `resolveOrgOptions(features, capabilityEnabled)` | Unchanged — org-scoped, no merchant prefs needed |

### Resolved: `*Available` vs `enabled` in CapabilityShowcase

CRM and Chatbot now use `?.enabled` for the tier check instead of `*Available`.

### Resolved: Group Flags vs `allowed*Types` in Dashboard

- **FAQ**: All tier-allowed features now show as `'enabled'` (master-toggle-only capability — no per-feature merchant gating)
- **CRM**: All tier-allowed features now show as `'enabled'` (master-toggle-only capability — no per-feature merchant gating)
- **Chatbot**: Uses `addBot(label, tierAllowed, effective)` pattern — tier-allowed features show as `'merchant-gated'` when merchant hasn't enabled them
- **Directory Entry**: Uses `addDe(label, tierAllowed, effective)` pattern with per-feature merchant gating

### Resolved: API Route Missing `tierState`

`storefront-options-settings.ts` now returns `{ success, settings, tierState }` with tier-filtered settings and all-false fallback when tier-disabled.

## New Insights from Gap-Filling

### Master-Toggle vs Per-Feature Merchant Prefs

Capabilities fall into two categories of merchant preference granularity:

1. **Master-toggle-only** (e.g., FAQ, CRM): The merchant pref is a single boolean (`faq_enabled`, `crm_enabled`). When the capability is `enabled`, ALL tier-allowed features are effectively enabled. There is NO per-feature merchant gating — the badge is either **Enabled** or **Off**.
   - Dashboard: All tier-allowed features show as `'enabled'` — never `'merchant-gated'`
   - `merchantGated` flag in CapabilityShowcase = `false`

2. **Per-feature toggles** (e.g., Chatbot, Social Commerce, Storefront Options): The merchant can toggle individual feature groups on/off. Tier-allowed features that the merchant hasn't enabled show as **merchant-gated** (amber).
   - Dashboard: Use `addXxx(label, tierAllowed, effective)` pattern — `'enabled'` or `'merchant-gated'`
   - `merchantGated` flag in CapabilityShowcase = `tierEnabled && effectiveCount < allowedCount`

### CapabilityShowcase Counting Must Be Group-Level

When computing `merchantGated` for per-feature capabilities in CapabilityShowcase, the allowed count and effective count MUST be at the **group level**, not individual type level.

```ts
// CORRECT (group-level counting for Chatbot):
const cbAllowedCount = (cb?.allowedResponseEngines.length > 0 ? 2 : 0)  // 2 groups: static + dynamic
  + (cb?.allowedSkillTypes.length > 0 ? 1 : 0)
  + (cb?.allowedKbTypes.length > 0 ? 1 : 0)
  + (cb?.allowedWidgetTypes.length > 0 ? 1 : 0);
const cbEffectiveCount = (cb?.staticEnabled ? 1 : 0) + (cb?.dynamicEnabled ? 1 : 0)
  + (cb?.skillsEnabled ? 1 : 0) + (cb?.kbEnabled ? 1 : 0) + (cb?.widgetEnabled ? 1 : 0);

// WRONG (individual type counting — always over-counts allowed, always shows merchant-gated):
const cbAllowedCount = cb?.allowedResponseEngines.length + cb?.allowedSkillTypes.length + ...;
```

### Fallback Resolvers Must Include `merchantPreferences: null`

`CapabilityResolutionService.ts` contains fallback resolver functions (used when the unified endpoint is unavailable). These MUST also include `merchantPreferences: null` in their return objects to satisfy the updated state interfaces.

### Chatbot Widget Sub-Features

The Chatbot resolver now computes `can_use_widget_custom_theme`, `can_use_widget_skill_cards`, and `can_use_widget_after_hours` as effective flags that require: (1) chatbot enabled, (2) widget group enabled, AND (3) the specific widget sub-feature merchant pref not explicitly `false`.

## Rules Summary

### R1: Resolver Must Accept Merchant Prefs
Every resolver MUST accept `(features, merchantPrefs)` and produce both tier-allowed arrays and effective (tier + merchant) flags.

### R2: `enabled` is the Master Gate
`enabled` = tier feature enabled AND merchant master switch on. Dashboard components MUST use `enabled` (not `*Available`) for the tier check.

### R3: `*Available` is Convenience Only
`*Available` = `enabled AND effectiveTypes.length > 0`. Never use it as the sole tier check in dashboard components — it hides tier-allowed features when merchant hasn't toggled any on.

### R4: Use `allowed*Types` for Display, `canUse*` for Status
Dashboard components AND settings pages MUST iterate `allowed*Types` arrays to decide which features to show, and use `canUse*` / `effective*` to decide if each is 'enabled' or 'merchant-gated'. This applies to both `PlanSummaryPanel`/`CapabilityShowcase` (dashboard) and `isTierAllowed` functions in settings pages.

### R5: Tier-Allowed Features Show as Merchant-Gated
When the tier allows a feature but the merchant hasn't enabled it, the dashboard AND settings page MUST show it with 'merchant-gated' (amber) status — NOT hide it. In settings pages, this means the toggle is visible and enabled (not disabled), but the merchant hasn't turned it on yet. Only features not allowed by the tier should be disabled with a 'Not in your plan' label.

### R6: API Route Must Return `tierState`
Every settings GET endpoint MUST return `{ success, settings, tierState }`. The frontend settings page needs `tierState` to render tier gating UI.

### R7: API Route Must Tier-Filter Settings
Settings returned to the frontend MUST be tier-filtered: if the tier doesn't allow a feature, the setting must be `false` regardless of the merchant pref value.

### R8: Orchestrator Must Pass Merchant Prefs
`EffectiveCapabilityResolver.ts` MUST pass `merchantBundle.xxx` to every resolver that accepts merchant prefs.

### R9: Frontend Mapper Must Map All Fields
`UnifiedCapabilityService.mapXxx()` MUST map all backend fields including `allowed_*_types`, `can_use_*`, `merchant_preferences`, and `*_available`.

### R10: Consistent Naming Convention
- Backend: `snake_case` (e.g., `allowed_meta_types`, `can_use_meta_catalog`, `social_commerce_available`)
- Frontend: `camelCase` (e.g., `allowedMetaTypes`, `canUseMetaCatalog`, `socialCommerceAvailable`)
- Capability type key: `snake_case` (e.g., `social_commerce_options`)
- Frontend state property: `camelCase` (e.g., `socialCommerceOptions`)

### R11: Master-Toggle Capabilities Show No Merchant-Gated State
Capabilities with only a master toggle merchant pref (e.g., FAQ, CRM) have no per-feature merchant gating. When `enabled` is true, ALL tier-allowed features show as `'enabled'` — never `'merchant-gated'`. The `merchantGated` flag in CapabilityShowcase MUST be `false` for these capabilities.

### R12: CapabilityShowcase Counting Must Be Group-Level
When computing `merchantGated` for per-feature capabilities, compare group-level allowed count vs effective count. Do NOT use individual type array lengths as the allowed count — this over-counts and always produces `merchantGated = true`.

### R13: Expired/Inactive Tenants Must Return 200 with Disabled Capabilities
When `resolveEffectiveCapabilities` returns null (tenant exists but has no resolvable tier data — e.g., expired/canceled subscription with no matching tier in `subscription_tiers_list`), the `GET /:tenantId/effective-capabilities` route in `tenant-capabilities.ts` MUST:

1. Check if the tenant exists in the `tenants` table (by ID, then slug fallback)
2. If found: return **200** with `buildExpiredCapabilitiesResponse(tenant)` — a complete disabled `effective` manifest with the tenant's actual `subscription_context` (e.g., `internalStatus: 'expired'`, `isReadOnly: true`, `writable: false`)
3. If not found: return **404** `tenant_not_found`

**`buildExpiredCapabilitiesResponse` MUST include every capability domain** with all fields set to disabled/falsy values. When adding a new capability domain, add a disabled entry to this function matching the `EffectiveXxx` interface. A missing domain will cause frontend mappers (`mapAll()` in `UnifiedCapabilityService.ts`) to crash on `undefined` fields.

**`resolveTenantIdentifier` MUST try ID lookup first** for any identifier format (not just `tid-*`). Tenant IDs like `tenant-*` are valid and must be resolved via `prisma.tenants.findUnique({ where: { id: identifier } })` before falling back to slug lookup.

### R14: One Capability = One Concern (Types/Options Split)
A capability type MUST represent a single concern. Domain capabilities that mix entity-type gating with display/behavior features MUST be split into two capability types:

- **`<domain>_types`**: Gates which entity kinds are available (e.g., `storefront_types`, `product_types`). Resolved by a `XxxTypeResolver` that produces `EffectiveXxxType` with `allowed_types`, `effective_type`, and `has_merchant_selection`. Merchant prefs stored in `tenant_<domain>_type_settings`.
- **`<domain>_options`**: Gates display/behavior/creation features (e.g., `storefront_options`, `product_options`). Resolved by a `XxxOptionsResolver` that produces `EffectiveXxxOptions` with group-based `allowed_*_types` and `can_use_*` flags. Merchant prefs stored in `tenant_<domain>_options_settings`.

**Current canonical pairs**:
| Types Capability | Options Capability |
|---|---|
| `storefront_types` | `storefront_options` |
| `product_types` | `product_options` |

When adding a new domain (e.g., `loyalty`), create both `loyalty_types` and `loyalty_options` if the domain has both entity-type and display-feature gating. If the domain has only display features (e.g., `faq_options`, `crm_options`), a single `_options` capability is sufficient.

### R15: Feature Key Naming Convention
Feature keys MUST follow this canonical pattern:

```
<capability_key>_enabled            # master ON gate
<capability_key>_disabled           # master OFF gate
<capability_key>_flexible           # unlock all features in this capability

<capability_key>_<group>_enabled    # group ON gate (options capabilities only)
<capability_key>_<group>_disabled   # group OFF gate (options capabilities only)

<capability_key>_<group>_<feature>  # individual feature within a group
```

**Examples**:
- `product_types_enabled`, `product_types_physical`, `product_types_flexible`
- `product_options_sections_enabled`, `product_options_sections_reviews`
- `storefront_options_qr_enabled`, `storefront_options_qr_codes_512`

**Forbidden patterns**:
- Mixing prefixes within a capability (e.g., `product_opt_*` in `product_options` — use `product_options_*`)
- Abbreviated prefixes (e.g., `storefront_opt_*` — use `storefront_options_*`)
- Flat keys without group prefix in an options capability (e.g., `product_variant` — use `product_options_creation_variants`)
- Using `_tier_` for internal capability levels (confusing with platform subscription tiers) — use `_level_` instead (e.g., `directory_promotion_level_basic`, not `directory_promotion_tier_basic`)

**Backward compatibility**: Legacy keys MAY be retained as aliases during migration. Resolvers check new keys first, then fall back to legacy keys. See `docs/CAPABILITY_TYPES_TARGET_ARCHITECTURE.md` §5 for the complete alias mapping.

### R16: Group Gates Required for Options Capabilities
Options capabilities MUST use group gates to organize features into logical clusters. A group gate is a pair of feature keys:

- `<capability_key>_<group>_enabled` — when true, all features in the group are tier-allowed
- `<capability_key>_<group>_disabled` — when true, all features in the group are tier-blocked (overrides individual features)

**Resolver pattern for each group**:
```ts
const groupEnabled = !!features[`${capKey}_${group}_enabled`];
const groupDisabled = !!features[`${capKey}_${group}_disabled`];
const allowedTypes: Type[] = [];
if (flexible || (groupEnabled && !groupDisabled)) {
  allowedTypes.push(...allTypesInGroup);
} else if (!groupDisabled) {
  if (features[`${capKey}_${group}_${feature}`]) allowedTypes.push(feature);
  // ... other features
}
```

**Canonical groups**:
| Capability | Groups |
|---|---|
| `storefront_options` | hours, category, recommend, info, qr, gallery, advanced, layout |
| `product_options` | creation, layout, sections |

When adding a new feature to an options capability, add it to an existing group or create a new group. Do NOT add flat feature keys outside of a group.

### R17: Enablement Precedence (Canonical Order)
All resolvers MUST determine the `enabled` state using this precedence:

1. If `*_disabled` is true → **OFF** (hard disable, highest priority)
2. Else if `*_enabled` is true → **ON** (explicit enable)
3. Else if `*_flexible` is true → **ON** (flexible implies enabled)
4. Else if any individual feature or group gate in the domain is enabled → **ON** (implicit enable)
5. Else → **OFF** (default disabled — nothing enabled at all)

**Key rule**: The default is **disabled** only when nothing at all is enabled in the capability domain — no `_enabled`, no `_disabled`, no `_flexible`, and no individual features. If any individual feature is enabled (e.g., `payment_gateway_stripe`), the capability is implicitly enabled even without the `_enabled` meta-key.

The same precedence applies at the group level: `*_disabled` > `*_enabled` > individual features.

**`_disabled` meta-keys**: Every capability type MUST have a `{prefix}_disabled` feature key in `features_list`, linked via `capability_features_list`. This allows admins to explicitly disengage a capability type from a tier without enabling any features. When `_disabled` is the only enabled feature for a capability type on a tier, `checkCapabilityEngagement` blocks purchases within that capability type.

### R23: Flexible Tier Unlocks ALL Features — No Exceptions
When `*_flexible` is true, the resolver MUST treat EVERY feature flag within that capability as enabled — including standalone flags that are not part of any `allowed_*_types` array. The `flexible ||` prefix MUST be applied to every individual feature check, not just group-level allowed-type arrays.

**Why flexible exists**: Flexible allows admins to grant a tier full access to a capability without individually seeding every feature key into `tier_features_list`. Higher tiers (e.g., organization, chain) get `*_flexible` instead of dozens of individual feature rows. This is a powerful convenience — but only if resolvers honor it universally.

**Pattern**:
```ts
const flexible = !!features.featured_flexible;

// CORRECT — flexible unlocks everything:
expiryMonitorEnabled: flexible || !!features.featured_expiry_monitor,
customBadgeSlotsEnabled: flexible || !!features.featured_custom_badge_slots,
const staticEnabled = flexible || !!feat.chatbot_static_enabled;

// WRONG — flexible is ignored, feature stays disabled even on flexible tiers:
expiryMonitorEnabled: !!features.featured_expiry_monitor,
const staticEnabled = !!feat.chatbot_static_enabled;
```

**Audit rule**: For every `!!features.<key>` or `!!feat.<key>` check in a resolver, verify that `flexible ||` precedes it. The only exceptions are the master gate checks themselves (`*_enabled`, `*_disabled`, `*_flexible`) which define `enabled`, `disabled`, and `flexible` — these are the inputs, not the consumers, of the flexible logic.

**Common trap**: Standalone flags added outside the group structure (e.g., `featured_expiry_monitor`, `featured_custom_badge_slots`) are the most likely to miss the `flexible ||` prefix because they don't follow the `if (flexible) { push(...all) } else { if (feat.x) push(x) }` array pattern. Always check standalone boolean flags.

### R18: Cross-Capability Constraints Are Post-Resolution
Cross-capability constraints MUST run as a post-resolution pass, never inside individual resolvers. Individual resolvers remain pure functions of `(features, merchantPrefs)`. The Cross-Capability Constraint Layer (CCL) operates on the assembled `effective` manifest after all resolvers complete.

**Rationale**: Keeping individual resolvers isolated preserves their testability, reusability, and parallel execution. The CCL is a separate concern — it's about relationships between capabilities, not about individual capability resolution.

**Implementation**: `applyCrossCapabilityConstraints()` in `CapabilityConstraintResolver.ts` runs after the `Promise.all` of individual resolvers in `EffectiveCapabilityResolver.ts` (Step 5.5).

### R19: Constraint Violations Are Surfaced, Not Silently Applied
When a `block` constraint is violated, the CCL MUST:
1. Add the violation to `constraint_violations` array in the response
2. Mark the affected type in the source capability's `constraint_status.blocked_types`
3. NOT silently change the `effective_type` or `enabled` field

**Rationale**: Silently changing effective states would be confusing. The frontend uses `blocked_types` to prevent selection in the UI and show constraint messages.

### R20: Constraint Registry Is the Single Source of Truth
All cross-capability constraints MUST be defined in the `capability_constraints_list` DB table (admin-managed via `/api/admin/capability-constraints`). The static `CAPABILITY_CONSTRAINTS` array in `CapabilityConstraintRegistry.ts` serves as a fallback when the DB is unavailable or empty. No ad-hoc constraint checks in individual resolvers, routes, or frontend components.

**DB-driven loading**: `CapabilityConstraintService.getActiveConstraints()` loads from the DB with a 60-second in-memory cache. Admin CRUD operations call `invalidateConstraintCache()` to ensure immediate propagation. The `applyCrossCapabilityConstraints()` and `validateProposedChange()` functions in `CapabilityConstraintResolver.ts` are async — they load constraints via `getActiveConstraints()` rather than reading the static array directly.

### R21: Constraints Are Declarative
Constraints are declared as data (source target, target target, type, severity), not as imperative code. The `CapabilityConstraintResolver` evaluates all constraints uniformly. Constraints are stored in the `capability_constraints_list` DB table and managed via the admin API at `/api/admin/capability-constraints` (GET, POST, PUT, DELETE). The static `CAPABILITY_CONSTRAINTS` array in `CapabilityConstraintRegistry.ts` is the seed/fallback only.

### R22: Write-Time Validation Mirrors Read-Time Evaluation
PUT handlers in settings routes MUST use `validateProposedChange()` from `CapabilityConstraintResolver.ts` to validate settings changes before persisting. The function is **async** — it loads constraints from the DB via `getActiveConstraints()`. The evaluation logic is identical to read-time — the only difference is the input (simulated effective state vs. current effective state).

### R23: Subscription-Status Override Must Include Every Write-Capable Domain
`EffectiveCapabilityResolver.ts` Step 6 applies a subscription-status override after all resolvers run. When `internalStatus` is `frozen`, `canceled`, or `expired` (`isReadOnly`), it sets `enabled = false` on write-heavy capabilities. When `internalStatus` is `maintenance` or `past_due` (`isLimited`), it disables a subset.

**When adding a new capability domain, it MUST be added to the appropriate override block**:
- **`isReadOnly` block** (frozen/canceled/expired): Add `result.effective.<domain>.enabled = false` if the capability involves writes, purchases, or active operations. Read-only display capabilities (storefront, CRM, FAQ, featured, directory entry, storefront options, product options, org options) are intentionally left `enabled = true` so the UI shows them in read-only mode.
- **`isLimited` block** (maintenance/past_due): Add `result.effective.<domain>.enabled = false` if the capability involves creating new entities or purchases. Maintenance mode allows editing existing content but not growth actions.

**Common pitfall**: Resolvers MUST NOT fail-open when nothing at all is enabled in the domain. The default is **disabled** only when no `_enabled`, no `_disabled`, no `_flexible`, AND no individual features are enabled. If any individual feature is enabled, the capability is implicitly enabled (R17 step 4). The Step 6 override remains the safety net for frozen/canceled tenants.

**Also update `buildExpiredCapabilitiesResponse`** in `tenant-capabilities.ts` with a fully-disabled entry for the new domain (see R13).

### R24: Frontend Status Derivation Must Match Backend
The frontend `deriveInternalStatus()` in `apps/web/src/lib/subscription-status.ts` MUST mirror the backend logic in `apps/api/src/utils/subscription-status.ts`. When the backend adds a new tier-to-status mapping (e.g., `expired_trial` → `frozen`), the frontend must be updated in lockstep.

**Prefer backend-provided status**: Components that receive `AllCapabilitiesState` (from the effective-capabilities endpoint) SHOULD use `capabilities.subscriptionContext.internalStatus` as the primary source, with `deriveInternalStatus()` as a fallback for when capabilities data is not yet loaded. This avoids drift between backend and frontend derivation logic.

**Pattern** (see `storefront-type-settings.ts` and `product-type-settings.ts`):
```ts
// 1. Resolve current effective capabilities
const currentCaps = await resolveEffectiveCapabilities(tenantId);
if (currentCaps) {
  // 2. Deep-clone and simulate the proposed change
  const simulated = JSON.parse(JSON.stringify(currentCaps.effective));
  simulated.<capability>.effective_type = data.selected_type;
  // 3. Validate — returns only 'block' severity violations
  const blockViolations = await validateProposedChange(simulated);
  if (blockViolations.length > 0) {
    return res.status(403).json({
      success: false,
      error: 'constraint_violation',
      message: blockViolations[0].message,
      resolution_hint: blockViolations[0].resolution_hint,
      violations: blockViolations,
    });
  }
}
```

**When to add write-time validation**: Add CCL validation to PUT handlers that change a capability's `effective_type` or `enabled` state. Only `block` severity constraints are enforced at write-time — `warn` and `info` severity constraints surface in the UI only (read-time).

### R25: Settings Page `isTierAllowed` Must Use `allowed*Types`, Not Effective Flags or `isFlexible`-Only

The `isTierAllowed` function in settings pages (e.g., `SocialCommerceSettingsClient.tsx`, `BotOptionsPage.tsx`, `CrmOptionsPage.tsx`) determines whether a feature toggle is enabled or shows 'Not in your plan'. This function MUST use `allowed*Types` arrays for tier permission checks — NOT effective flags (`*Enabled`, `metaEnabled`, `tiktokEnabled`) and NOT `isFlexible` as the sole gate.

**Why effective flags are wrong here**: Effective flags like `metaEnabled` combine tier permission AND merchant opt-in (`tierAllowed && merchantEnabled`). When the merchant hasn't toggled a feature on, the effective flag is `false` even if the tier grants it — causing the settings page to show 'Not in your plan' for features the tier actually allows.

**Why `isFlexible`-only is wrong**: Using `isFlexible` as the only tier gate blocks ALL tier-gated features for non-flexible tiers, even when the tier individually grants those features. Non-flexible tiers (e.g., `professional`, `growth`) have specific features enabled via `tier_features_list` — `isFlexible` only covers top-tier (e.g., `organization`, `chain`).

**Correct patterns**:
```ts
// CORRECT — group toggle uses array length:
if (key === 'social_commerce_meta_enabled') return tierState.allowedMetaTypes.length > 0;
if (key === 'social_commerce_tiktok_enabled') return tierState.allowedTikTokTypes.length > 0;

// CORRECT — individual feature uses array includes:
if (key.startsWith('social_commerce_meta_')) return tierState.allowedMetaTypes.includes(key as any);

// CORRECT — chatbot tier-gated feature checks specific allowed arrays:
const isAllowed = !isTierGated || (chatbotCaps && (
  chatbotCaps.isFlexible ||
  (feature.key === 'chatbot_dynamic_enabled' && chatbotCaps.allowedResponseEngines.length > 0) ||
  (feature.key === 'chatbot_skills_enabled' && chatbotCaps.allowedSkillTypes.length > 0)
));

// WRONG — uses effective flag (conflates tier + merchant):
if (key === 'social_commerce_meta_enabled') return tierState.metaEnabled;  // ❌ false when merchant hasn't opted in

// WRONG — uses isFlexible as sole gate (blocks non-flexible tiers):
const isAllowed = !isTierGated || (chatbotCaps && chatbotCaps.isFlexible);  // ❌ blocks professional/growth tiers
```

**Audit checklist for settings pages**:
1. For each `isTierAllowed(key)` branch, verify it checks `allowed*Types.includes(key)` or `allowed*Types.length > 0` — not `*Enabled` or `*Available`
2. For features with `tierGate: true` flag, verify the gate checks the specific `allowed*Types` array — not just `isFlexible`
3. Group toggles (e.g., `social_commerce_meta_enabled`) MUST use `allowed*Types.length > 0`, not the group's effective flag

### R26: `CAPABILITY_DISPLAY` Settings Paths Must Point to Actual Settings Page

The `settingsPath` in the `CAPABILITY_DISPLAY` map in `PlanSummaryPanel.tsx` MUST point to the actual settings page URL — not a parent route or dashboard. A wrong path causes the 'Configure' button to navigate to the wrong page.

**Common pitfall**: Chatbot settings are at `/bot/options`, but the path was set to `/bot` (the bot dashboard). Always verify the path matches the actual route in `apps/web/src/app/t/[tenantId]/`.

**Verification**: When adding or updating a `CAPABILITY_DISPLAY` entry, click the 'Configure' link in PlanSummaryPanel to verify it navigates to the correct settings page.

### R27: Org Standing Mode — Asymmetric Inheritance for Subscription Status Only

The `org_standing_mode` column on `tenants` (`'independent'` default, `'inherited'`) controls **subscription-status gating only**. It does NOT affect tier feature resolution, capability merging, or the MV.

**How it works** (implemented in `EffectiveCapabilityResolver.ts` Step 6, lines 249-270):
1. If `org_standing_mode = 'inherited'` AND the org is in good standing (`active`, `trialing`, or `past_due`), the tenant's `effectiveStatus` is lifted to `'active'` — even if the tenant's own status is `frozen`, `canceled`, or `expired`.
2. If the org is also in bad standing, the tenant's own status is the floor — no change.
3. The tenant's **tier is NEVER replaced**. Capabilities are always resolved from the tenant's own tier. Org tier only gates org-level features (`org_options`, propagation).

**Grace period** (`standing_mode_grace_until`): When an org falls out of good standing, inherited tenants get a 7-day grace period (`ORG_STANDING_GRACE_DAYS = 7`). The `org-standing-inheritance.ts` batch job:
- Sets `standing_mode_grace_until = now() + 7 days` on inherited tenants
- Sends CRM alerts to affected tenants
- After grace expires: auto-flips `org_standing_mode` to `'independent'` and clears the timestamp
- If org recovers: clears grace timestamps and sends "coverage restored" alerts

**Key rule for new capability domains**: Standing mode does NOT change how you add capabilities. The Step 6 override (R23) already uses the standing-mode-aware `effectiveStatus`. When adding a new domain to the `isReadOnly`/`isLimited` override blocks, the standing mode logic is already applied upstream — no additional changes needed.

**`tier_change_logs_list`**: Audit trail for tier system admin changes. Does NOT affect resolution at runtime. Used by `/api/admin/tier-system/change-logs` for compliance tracking.

**`tier_catalog_permissions`**: Tier-level permissions for the global supplier catalog (browse, add, edit, remove). Separate from capability resolution — gates catalog management actions, not feature flags.

### R28: Platform Communication Channels — Route-Level Create Gate, Not Blanket Disable

Some capabilities are **platform communication channels** (e.g., CRM) that must remain accessible even for frozen/canceled/expired tenants. The `EffectiveCapabilityResolver` Step 6 override (R23) already keeps these capabilities `enabled = true` for read-only accounts. However, **route handlers MUST NOT independently re-gate access** by calling `CrmOptionsService.resolveCrmOptionsState()` or similar service-level checks that bypass the Step 6 override.

**Problem pattern** (what NOT to do):
```ts
// ❌ Route handler calls CrmOptionsService directly — bypasses EffectiveCapabilityResolver Step 6
async function checkCrmEnabled(tenantId, res) {
  const state = await CrmOptionsService.getInstance().resolveCrmOptionsState(tenantId);
  if (!state.enabled) return res.status(403).json({ error: 'merchant_gate_disabled' });
}
// Applied to ALL routes (GET, PUT, POST) — blocks read access for frozen tenants
```

**Correct pattern** — split into Read/Update (always allowed) vs Create (subscription-gated):
```ts
// ✅ No gate on GET/PUT routes — CRM is always accessible for viewing and responding
router.get('/tickets', ...);
router.put('/tickets/:ticketId', ...);
router.post('/tickets/:ticketId/messages', ...);  // replying to existing tickets = Update, not Create

// ✅ Create gate only on POST routes that create new entities
async function checkCrmCreateAllowed(tenantId, res): Promise<boolean> {
  const tenant = await prisma.tenants.findUnique({ where: { id: tenantId }, select: { ... } });
  const internalStatus = deriveInternalStatus({ ... });
  if (['frozen', 'canceled', 'expired'].includes(internalStatus)) {
    res.status(403).json({ error: 'subscription_read_only', message: '...' });
    return false;
  }
  return true;
}

router.post('/tickets', ...);  // checkCrmCreateAllowed gates this
router.post('/contacts', ...); // checkCrmCreateAllowed gates this
```

**Key rules**:
1. **GET and PUT routes**: No subscription-status gate. Frozen tenants can view tickets, tasks, alerts, inquiries, activities, and respond to existing tickets (POST messages = Update, not Create).
2. **POST routes that create new entities**: Gate with `checkCrmCreateAllowed` which checks `deriveInternalStatus()`. Returns 403 `subscription_read_only` for frozen/canceled/expired.
3. **POST routes that are responses** (e.g., `POST /tickets/:ticketId/messages`): NOT gated — these are Update operations (receive and respond), not Create.
4. **Frontend**: Dashboard widgets and support pages MUST always render (no `crmEnabled` conditional). Pass `isWritable` prop from `subscriptionContext.writable` to conditionally hide create-action buttons (e.g., "New Ticket"). Do NOT set a `crmDisabled` state based on API error messages — the API no longer returns `merchant_gate_disabled` for CRM routes.

**When to apply this pattern**: Any capability that serves as a platform-to-tenant communication channel (CRM, alerts, notifications). These are NOT feature benefits that should be revoked — they're the mechanism for resolving subscription issues. Apply the RU (Read/Update) vs C (Create) split rather than blanket CRUD disabling.

### R29: Frontend `isWritable` Prop Pattern for Read-Only Capabilities

When a capability remains visible but write-restricted for read-only accounts, frontend components MUST accept an `isWritable` prop (defaulting to `true`) and conditionally hide create-action UI elements — NOT hide the entire component.

**Pattern**:
```tsx
interface WidgetProps {
  tenantId?: string;
  isWritable?: boolean;  // defaults to true
}

export default function Widget({ tenantId, isWritable = true }: WidgetProps) {
  // Always render the widget — show data, allow interactions
  return (
    <div>
      {/* Always show data */}
      <TicketList tickets={tickets} />

      {/* Conditionally show create button */}
      {isWritable && <NewTicketButton onClick={...} />}
    </div>
  );
}
```

**Parent components** pass `isWritable` from the capabilities hook:
```tsx
const allCaps = useAllCapabilities(tenantId);
const isWritable = allCaps.data?.subscriptionContext?.writable ?? true;
<Widget tenantId={tenantId} isWritable={isWritable} />
```

**Do NOT**:
- Set a `disabled` state based on API error messages (`merchant_gate_disabled`, etc.)
- Hide the entire widget/component when subscription is read-only
- Block API calls preemptively — let the backend `checkCrmCreateAllowed` gate handle it

## File Reference

### Backend
- Resolvers: `apps/api/src/services/resolvers/XxxResolver.ts`
- Types: `apps/api/src/services/resolvers/types.ts`
- Orchestrator: `apps/api/src/services/EffectiveCapabilityResolver.ts`
- API Routes: `apps/api/src/routes/xxx-options-settings.ts`
- Unified endpoint: `apps/api/src/routes/tenant-capabilities.ts` → `GET /:tenantId/effective-capabilities`
- Expired fallback: `apps/api/src/routes/tenant-capabilities.ts` → `buildExpiredCapabilitiesResponse()`
- CCL Registry (static fallback): `apps/api/src/services/resolvers/CapabilityConstraintRegistry.ts`
- CCL Resolver (evaluation engine): `apps/api/src/services/resolvers/CapabilityConstraintResolver.ts`
- CCL Service (DB loader + cache): `apps/api/src/services/resolvers/CapabilityConstraintService.ts`
- CCL Admin API: `apps/api/src/routes/admin/capability-constraints.ts` → `/api/admin/capability-constraints`
- CCL Metadata API: `apps/api/src/routes/admin/capability-constraints.ts` → `GET /api/admin/capability-constraints/metadata` (static `CONSTRAINT_METADATA` constant — MUST be updated when adding a new capability domain)

### Frontend
- State types: `apps/web/src/services/CapabilityResolutionService.ts`
- Unified mapper: `apps/web/src/services/UnifiedCapabilityService.ts`
- React hooks: `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts`
- Tenant API base: `apps/web/src/providers/base/TenantApiSingleton.ts`
- Plan summary: `apps/web/src/components/settings/PlanSummaryPanel.tsx`
- Capability showcase: `apps/web/src/components/dashboard/CapabilityShowcase.tsx`

### Settings Pages
- Each capability has a settings page at `apps/web/src/app/t/[tenantId]/settings/xxx/`
- Settings page uses `useXxxCapability` hook for tier state + `xxxOptionsService.getOptions()` for merchant prefs
