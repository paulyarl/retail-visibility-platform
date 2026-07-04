---
description: How to add, gate, and surface a new capability in the RVP tier-based feature system
---

# Capability System Integration Guide

This document describes how to add a new tier-gated capability to the VisibleShelf platform so it flows correctly from definition through to the merchant gate settings page.

## Architecture Overview

The capability system has **5 layers**, all of which must be updated for a new capability to work end-to-end:

```
1. Definition Layer (code)     → canonical-features.ts + tier-hierarchies.ts
2. Database Layer (seeded)     → capability_type_list + tier_features_list + features_list
3. Resolver Layer (runtime)    → Backend resolver (e.g., FeaturedOptionsResolver.ts)
4. Route Layer (API)           → Settings PUT route + unified endpoint GET
5. Frontend Layer (merchant)   → Settings page + UnifiedCapabilityService mapper
```

**Unified endpoint** (`GET /api/tenants/:tenantId/effective-capabilities`) is the single source of truth for all capability state. It performs a single DB round-trip, dispatches to per-domain resolvers, and returns pre-resolved effective state. The frontend `UnifiedCapabilityService` maps this response — it does not resolve.

## Step-by-Step: Adding a New Capability

### 1. Definition Layer

**File**: `packages/feature-definitions/src/definitions/canonical-features.ts`

Add a new entry to `CANONICAL_FEATURES`:

```ts
'my_capability': {
  key: 'my_capability',
  name: 'My Capability',
  description: 'What this capability does',
  category: 'product' | 'commerce' | 'analytics' | 'branding' | 'integration' | 'ui',
  metadata: { ... }
},
```

**File**: `packages/feature-definitions/src/definitions/tier-hierarchies.ts`

Add the capability key to the appropriate tier's feature array. Features cascade upward via spread (`...LOWER_TIER_FEATURES`).

- `DISCOVERY_FEATURES` (level 1)
- `STARTER_FEATURES` (level 2)
- `STOREFRONT_FEATURES` (level 3)
- `COMMITMENT_FEATURES` (level 4)
- `PROFESSIONAL_FEATURES` (level 5)
- Enterprise inherits from Professional

### 2. Database Layer

Seed the capability into the database. Follow the pattern in `apps/api/prisma/seed-crm-capabilities.ts`:

1. **`capability_type_list`** — Create a capability type entry (e.g., key=`featured_options`)
2. **`features_list`** — Create feature entries for each toggle (e.g., `featured_expiry_monitor`)
3. **`capability_features_list`** — Link features to the capability type
4. **`tier_features_list`** — Enable features per tier with `is_enabled` and `is_inherited` flags

Also add columns to the tenant settings table if the capability has a merchant-togglable preference:

```sql
ALTER TABLE tenant_featured_options_settings
ADD COLUMN featured_expiry_monitor Boolean DEFAULT false;
```

Update the Prisma schema model to match (`apps/api/prisma/schema.prisma`).

### 3. Resolver Layer

Each capability domain has a backend resolver in `apps/api/src/services/resolvers/` (e.g., `FeaturedOptionsResolver.ts`, `CrmOptionsResolver.ts`).

**Pattern**:
- Export a `resolve{Domain}Options` function accepting `(features, merchantPrefs)`
- Map tier feature keys → `allowed_*` arrays / booleans
- Apply merchant soft toggles → `effective_*` arrays / booleans
- Return an `Effective{Domain}` object (add the interface to `resolvers/types.ts`)

The orchestrator `EffectiveCapabilityResolver.ts` fetches all merchant settings in a single DB round-trip, then dispatches to each resolver.

Add the new capability flag to:
- The `Effective{Domain}` interface in `resolvers/types.ts`
- The resolver's `resolveFromFeatures()` or main resolution function
- The `getDisabledState()` equivalent (return object with all flags `false`)

