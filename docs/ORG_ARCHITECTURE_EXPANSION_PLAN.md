# Organization Architecture Expansion — Phased Plan

> **Date**: 2026-06-21  
> **Status**: Draft — awaiting approval  
> **Scope**: Org-level PlanSummaryPanel, Org Bot Widget, Org Capability Rollup, BSaaS integration  
> **Skills consulted**: `add-bsaas-feature.md`, `bot-widget-troubleshooting.md`, `skill-frontend-ux-guardrails`

---

## Current State

### What exists (tenant-level)
- `PlanSummaryPanel` — shows tier name + capability grid (commerce, payment, storefront, barcode, fulfillment, product, featured, integrations, quickstart, storefront options, FAQ, CRM, directory, chatbot) with per-feature enabled/gated/tier-blocked status
- `PublicBotWidget` — configurable chatbot widget (position, color, greeting, avatar)
- `BotDashboardChat` — fixed bottom-right platform assistant, capability-aware
- `BotTenantWidget` — tenant-level bot status card
- `CrmTenantWidget` — tenant CRM ticket summary
- `CapabilityShowcase` — visual capability display
- Per-tenant bot API: `GET /api/tenants/:tenantId/bot/config`, `/bot/analytics`, `/bot/dashboard`, `/bot/skills`

### What exists (org-level, just completed)
- `OrgCapabilityService` + `useOrgCapabilities` + `useOrgTabAccess` — tab/panel gating via `organization_options` capability type
- `OrgLockedTab` — locked tab placeholder with upgrade CTA
- `OrgBillingCard`, `OrgSystemStatusCard`, `OrgKpiGrid`, `OrgUsageGauges` — org KPIs and billing
- `OrgCrmSummaryCard` — cross-location CRM ticket aggregation
- `OrgTaskChecklist`, `OrgQuickLinks`, `OrgRecommendationsCard` — action-oriented panels
- `OrgTeamOverview`, `OrgEmployeeDistribution` — team rollup
- `OrgPropagationPanel` — hero sync + category sync

### What's missing (gaps from spec G6-G10)
- **G6**: No org-level capability rollup or plan summary
- **G9**: No chatbot/bot visibility at org level — no cross-location bot health, no org bot widget
- **G10**: No capability rollup across chain locations
- **G10d**: No `org_bot_management` feature (gated to `chain_enterprise` per spec)

---

## Phased Plan

### Phase 1: OrgPlanSummaryPanel (Frontend-only, leverages existing data)

**Goal**: Show org-level tier info + capability gate summary (tabs, panels, propagation types) on the Capabilities tab.

**Why first**: Pure frontend, no backend changes. The `OrgCapabilityService` already returns `OrgCapabilitiesState` with `allowedTabs`, `allowedPanels`, `allowedPropagationTypes`, `enabled`, `isFlexible`, `tier`. This is the org-level equivalent of `PlanSummaryPanel`.

**Components**:
- `OrgPlanSummaryPanel.tsx` — renders:
  - Tier name + badge (from `OrgCapabilitiesState.tier`)
  - Org capability grid: tabs (enabled/locked), panels (enabled/gated), propagation types (enabled/gated)
  - Color-coded status: green (enabled), amber (flexible/merchant-gated), red (tier-locked)
  - Links to upgrade page for locked items
- Wire into Capabilities tab in `OrganizationDashboard.tsx`

**UX guardrails** (from skill):
- Stable card dimensions, no layout shift on data load
- Loading skeleton state
- Empty state if `orgCaps.enabled === false`
- Responsive: 2-col grid on desktop, 1-col on mobile (320px)
- Dark mode support

**Files**:
| File | Action |
|------|--------|
| `apps/web/src/components/organization/OrgPlanSummaryPanel.tsx` | NEW |
| `apps/web/src/components/organization/OrganizationDashboard.tsx` | EDIT — add to Capabilities tab |

**Verification**: `pnpm checkweb`

---

### Phase 2: OrgCapabilityRollup (Frontend + lightweight backend endpoint)

**Goal**: Show capability status across all locations in the chain — "Commerce: 3/5 enabled, 1 gated, 1 tier-blocked" etc.

**Why second**: Requires a new backend endpoint to batch-fetch capabilities across org locations. The spec already designed this (`OrgCapabilityRollup.tsx`, lines 360-365).

**Backend**:
- New endpoint: `GET /api/organizations/:orgId/capability-rollup`
- Iterates `locationBreakdown`, calls `resolveEffectiveCapabilities(tenantId)` per location
- Aggregates counts per capability domain: `{ domain, enabledCount, gatedCount, tierBlockedCount, totalLocations }`
- Cache result (5-min TTL) since it fans out N queries

**Frontend**:
- `OrgCapabilityRollup.tsx` — table with:
  - Rows: Commerce, Storefront, Fulfillment, Barcode, FAQ, CRM, Chatbot, Product Options, Featured, Integrations
  - Columns: Capability, Enabled/Locations, Gated, Tier-Blocked
  - Click row → expand to show per-location breakdown
  - Select location → render `PlanSummaryPanel` for that location (reuse existing component)
