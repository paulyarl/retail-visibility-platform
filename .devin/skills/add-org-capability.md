---
description: How to implement organization-level capabilities — org dashboard feature gating, cross-location bot aggregation, org-level chat, and BSaaS purchases for org features
---

# Org-Level Capability Implementation Guide

Use this skill when building organization-level (chain-level) features that aggregate or gate capabilities across all locations in an organization. Covers the org dashboard architecture, bot status rollup, org-level chat widget, and à la carte BSaaS purchasing of org features.

## Architecture Overview

The org dashboard system has **4 layers**:

```
1. Database Layer       → organization_options capability type + org_ prefixed feature keys
2. Backend Resolver      → resolveOrgOptions() maps features to allowedTabs/allowedPanels/allowedPropagationTypes
3. Backend Routes        → /api/organizations/:orgId/* endpoints (effective-capabilities, bot-status, bot/chat/*)
4. Frontend Layer        → OrgCapabilityService + React hooks + components
```

**Key principle**: Org-level features use `organization_options` capability type with `org_` prefixed feature keys. The org endpoint fetches tier features for the org's `subscription_tier`, merges BSaaS purchases from the hero tenant, and resolves via `resolveOrgOptions()`.

## Database Schema

### Feature Keys (049_organization_options_capability.sql)

All org feature keys use the `org_` prefix:

| Feature Key | Purpose |
|-------------|---------|
| `org_enabled` | Master switch for org dashboard |
| `org_flexible` | Grants all tabs/panels/propagation types |
| `org_tab_locations` | Locations tab access |
| `org_tab_propagation` | Propagation tab access |
| `org_tab_capabilities` | Capabilities tab access |
| `org_tab_team` | Team tab access |
| `org_tab_commerce` | Commerce tab access |
| `org_panel_task_checklist` | Task Checklist panel |
| `org_panel_quick_links` | Quick Links panel |
| `org_panel_system_status` | System Status panel |
| `org_panel_recommendations` | Recommendations panel |
| `org_panel_crm_summary` | CRM Summary panel |
| `org_propagation_products` | Product propagation toggle |
| `org_propagation_categories` | Category propagation toggle |
| `org_propagation_business_info` | Business info propagation toggle |
| `org_propagation_settings` | Settings propagation toggle |
| `org_bot_management` | BSaaS — chain-wide bot management |
| `org_branding_control` | BSaaS — chain-wide branding control |

### Tier Assignments

| Tier | Features |
|------|----------|
| `chain_starter` | overview + billing + locations + task_checklist + quick_links + system_status + propagation_products |
| `chain_professional` | All chain_starter + propagation + capabilities + team + commerce + recommendations + crm_summary + all propagation types |
| `chain_enterprise` | Everything (org_flexible = true) + org_bot_management + org_branding_control |

**Note**: `chain_enterprise` may have `is_active = false` in the database. SQL migrations should NOT filter by `is_active = true` when looking up this tier.

### `features_list` Table Schema

```sql
-- IMPORTANT: features_list does NOT have is_highlighted or metadata columns
-- Use: key, name, description, category, is_active, sort_order, created_at, updated_at
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES ('org_my_feature', 'My Feature', 'Description', 'organization', true, 100, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET ...;
```

### `tier_features_list` Table Schema

```sql
-- IMPORTANT: tier_features_list uses feature_key (TEXT), NOT feature_id (UUID)
-- Required columns: id, tier_id, capability_type_id, feature_key, feature_name,
--   is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name
INSERT INTO tier_features_list (
  id, tier_id, capability_type_id, feature_key, feature_name,
  is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name
) VALUES (
  gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'org_my_feature', 'My Feature',
  true, false, '{"capability_type": "organization_options"}'::jsonb, false, 0, NULL
)
ON CONFLICT DO NOTHING;
```

## Backend Implementation

### Org Capabilities Endpoint

**File**: `apps/api/src/routes/organization-capabilities.ts`

```
GET  /api/organizations/:orgId/effective-capabilities
GET  /api/organizations/:orgId/bot-status
POST /api/organizations/:orgId/bot/chat/start
POST /api/organizations/:orgId/bot/chat/message
```

The effective-capabilities endpoint:
1. Fetches org with `subscription_tier`
2. Resolves effective tier (handles tier inheritance)
3. Fetches `tier_features_list` for `organization_options` capability type
4. Merges BSaaS purchases from hero tenant (`tenant_feature_purchases` where `feature_key` starts with `org_`)
5. Calls `resolveOrgOptions(features, true)` to get allowed arrays
6. Returns result with `purchased_feature_keys` array

### OrgBotService

**File**: `apps/api/src/services/OrgBotService.ts`

Singleton service that builds org-level bot context:
- Fetches org name, all location names, hero tenant
- Builds system prompt addition for org-aware conversations
- Generates custom greeting mentioning the org name

### Bot Status Aggregation