Example:
```ts
// In resolvers/types.ts
export interface BackendEffectiveFeaturedOptions {
  enabled: boolean;
  allowed_types: string[];
  effective_types: string[];
  expiry_monitor_enabled: boolean;  // NEW
  merchant_preferences: {
    featured_enabled: boolean;
    featured_expiry_monitor: boolean;  // NEW
    // ...
  };
}

// In FeaturedOptionsResolver.ts
export function resolveFeaturedOptions(
  features: Record<string, boolean>,
  merchantSettings: FeaturedOptionsMerchantSettings | null
): BackendEffectiveFeaturedOptions {
  const allowedTypes = [...]; // from features
  const prefs = merchantSettings || {};

  return {
    enabled: allowedTypes.length > 0,
    allowed_types: allowedTypes,
    effective_types: allowedTypes.filter(t =>
      t !== 'expiry_monitor' ? prefs[`featured_${t}`] !== false : prefs.featured_expiry_monitor !== false
    ),
    expiry_monitor_enabled: flexible || !!features.featured_expiry_monitor,  // NEW — MUST prefix with flexible (R23)
    merchant_preferences: {
      featured_enabled: !!prefs.featured_enabled,
      featured_expiry_monitor: !!prefs.featured_expiry_monitor,  // NEW
      // ...
    },
  };
}
```

### 4. Route Layer

**File**: `apps/api/src/routes/*-options-settings.ts`

Each capability domain has a settings route with:

- **PUT** endpoint — validates each toggle against tier capabilities before saving, then invalidates the unified cache
- **GET** endpoint — returns tier-gate-filtered settings (authenticated, for settings pages)
- **Public GET** — deprecated; the unified endpoint (`/effective-capabilities`) is now the single source of truth for storefront rendering

For the PUT endpoint, add the new field to:
1. Zod validation schema
2. Default settings object
3. All-false return objects (when tier gate is disabled)
4. Tier-filtered settings construction
5. PUT response object

**Tier-gate enforcement pattern**:
```ts
// GET: force off if tier doesn't have capability
tierFilteredSettings.featured_expiry_monitor =
  !!rawSettings.featured_expiry_monitor && tierState.expiryMonitorEnabled;

// PUT: reject enabling if tier doesn't have capability
if (key === 'featured_expiry_monitor') {
  if (value && !tierState.expiryMonitorEnabled) {
    return res.status(403).json({ error: 'tier_restricted', ... });
  }
  filteredData[key] = value;
  continue;
}
```

**Cache invalidation** (critical):
```ts
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

// After successful prisma update in PUT handler:
await invalidateEffectiveCapabilities(tenantId);
```

This ensures the unified endpoint serves fresh data on the next request.

### 4.5 Cross-Capability Constraint Layer (If Applicable)

If the new capability has a dependency on another capability's type or state (e.g., "service storefront requires service product type"), add a cross-capability constraint.

**DB-driven** (primary): Insert into `capability_constraints_list` table via SQL migration or admin API at `/api/admin/capability-constraints`:

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

**Static fallback** (also add to `CapabilityConstraintRegistry.ts`):
```ts
{
  id: 'my_constraint_id',
  type: 'requires',
  severity: 'block',
  source: { capability: 'my_capability', field: 'effective_type', operator: 'equals', value: 'my_type' },
  target: { capability: 'other_capability', field: 'allowed_types', operator: 'includes', value: 'my_type' },
  message: 'My capability requires Other capability type',
  resolution_hint: 'Enable Other capability type or select a different type',
}
```

**Write-time validation** (for `block` severity constraints): Add to the PUT handler after the tier gate:
```ts
import { validateProposedChange } from '../services/resolvers';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

// After tier gate passes, before persisting:
if (data.selected_type) {
  const currentCaps = await resolveEffectiveCapabilities(tenantId);
  if (currentCaps) {
    const simulated = JSON.parse(JSON.stringify(currentCaps.effective));
    simulated.my_capability.effective_type = data.selected_type;
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
}
```

**Key points**:
- `validateProposedChange()` is **async** — it loads constraints from DB via `getActiveConstraints()`
- Only `block` severity constraints are enforced at write-time; `warn` and `info` surface in the UI only
- See `capability-data-flow-rules.md` Rules R18-R22 for full details
- See `capability-deployment-flow.md` Phase 4.5 for the complete workflow

**Also update `CONSTRAINT_METADATA`**: Add an entry for the new capability domain in the `CONSTRAINT_METADATA` constant in `apps/api/src/routes/admin/capability-constraints.ts`. Include the capability key, label, and all fields from the `EffectiveXxx` interface with correct `value_type` (`string`, `boolean`, or `array`), valid `operators`, and suggested `values`. Without this, the new capability won't appear in the Source/Target dropdowns in the Add Constraint modal.