- Wire into Capabilities tab below `OrgPlanSummaryPanel`

**UX guardrails**:
- Table must not require horizontal scroll at 320px — degrade to stacked cards
- Loading state: skeleton rows
- Error state: "Failed to load capability data for N locations"
- Stable column widths, no shift on data load

**Files**:
| File | Action |
|------|--------|
| `apps/api/src/routes/organization-capabilities.ts` | EDIT — add rollup endpoint |
| `apps/web/src/services/OrgCapabilityService.ts` | EDIT — add `getCapabilityRollup()` |
| `apps/web/src/hooks/organization/useOrgCapabilityRollup.ts` | NEW |
| `apps/web/src/components/organization/OrgCapabilityRollup.tsx` | NEW |
| `apps/web/src/components/organization/OrganizationDashboard.tsx` | EDIT — add to Capabilities tab |

**Verification**: `pnpm checkapi && pnpm checkweb`

---

### Phase 3: OrgBotStatusCard (Frontend + backend aggregation)

**Goal**: Show cross-location chatbot health — which locations have bot enabled, conversation counts, active vs inactive, embedding status.

**Why third**: Introduces org-level bot visibility (gap G9). Uses existing per-tenant bot endpoints but aggregates them. Gated behind `org_bot_management` feature (chain_enterprise tier).

**Backend**:
- New endpoint: `GET /api/organizations/:orgId/bot-status`
- For each location in org:
  - Fetch bot config status (active/inactive) via `BotConfigurationService.getOrCreate()`
  - Fetch dashboard stats (conversation count, message count) via `BotConversationService.getDashboardStats()`
  - Fetch embedding status via `BotRagService.hasEmbeddings()` + `hasProductEmbeddings()`
- Aggregate: `{ locations: [{ tenantId, tenantName, botActive, conversationCount, hasFaqEmbeddings, hasProductEmbeddings }], totalActive, totalInactive }`
- Cache 5-min TTL

**Frontend**:
- `OrgBotStatusCard.tsx` — card showing:
  - Summary row: "Bot Active: 3/5 locations"
  - Mini table: Location | Status | Conversations | FAQ KB | Product KB
  - Status badges: Active (green), Inactive (gray), No KB (amber)
  - Link to per-location bot config: `/t/[tenantId]/bot`
- Gate with `isPanelAllowed` or new `org_bot_management` feature check
- Wire into Overview tab right column (after `OrgCrmSummaryCard`) and Capabilities tab

**UX guardrails**:
- Card must fit in right column (lg:col-span-1) without overflow
- Location names truncate with tooltip at 320px
- Loading skeleton with stable height
- Empty state: "No chatbot configured at any location"

**Files**:
| File | Action |
|------|--------|
| `apps/api/src/routes/organization-capabilities.ts` | EDIT — add bot-status endpoint |
| `apps/web/src/services/OrgCapabilityService.ts` | EDIT — add `getBotStatus()` |
| `apps/web/src/hooks/organization/useOrgBotStatus.ts` | NEW |
| `apps/web/src/components/organization/OrgBotStatusCard.tsx` | NEW |
| `apps/web/src/components/organization/OrganizationDashboard.tsx` | EDIT — add to Overview + Capabilities tabs |

**Verification**: `pnpm checkapi && pnpm checkweb`

---

### Phase 4: OrgBotWidget (Org-level chatbot widget)

**Goal**: Render a chatbot widget on the Organization Dashboard that can answer questions about any location in the chain.

**Why fourth**: Builds on Phase 3's bot status. This is the interactive widget — more complex than a status card. Uses the existing `BotDashboardChat` pattern but with org-level context.

**Backend**:
- New endpoint: `POST /api/organizations/:orgId/bot/chat`
- Accepts `{ message, sessionId }`
- Uses `BotDynamicResponseService` with org-level context (all location names, org name, chain-wide stats)
- System prompt includes org context: "You are the assistant for [OrgName] with N locations: [location1, location2, ...]"
- Session tracking keyed by `orgId` (not `tenantId`)

**Frontend**:
- `OrgBotWidget.tsx` — fixed bottom-right chat widget:
  - Reuses `PublicBotWidget` styling/position patterns
  - Avatar fallback chain: org logo → platform logo → robot emoji
  - Greeting: "Hi! I'm the assistant for [OrgName]. Ask me about any of your locations."
  - Only renders when `orgCaps.orgAvailable && orgCaps.enabled`
  - Capability gate: `org_bot_management` feature
- Wire into `OrganizationDashboard.tsx` as fixed-position element

**UX guardrails** (from bot-widget-troubleshooting skill):
- Position: bottom-right, `z-50`, no overlap with sticky headers
- Toast dismissal: use filtered `Toaster.tsx` pattern (filter `t.open !== false`)
- Avatar fallback: org logo → platform logo → emoji
- Responsive: widget must not overflow at 320px — collapse to FAB on mobile
- Loading state: typing indicator
- Error state: "Failed to send message" with retry button
- Keyboard accessible: focus trap when open, Esc to close