The `GET /:orgId/bot-status` endpoint:
1. Fetches all tenants in the org
2. For each tenant, fetches: bot config, conversation count, embedding flags
3. Aggregates: active bot count, total conversations, locations with/without bots
4. Returns summary with per-location breakdown

### Org Chat Endpoints

The org chat endpoints reuse the hero tenant's bot infrastructure:
- `POST /bot/chat/start` — creates conversation via `BotConversationService` with org-level context from `OrgBotService`
- `POST /bot/chat/message` — processes message through the full bot pipeline (guardrails → intents/skills → dynamic GPT → static fallback)

## Frontend Implementation

### Service Layer

**File**: `apps/web/src/services/OrgCapabilityService.ts`

Key types:
```ts
interface OrgCapabilitiesState {
  enabled: boolean;
  isFlexible: boolean;
  allowedTabs: OrgTabKey[];
  allowedPanels: OrgPanelKey[];
  allowedPropagationTypes: OrgPropagationType[];
  orgAvailable: boolean;
  tier?: { key: string; name: string; description: string };
  purchasedFeatureKeys?: string[];
}
```

Methods:
- `getOrgCapabilities(orgId)` — fetches and caches org capabilities
- `getBotStatus(orgId)` — fetches cross-location bot status
- `getCapabilityRollup(orgId)` — fetches per-location capability summary
- `startOrgBotChat(orgId)` — starts org-level bot conversation
- `sendOrgBotMessage(orgId, sessionId, message)` — sends message in org conversation

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `OrgPlanSummaryPanel` | `apps/web/src/components/organization/OrgPlanSummaryPanel.tsx` | Tier summary with included/purchased/locked badges |
| `OrgCapabilityRollup` | `apps/web/src/components/organization/OrgCapabilityRollup.tsx` | Per-location capability grid |
| `OrgBotStatusCard` | `apps/web/src/components/organization/OrgBotStatusCard.tsx` | Cross-location bot health |
| `OrgBotWidget` | `apps/web/src/components/organization/OrgBotWidget.tsx` | Fixed bottom-right org-level chat widget |
| `OrgLockedTab` | `apps/web/src/components/organization/OrgLockedTab.tsx` | Locked tab placeholder with upgrade + purchase options |
| `OrganizationDashboard` | `apps/web/src/components/organization/OrganizationDashboard.tsx` | Main dashboard integrating all components |

### Purchased vs Included Badge Logic

`OrgPlanSummaryPanel` uses three status types:
- **`enabled`** (green) — feature included in tier
- **`purchased`** (amber) — feature enabled via BSaaS purchase
- **`locked`** (gray) — feature not available

Feature key mapping for purchased check:
- Tabs: `org_tab_${tabKey}` (e.g., `org_tab_locations`)
- Panels: `org_panel_${panelKey}` (e.g., `org_panel_crm_summary`)
- Propagation: direct key (e.g., `org_propagation_products`)

### OrgLockedTab BSaaS Props

```tsx
<OrgLockedTab
  tabLabel="Bot Management"
  tierName="Chain Enterprise"
  bsaasEligible={true}
  bsaasPrice={49}
  featureKey="org_bot_management"
/>
```

When `bsaasEligible` is true, shows "Purchase for $49/mo" button alongside "Upgrade Plan".

## BSaaS Purchase Flow for Org Features

### How It Works

1. Org features are purchased at the **hero tenant** level via `tenant_feature_purchases`
2. The org effective-capabilities endpoint queries `tenant_feature_purchases` for the hero tenant with `feature_key` starting with `org_`
3. Active, non-expired purchases are merged as enabled features
4. `purchased_feature_keys` array is returned in the API response
5. Frontend uses `purchasedFeatureKeys` to show amber "Purchased" badges

### Bundle Engagement Caveat for Org Features

The `checkBundleEngagement()` function in `bsaas-purchases.ts` runs `checkCapabilityEngagement()` for **every** component in a bundle. If a bundle includes `org_flexible` (capability type `organization_options`), any tenant whose tier has **zero** features in `organization_options` will be blocked from purchasing the **entire bundle** — not just the org component.

This is why the Everything Pack was split into two variants:
- **Everything Pack** (16 components, no `org_flexible`) — purchasable by non-org tiers (e.g., Professional)
- **Everything Pack + Org** (17 components, with `org_flexible`) — only purchasable by tiers with org engagement (e.g., chain tiers)

When creating bundles that include org features, consider whether all target tiers have `organization_options` engagement. Non-chain tiers (Starter, Professional, etc.) typically have no org features in their `tier_features_list`, so any bundle containing `org_flexible` will be blocked for them.

### Adding a New BSaaS Org Feature

1. **SQL migration**: Insert feature key into `features_list` with `category: 'organization'`
2. **Link to capability type**: Insert into `capability_features_list` with `capability_type_id` for `organization_options`
3. **Enable for enterprise**: Insert into `tier_features_list` for `chain_enterprise` (bundled)
4. **Backend**: The org endpoint auto-merges purchases — no resolver changes needed
5. **Frontend**: Add feature key to the `isPurchased()` check in `OrgPlanSummaryPanel`
6. **OrgLockedTab**: Pass `bsaasEligible={true}` and `bsaasPrice` when rendering the locked tab