### 5. Frontend Layer

**Settings page**: `apps/web/src/app/t/[tenantId]/settings/<capability>-options/`

- Add field to the settings interface
- Add to `useState` default
- Add to `loadSettings` response mapping
- Add a UI card/section with a `Switch` component
- Use `useXxxCapability(tenantId)` hook to get effective state from `UnifiedCapabilityService`
- Disable the switch when the unified state shows the feature is not allowed by tier
- Show "Not included in your plan" or "Professional plan and above" label

**UnifiedCapabilityService mapper**: `apps/web/src/services/UnifiedCapabilityService.ts`

- Add the new backend field to the `BackendEffective{Domain}` interface
- Map it in the `map{Domain}` function into the frontend state object
- The mapper should preserve `enabled` at the top level and expose `effective_*` values
- Do not add resolution logic — the backend already resolved everything

**PlanSummaryPanel**: `apps/web/src/components/settings/PlanSummaryPanel.tsx`

- Uses `capabilities` prop from `AllCapabilitiesState` (mapped from unified endpoint)
- Each card shows enabled/disabled status using `capability.enabled` (not `Object.keys(capability.features).length`)
- New sub-capabilities under an existing group appear automatically if the unified endpoint returns them

**TenantDashboardV2**: `apps/web/src/components/dashboard/TenantDashboardV2.tsx`

- `CapabilityShowcase` component renders capability cards on the dashboard
- `useAllCapabilities` hook provides the full capability state from `UnifiedCapabilityService`

**CapabilityShowcase**: `apps/web/src/components/dashboard/CapabilityShowcase.tsx`

- The "Your Capabilities" card on the tenant dashboard — each capability appears as a row with icon, status badge, detail text, and a link to its settings page
- Add a row to the `rows` array in the `useMemo` block for the new capability:
  - Extract state from `cap.<domain>Options` (e.g. `cap.chatbotOptions`)
  - Compute `tier` (is the capability available at the tier level?) and `merchantGated` (is it partially disabled by merchant prefs?)
  - Provide `label`, `icon` (from lucide-react), `detail` (list active sub-features or "Not available"), and `settingsLink`
- A capability missing from this array will not appear on the dashboard even if it works functionally

**TierFeaturesClient**: `apps/web/src/app/t/[tenantId]/settings/tier-features/TierFeaturesClient.tsx`

- The tier comparison page at `/t/[tenantId]/settings/tier-features` — shows resolved capabilities and a comparison table grouped by capability domain
- Add an entry to the `CAPABILITY_META` array with: the capability type key (must match `CAPABILITY_FEATURE_PREFIXES` output), a human-readable label, and the `*_flexible` feature key(s) for the domain
- Add a corresponding entry in the `summarizeResolvedCapabilities` function that reads from the `AllCapabilitiesState` domain field and returns `{ key, label, enabled, flexible, detail }`
- A capability missing from `CAPABILITY_META` will not appear in the comparison table or the resolved capabilities section

## Key Patterns

### Backend Resolvers
All resolution happens in backend resolvers under `apps/api/src/services/resolvers/`. Each resolver is a pure function — not a class singleton:

```ts
import { resolveFeaturedOptions } from '../services/resolvers/FeaturedOptionsResolver';
const state = resolveFeaturedOptions(features, merchantSettings);
```

The orchestrator `EffectiveCapabilityResolver.ts` calls all resolvers in parallel after a single DB round-trip.

### Frontend Mapping (No Resolution)
The frontend `UnifiedCapabilityService` only maps. It calls the unified endpoint once and converts backend shapes to frontend types:

```ts
const commerceState = await unifiedCapabilityService.getCommerceState(tenantId);
// commerceState is pre-resolved; no client-side logic needed
```

Do not add resolution logic in the frontend. If you need a new computed field, add it to the backend resolver.

### Most-Permissive-Wins
When a tenant belongs to an organization with a higher tier, features are merged as a union — the most permissive tier wins. This is handled by `getMergedTierFeatures()` in the orchestrator before dispatching to resolvers.

### Trial Tier Transparency
Use `getEffectiveTier()` from `utils/trial-tier-transparency.ts` to map trial tiers to their base tiers for feature resolution. This happens in the orchestrator before resolver dispatch.