**Files**:
| File | Action |
|------|--------|
| `apps/api/src/routes/organization-capabilities.ts` | EDIT — add chat endpoint |
| `apps/api/src/services/OrgBotService.ts` | NEW — org-level bot context builder |
| `apps/web/src/services/OrgCapabilityService.ts` | EDIT — add `sendChatMessage()` |
| `apps/web/src/components/organization/OrgBotWidget.tsx` | NEW |
| `apps/web/src/components/organization/OrganizationDashboard.tsx` | EDIT — render widget |

**Verification**: `pnpm checkapi && pnpm checkweb`

---

### Phase 5: BSaaS Integration for Org Features (Backend + frontend)

**Goal**: Enable à la carte purchasing of org-level features (bot management, branding control, advanced propagation) for tiers that don't bundle them.

**Why last**: Depends on Phases 1-4 being complete so the purchased features have UI to unlock. Follows the `add-bsaas-feature.md` skill pattern.

**Database**:
- Ensure `org_bot_management` feature key exists in `features_list` and is linked to `organization_options` capability type via `capability_features_list`
- Enable in `tier_features_list` for `chain_enterprise` (bundled)
- Available for purchase via `tenant_feature_purchases` for `chain_starter` and `chain_professional`

**Backend** (automatic per BSaaS skill):
- `EffectiveCapabilityResolver.fetchRawCapabilities()` already merges purchases — no resolver changes needed
- `resolveOrgOptions()` already checks feature flags — purchased `org_bot_management` will automatically appear in `allowedPanels`/`allowedTabs`
- Admin API at `/api/admin/feature-purchases` already handles grant/revoke

**Frontend**:
- `OrgLockedTab` already shows upgrade CTA — enhance to show "Purchase" option for BSaaS-eligible features
- `OrgPlanSummaryPanel` — show "Purchased" badge for features enabled via BSaaS (requires `purchased_feature_keys` in API response — see BSaaS skill Case 3)
- Add "Purchase" button next to locked capabilities that redirects to a checkout flow

**UX guardrails**:
- "Purchased" badge visually distinct from "Included" (use amber badge)
- Purchase button only shows for BSaaS-eligible features (not all locked features)
- Confirm dialog before purchase: "Purchase [Feature] for $X/month? This will be added to your invoice."
- Disabled state while purchase is processing

**Files**:
| File | Action |
|------|--------|
| `database/migrations/050_org_bsaas_features.sql` | NEW — seed `org_bot_management` + other org BSaaS features |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | EDIT — add `purchased_feature_keys` to output |
| `apps/web/src/services/OrgCapabilityService.ts` | EDIT — map `purchased_feature_keys` |
| `apps/web/src/components/organization/OrgPlanSummaryPanel.tsx` | EDIT — show "Purchased" badge |
| `apps/web/src/components/organization/OrgLockedTab.tsx` | EDIT — add purchase option |

**Verification**: `pnpm checkapi && pnpm checkweb` + SQL verification queries

---

## Dependency Graph

```
Phase 1 (OrgPlanSummaryPanel)
  ↓ no dependency
Phase 2 (OrgCapabilityRollup)
  ↓ uses PlanSummaryPanel for per-location detail
Phase 3 (OrgBotStatusCard)
  ↓ no dependency on 1-2
Phase 4 (OrgBotWidget)
  ↓ depends on Phase 3 (bot status confirms bot is active)
Phase 5 (BSaaS Integration)
  ↓ depends on Phases 1-4 (features need UI to unlock)
```

## Effort Estimates

| Phase | Backend | Frontend | Total | Risk |
|-------|---------|----------|-------|------|
| 1 | 0 | ~150 LOC | Low | Low — pure frontend |
| 2 | ~100 LOC | ~250 LOC | Medium | Medium — N+1 fan-out, needs caching |
| 3 | ~120 LOC | ~200 LOC | Medium | Medium — aggregates 3 services per location |
| 4 | ~200 LOC | ~300 LOC | High | High — new chat endpoint, session management |
| 5 | ~50 LOC + SQL | ~100 LOC edits | Medium | Low — follows established BSaaS pattern |

## Open Questions

1. **Phase 2**: Should the capability rollup batch-fetch be a single SQL query (faster but complex) or N parallel API calls (simpler but slower)? Recommend: parallel calls with 5-min cache, optimize later if needed.
2. **Phase 4**: Should the org bot widget share sessions with tenant-level bot, or have separate org-level sessions? Recommend: separate sessions keyed by `orgId`.
3. **Phase 5**: Which org features should be BSaaS-eligible vs tier-locked only? The spec lists `org_bot_management` and `org_branding_control` as enterprise-only. Should these be purchasable à la carte?
4. **Phase 5**: Do we need a checkout flow for BSaaS purchases, or is admin-grant sufficient for now?