### Granting a Purchase (Admin API)

```bash
curl -X POST /api/admin/feature-purchases \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "hero-tenant-uuid",
    "feature_key": "org_bot_management",
    "source": "bsaas",
    "expires_at": null
  }'
```

The org endpoint will automatically pick up the purchase on the next request (cache TTL: 60s).

## SQL Migration Patterns

### Pattern: Insert feature into features_list

```sql
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES ('org_my_feature', 'My Feature', 'Description', 'organization', true, 100, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW();
```

### Pattern: Link to capability type

```sql
DO $$
DECLARE v_cap_type_id TEXT;
BEGIN
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'organization_options' LIMIT 1;
  INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
  SELECT v_cap_type_id, fl.id, true, 100, NOW(), NOW()
  FROM features_list fl WHERE fl.key = 'org_my_feature'
  ON CONFLICT DO NOTHING;
END $$;
```

### Pattern: Enable for a tier

```sql
DO $$
DECLARE v_tier_id TEXT; v_cap_type_id TEXT;
BEGIN
  SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = 'chain_enterprise' LIMIT 1;
  SELECT id INTO v_cap_type_id FROM capability_type_list WHERE key = 'organization_options' LIMIT 1;
  INSERT INTO tier_features_list (id, tier_id, capability_type_id, feature_key, feature_name,
    is_enabled, is_inherited, metadata, is_highlighted, highlight_order, marketing_name)
  VALUES (gen_random_uuid()::text, v_tier_id, v_cap_type_id, 'org_my_feature', 'My Feature',
    true, false, '{"capability_type": "organization_options"}'::jsonb, false, 0, NULL)
  ON CONFLICT DO NOTHING;
END $$;
```

**Common pitfalls**:
- Do NOT filter `subscription_tiers_list` by `is_active = true` — `chain_enterprise` may be inactive
- Do NOT use `feature_id` in `tier_features_list` — use `feature_key` (TEXT)
- Do NOT include `is_highlighted` or `metadata` columns in `features_list` INSERTs
- Use `ON CONFLICT DO NOTHING` unless you know the exact unique constraint exists

## File Reference

| File | Purpose |
|------|---------|
| `database/migrations/049_organization_options_capability.sql` | Seeds org feature keys + tier assignments |
| `database/migrations/050_org_bsaas_features.sql` | Seeds org_bot_management + org_branding_control BSaaS features |
| `apps/api/src/routes/organization-capabilities.ts` | All org-level API endpoints |
| `apps/api/src/services/OrgBotService.ts` | Org-level bot context builder |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Tenant-level resolver (includes purchased_feature_keys) |
| `apps/api/src/services/resolvers/OrgOptionsResolver.ts` | `resolveOrgOptions()` — maps features to allowed arrays |
| `apps/api/src/services/resolvers/types.ts` | Type definitions for org capabilities |
| `apps/web/src/services/OrgCapabilityService.ts` | Frontend service for org capabilities + bot chat |
| `apps/web/src/components/organization/OrgPlanSummaryPanel.tsx` | Tier summary with purchased/included/locked badges |
| `apps/web/src/components/organization/OrgCapabilityRollup.tsx` | Per-location capability grid |
| `apps/web/src/components/organization/OrgBotStatusCard.tsx` | Cross-location bot health card |
| `apps/web/src/components/organization/OrgBotWidget.tsx` | Org-level chatbot widget |
| `apps/web/src/components/organization/OrgLockedTab.tsx` | Locked tab with upgrade + purchase options |
| `apps/web/src/components/organization/OrganizationDashboard.tsx` | Main org dashboard |

## Testing Checklist

- [ ] `pnpm checkapi` passes (zero TS errors)
- [ ] `pnpm checkweb` passes (zero TS errors)
- [ ] SQL migration runs without errors
- [ ] Verification queries return expected rows
- [ ] `GET /api/organizations/:orgId/effective-capabilities` returns `purchased_feature_keys` array
- [ ] `GET /api/organizations/:orgId/bot-status` returns aggregated bot status
- [ ] `POST /api/organizations/:orgId/bot/chat/start` returns session with org-aware greeting
- [ ] `POST /api/organizations/:orgId/bot/chat/message` returns bot reply
- [ ] OrgPlanSummaryPanel shows amber badges for purchased features
- [ ] OrgLockedTab shows "Purchase Add-on" button when `bsaasEligible` is true
- [ ] OrgBotWidget renders as fixed bottom-right widget when org capabilities are enabled

## Related Documents

- `.devin/skills/add-bsaas-feature.md` — Companion guide for tenant-level BSaaS purchases
- `.devin/skills/add-capability-feature.md` — Guide for adding new feature keys
- `docs/ORG_ARCHITECTURE_EXPANSION_PLAN.md` — Full 5-phase plan for org dashboard