### Tier-Capability SQL
For raw SQL queries that need to gate by capability, use the SQL fragments in `utils/tier-capability-sql.ts`:
- `TIER_CAPABILITY_CTE` — builds a CTE with per-tier feature flags
- `TIER_CAPABILITY_WHERE` — AND clause for tier gate
- `TENANT_PREFS_WHERE` — AND clause for merchant preference gate

### Scheduled Jobs
When a scheduled job needs to check a capability, call the unified endpoint (or use the resolver directly if you already have the features map):

```ts
// Option A: call unified endpoint (respects cache)
const allCaps = await effectiveCapabilityResolver.getEffectiveCapabilities(tenantId);
if (!allCaps.featured.expiry_monitor_enabled) continue;

// Option B: use resolver directly (if you have features already)
const featuredState = resolveFeaturedOptions(features, merchantSettings);
if (!featuredState.expiry_monitor_enabled) continue;
```

This ensures the job respects both the tier gate AND the merchant's toggle preference.

## Existing Capability Domains

| Domain | Backend Resolver | Settings Table | Settings Route | Frontend Mapper |
|--------|----------------|---------------|----------------|-----------------|
| Commerce | `CommerceResolver.ts` | `tenant_commerce_settings` | `commerce-settings.ts` | `mapCommerce` |
| Payment Gateway | `PaymentGatewayResolver.ts` | `tenant_payment_gateway_settings` | `payment-gateway-settings.ts` | `mapPaymentGateway` |
| Storefront Type | `StorefrontTypeResolver.ts` | `tenant_storefront_type_settings` | `storefront-type-settings.ts` | `mapStorefront` |
| Fulfillment | `FulfillmentResolver.ts` | `tenant_fulfillment_settings` | `fulfillment-settings.ts` | `mapFulfillment` |
| Product Type | `ProductTypeResolver.ts` | `tenant_product_types_settings` | `product-type-settings.ts` | `mapProductType` |
| Product Options | `ProductOptionsResolver.ts` | `tenant_product_options_settings` | `product-options-settings.ts` | `mapProductOptions` |
| Featured Options | `FeaturedOptionsResolver.ts` | `tenant_featured_options_settings` | `featured-options-settings.ts` | `mapFeatured` |
| Storefront Options | `StorefrontOptionsResolver.ts` | `tenant_storefront_options_settings` | `storefront-options-settings.ts` | `mapStorefrontOptions` |
| Integration | `IntegrationOptionsResolver.ts` | `tenant_integration_settings` | `integration-options-settings.ts` | `mapIntegration` |
| Quickstart | `QuickstartOptionsResolver.ts` | `tenant_quickstart_options_settings` | `quickstart-options-settings.ts` | `mapQuickstart` |
| FAQ | `FaqOptionsResolver.ts` | `tenant_faq_options_settings` | `faq-options-settings.ts` | `mapFaqOptions` |
| CRM | `CrmOptionsResolver.ts` | `tenant_crm_options_settings` | `crm-options-settings.ts` | `mapCrmOptions` |
| Chatbot | `ChatbotOptionsResolver.ts` | `tenant_chatbot_options_settings` | `chatbot-options-settings.ts` | `mapChatbot` |
| Barcode Scan | `BarcodeScanResolver.ts` | `tenant_barcode_scan_settings` | `barcode-scan-options-settings.ts` | `mapBarcodeScan` |

All backend resolvers are pure functions called by `EffectiveCapabilityResolver.ts`. The frontend `UnifiedCapabilityService` maps their output. The old `*OptionsService` classes are deprecated.

## Advanced Patterns from the Chatbot Integration

The chatbot capability introduced several patterns that future capabilities should follow, especially complex domains with sub-categories, flexible-tier organizations, and public-facing APIs.

### Flexible-Tier Pattern (`*_flexible` feature key)

Organization tiers (`chain_starter`, `chain_professional`, `organization`) get a `*_flexible` feature key (e.g., `chatbot_flexible`) instead of individual feature flags. When `flexible` is true, the resolver unlocks all sub-types without checking each individually. This allows admins to grant a tier full access to a capability without individually seeding every feature key into `tier_features_list`.

**R23 (mandatory)**: The `flexible ||` prefix MUST be applied to EVERY individual feature check in the resolver — not just group-level allowed-type arrays. Standalone boolean flags (e.g., `featured_expiry_monitor`, `featured_custom_badge_slots`) are the most commonly missed because they don't follow the `if (flexible) { push(...all) } else { ... }` array pattern.

```ts
// In ChatbotOptionsResolver.ts
const flexible = !!feat.chatbot_flexible;

// Group flags — flexible unlocks all groups:
const staticEnabled = flexible || !!feat.chatbot_static_enabled;
const dynamicEnabled = flexible || !!feat.chatbot_dynamic_enabled;

// Allowed arrays — flexible unlocks everything:
if (flexible) {
  allowedResponseEngines.push('chatbot_static_lookup', 'chatbot_shared_dynamic', 'chatbot_lora_finetuned', 'chatbot_dedicated');
} else {
  if (feat.chatbot_static_lookup) allowedResponseEngines.push('chatbot_static_lookup');
  // ... per-feature gating
}

// Standalone flags — MUST also prefix with flexible:
expiryMonitorEnabled: flexible || !!features.featured_expiry_monitor,
customBadgeSlotsEnabled: flexible || !!features.featured_custom_badge_slots,
```

This pattern is used by CRM, FAQ, Chatbot, Featured Options, Storefront Options, Product Options, Directory Entry, and Social Commerce. Any new capability that needs org-tier full access should define a `<domain>_flexible` feature key and follow the same pattern. See R23 in `capability-data-flow-rules.md` for the full rule.

### Sub-Category Allowed Arrays

Complex capabilities group their features into sub-categories with `allowed_*` arrays. The chatbot has four:

- `allowed_response_engines` — static lookup, shared dynamic, LoRA fine-tuned, dedicated
- `allowed_skill_types` — product search, inventory, order tracking, store hours, cross-merchant
- `allowed_kb_types` — static FAQ, RAG retrieval, product-scoped, gap report, auto-sync
- `allowed_widget_types` — embed, custom theme, skill cards, after hours

The resolver builds these from individual feature flags (or unlocks all when `flexible`). The route layer's `TIER_GATE_MAP` then maps merchant toggles to these arrays for enforcement.

### TIER_GATE_MAP in Route Layer

The settings route uses a `TIER_GATE_MAP` to validate merchant PUT requests against multiple possible tier feature keys. This handles cases where a merchant toggle maps to more than one tier feature:

```ts
// In chatbot-options-settings.ts
const TIER_GATE_MAP: Record<string, string[]> = {
  chatbot_static_enabled: ['chatbot_static_enabled', 'chatbot_static_lookup', 'chatbot_flexible'],
  chatbot_dynamic_enabled: ['chatbot_dynamic_enabled', 'chatbot_shared_dynamic', 'chatbot_flexible'],
  chatbot_widget_custom_theme: ['chatbot_widget_custom_theme', 'chatbot_flexible'],
  // ...
};

// PUT handler: check if any gate feature is enabled
const isAllowed = tierState.is_flexible || gateFeatures.some(gk =>
  (caps.effective.chatbot as any)[gk] ||
  tierState.allowed_response_engines.includes(gk as any) ||
  tierState.allowed_skill_types.includes(gk as any) ||
  tierState.allowed_kb_types.includes(gk as any) ||
  tierState.allowed_widget_types.includes(gk as any)
);
```

This pattern should be used when a merchant toggle could be unlocked by either a broad category flag, a specific sub-type flag, or the flexible override.

### Public API Routes (Unauthenticated)

The chatbot introduced public-facing API routes that bypass `authenticateToken` middleware. These are mounted separately from the authenticated settings routes:

```ts
// In src/index.ts (not in mounts/*.ts)
app.use('/api/tenants', chatbotOptionsSettingsRoutes);  // includes public/tenant/:tenantId/* endpoint
app.use('/api', chatbotOptionsSettingsRoutes);          // dual mount for /api/public/tenant/* path
app.use('/api/public/bot', botPublicRoutes);            // fully public bot widget API
app.use('/api/tenants/:tenantId/bot', authenticateToken, botMerchantRoutes); // authenticated merchant API
```

Key rules for public routes:
- **Never expose merchant preferences or internal config** — the public endpoint returns only a minimal subset (e.g., `chatbot_enabled`, `chatbot_static_enabled`, `chatbot_widget_enabled`)
- **Always check capability via `resolveEffectiveCapabilities()`** before serving — the tier gate is the security boundary
- **Set deprecation headers** on legacy public endpoints that are superseded by the unified endpoint
- **Rate limit** public endpoints (the bot uses in-memory per-session rate limiting)

### Service Layer Beyond Settings

The chatbot demonstrates that a capability domain can have extensive backend services beyond just settings CRUD. The chatbot has 11 services in `apps/api/src/services/`:

| Service | Purpose |
|---------|---------|
| `BotConfigurationService` | Per-tenant bot config (name, tone, greeting, widget appearance) |
| `BotConversationService` | Session management, 24h expiry, message storage, archival, GDPR erase |
| `BotStaticResponseService` | Free-tier FAQ keyword matching (exact → Jaccard similarity → fallback) |
| `BotDynamicResponseService` | GPT-powered responses with RAG context + multi-turn history |
| `BotGuardrailService` | Rule-based safety filtering (banned phrases, PII, moderation, competitor) |
| `BertGuardrailService` | BERT toxicity detection (Transformers.js, falls back to rule-based) |
| `BotIntentService` | Keyword-based intent detection with Jaccard similarity |
| `BertIntentService` | BERT zero-shot intent classification (Transformers.js, falls back to keyword) |
| `BotSkillService` | Skill execution with tier/capability/status gating |
| `BotRagService` | FAQ/product chunking, OpenAI embeddings, pgvector similarity search |
| `BotCrmIntegrationService` | Escalation from bot conversations to CRM support tickets |
| `BotBusinessHoursService` | After-hours detection from `business_hours_list` |
| `BotProductCatalogService` | Product search via `mv_storefront_discovery` materialized view |

These services use the capability resolver for tier gating at runtime:
```ts
const caps = await resolveEffectiveCapabilities(tenantId);
if (!caps?.effective.chatbot.enabled) return res.status(403).json({ error: 'capability_disabled' });
const useDynamic = caps.effective.chatbot.dynamic_enabled && dynamicResponseService.isAvailable();
```

### Frontend Service Pattern (Tenant-Scoped vs Public)

The chatbot introduced two frontend service singletons:

- **`BotService`** (extends `TenantApiSingleton`) — authenticated merchant dashboard operations (config CRUD, conversation list, skills, analytics)
- **`PublicBotService`** (extends `PublicApiSingleton`) — unauthenticated widget operations (fetch config, start conversation, send message, submit feedback)

Use this dual-service pattern when a capability has both merchant-facing admin UI and customer-facing public touchpoints.

### Embeddable Widget (Shadow DOM)

The chatbot ships an embeddable widget as static assets in `apps/web/public/bot-widget/`. Key patterns:

- **Shadow DOM** encapsulation to avoid CSS/JS conflicts with the host page
- **`data-tenant-id`** auto-init from script attributes (no build step required for merchants)
- **localStorage session resume** with 24h TTL matching the backend session expiry
- **Progressive enhancement**: widget fetches config first, only renders if `status === 'active'`
- **Capability-gated rendering**: the widget calls `/api/public/bot/config` which checks `resolveEffectiveCapabilities` server-side

### Prisma Schema for Complex Capabilities

The chatbot added 10 Prisma models beyond the settings table. When a capability needs persistent storage:

1. Add models to `schema.prisma` with proper foreign keys to `tenants`
2. Use `@db.Uuid` for IDs with `@default(dbgenerated("gen_random_uuid()"))`
3. Add `@@index` for query-critical columns
4. For vector columns (pgvector), use `Unsupported("vector")?` — Prisma can't natively handle vector types, so use `$queryRaw` for vector operations
5. Run `prisma db pull` after migrations to sync the schema

### Migration Conflict Resolution

When merging feature branches that add Prisma models, merge conflicts in `schema.prisma` are common. The resolution pattern:

1. Keep both sides' additions (enums, models)
2. Ensure each enum/model has its own closing brace
3. Remove all `<<<<<<< HEAD`, `=======`, `>>>>>>> branch` markers
4. Run `pnpm prisma db pull` to verify the schema is valid
5. If `db pull` brings in DB-side changes, review them before committing
