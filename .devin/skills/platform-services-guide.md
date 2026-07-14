---
description: How to add and manage platform-offered services (logo design, banners, store setup) sold through the BSaaS store with no merchant gate, using the platform_services capability type
---

# Platform Services Guide

This document describes how to sell platform-offered professional services to merchants through the existing BSaaS store infrastructure. Services like logo design, banner design, store setup, and profile setup are registered as a special capability type (`platform_services`) that behaves like an automated backend capability — no merchant gate, no settings table, one-time billing.

## Architecture Overview

```
Merchant browses Feature Store
  → sees bsaas_catalog entries (platform_service_logo_design, etc.)
  → clicks Purchase
  → bsaas-purchases.ts charges via Stripe (one_time billing)
  → creates tenant_feature_purchases record
  → invalidateEffectiveCapabilities() fires
  → PlatformServiceResolver picks up purchased feature key
  → EffectivePlatformServices reflects purchased service as enabled
  → PlatformServiceFulfillmentService auto-creates (fire-and-forget):
      ├─ CRM ticket (category: 'platform_service', status: 'open')
      ├─ CRM tasks (service-specific workflow steps with due dates)
      └─ CRM alert (notifies merchant service has started)
  → platform staff manage fulfillment via existing CRM admin UI:
      ├─ Global Tickets page (filtered by category: 'platform_service')
      ├─ Tasks Kanban board (workflow steps)
      └─ Ticket detail page (messages, activities, status transitions)
  → ticket status: open → in_progress → resolved = fulfillment: pending → in_progress → delivered
  → merchant sees progress in their tenant CRM portal + receives alerts
```

### Key Distinction from Normal BSaaS Features

| Aspect | Normal BSaaS Feature (e.g. chatbot_skill_*) | Platform Service (e.g. platform_service_logo_design) |
|--------|---------------------------------------------|------------------------------------------------------|
| Capability type | Existing (e.g. `chatbot_options`) | `platform_services` (dedicated) |
| Merchant gate | Yes — `MERCHANT_GATE_MAP` + `PARENT_GATE_FEATURES` | **No** — not in either map |
| Merchant settings table | Yes (e.g. `tenant_chatbot_options_settings`) | **No** — no settings table |
| Resolver input | `features` + `merchantPrefs` | `features` only |
| Billing cycle | Usually `monthly` | `one_time` |
| Renewal job | Processes recurring billing | Skips `one_time` purchases |
| Capability engagement | Tier must have ≥1 feature in capability type | Bypassed — `platform_services_enabled` seeded into all tiers |
| Fulfillment | Self-service (feature activates immediately) | Human fulfillment — CRM ticket + tasks + alerts (existing CRM architecture) |

### Closest Analog

The `wholesale_matching_options` capability is the closest architectural analog — simple resolver, minimal merchant gate. Platform services go further by eliminating the merchant gate entirely and using one-time billing.

Reference files:
- Resolver: `apps/api/src/services/resolvers/WholesaleMatchingResolver.ts`
- Migration: `database/migrations/106_wholesale_matching_capability.sql`
- Types: `apps/api/src/services/resolvers/types.ts` — `EffectiveWholesaleMatching`

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  tier_features_list                                                  │
│  (all tiers get platform_services_enabled=true)                      │
│  → satisfies checkCapabilityEngagement()                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────────┐
│  bsaas_catalog                                                       │
│  (platform_service_logo_design, platform_service_banner_design,     │
│   platform_service_store_setup, etc. — one_time billing)            │
│  → merchant purchases via Feature Store                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────────┐
│  tenant_feature_purchases                                            │
│  (source: 'bsaas', status: 'active', billing_cycle: 'one_time')     │
│  → PlatformServiceFulfillmentService creates CRM ticket + tasks    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────────┐
│  CRM Architecture (existing, reused)                                 │
│  → crm_support_tickets (category: 'platform_service')               │
│  → crm_tasks (workflow steps with due dates)                        │
│  → crm_alerts (merchant notifications)                              │
│  → crm_activities (auto-logged on status/assignment changes)        │
│  → Admin UI: Global Tickets, Tasks Kanban, Ticket Detail (messages) │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────────┐
│  EffectiveCapabilityResolver.fetchRawCapabilities()                  │
│  → merges tier features + purchased feature keys                     │
│  → groups by capability_type_list (platform_services)                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────────┐
│  resolvePlatformServices(features)                                   │
│  → returns EffectivePlatformServices                                 │
│  → allowed_services = purchased service keys                         │
│  → can_use_* flags for each service                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## How to Add a New Platform Service

### Step 1: Add Feature Key

Insert into `features_list`:
```sql
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'platform_service_my_new_service',
  'My New Service',
  'Description of the service',
  'platform_services',
  true,
  200,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, ...;
```

### Step 2: Link to Capability Type

```sql
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
SELECT ct.id, f.id, true, 200, NOW(), NOW()
FROM capability_type_list ct, features_list f
WHERE ct.key = 'platform_services' AND f.key = 'platform_service_my_new_service'
ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET is_active = true, sort_order = 200;
```

### Step 3: Add to BSaaS Catalog

```sql
INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, trial_eligible, demo_eligible, is_private)
VALUES (
  'platform_service_my_new_service',
  'My New Service',
  'Description for the Feature Store',
  9900,
  'one_time',
  0,
  true,
  200,
  false,
  false,
  false
)
ON CONFLICT (feature_key) DO UPDATE SET ...;
```

### Step 4: Add Workflow Template

In `apps/api/src/services/PlatformServiceFulfillmentService.ts`, add a workflow template to `SERVICE_WORKFLOW_TEMPLATES`:
```typescript
my_new_service: [
  { title: 'Step 1', description: 'Description', dueDays: 2 },
  { title: 'Step 2', description: 'Description', dueDays: 5 },
  { title: 'Final delivery', description: 'Deliver to merchant', dueDays: 7 },
],
```

### Step 5: Update Resolver

In `apps/api/src/services/resolvers/PlatformServiceResolver.ts`, add the new service key to `SERVICE_KEYS` array.

In `apps/api/src/services/resolvers/types.ts`, add the new type to `PlatformServiceType` union and add `can_use_my_new_service` to `EffectivePlatformServices`.

### Step 6: Update Frontend Mapping

In `apps/web/src/services/CapabilityResolutionService.ts`, add to `PlatformServiceType` and `PlatformServicesState`.
In `apps/web/src/services/UnifiedCapabilityService.ts`, add to `BackendEffectivePlatformServices` and `mapPlatformServices()`.

### Step 7: Verify

- `pnpm checkapi` — zero TS errors
- `pnpm checkweb` — zero TS errors
- New service appears in Feature Store
- Purchase creates `tenant_feature_purchases` record
- Purchase auto-creates CRM ticket with `category: 'platform_service'`
- Purchase auto-creates workflow tasks on Kanban board
- Merchant receives CRM alert about service start
- `GET /api/tenants/:tenantId/capabilities` shows `can_use_my_new_service: true` after purchase

## Fulfillment via CRM Architecture

Platform service fulfillment leverages the existing CRM system — no new tables, no new admin UI. When a service is purchased, `PlatformServiceFulfillmentService` auto-creates:

1. **CRM Ticket** (`crm_support_tickets`) — `category: 'platform_service'`, `status: 'open'`, `priority: 'medium'`. Contains service details, purchase ID, and price in the description.
2. **CRM Tasks** (`crm_tasks`) — One task per workflow step, with due dates calculated from the workflow template. First task is `priority: 'high'`. All tasks are `status: 'pending'` and appear on the Tasks Kanban board.
3. **CRM Alert** (`crm_alerts`) — `type: 'platform_service'`, notifies the merchant that their service has started. Contains `ticket_id`, `purchase_id`, and `service_type` in metadata.

### Status Mapping

| CRM Ticket Status | Fulfillment Status | Meaning |
|---|---|---|
| `open` | `pending` | Service purchased, no staff action yet |
| `in_progress` | `in_progress` | Staff member assigned and working |
| `resolved` | `delivered` | Service delivered to merchant |
| `closed` | `archived` | Completed and archived |

### Workflow Templates

Each service type has a code-defined workflow template in `PlatformServiceFulfillmentService.SERVICE_WORKFLOW_TEMPLATES`. Templates define ordered task steps with titles, descriptions, and due-day offsets from purchase date.

Example (logo design):
```
1. Collect logo requirements (due: +1 day)
2. Design initial logo concepts (due: +3 days)
3. Client review and feedback (due: +5 days)
4. Final logo delivery (due: +7 days)
```

### Admin UI Surfaces (all existing, reused)

- **CRM Dashboard** (`/settings/admin/crm`) — Platform Services widget shows active/delivered counts
- **Global Tickets** (`/settings/admin/crm/tickets`) — Filter by `category: 'platform_service'`
- **Tasks Kanban** (`/settings/admin/crm/tasks`) — Workflow tasks with drag-and-drop status columns
- **Ticket Detail** (`/settings/admin/crm/tickets/:id`) — Message threads, activity log, status transitions
- **Services Page** (`/settings/admin/crm/services`) — Dedicated fulfillment overview with filtered tickets + tasks
- **CrmNavPanel** — "Services" nav item for quick access

### Merchant-Side Visibility

Merchants see service progress through:
- Their tenant CRM portal (tickets with `category: 'platform_service'`)
- CRM alerts (service started, service delivered)
- BillingNotificationService email when ticket is resolved (`platform_service_delivered`)

### Why CRM Integration Beats Custom Fulfillment

| Custom Fulfillment (rejected) | CRM Integration (chosen) |
|---|---|
| New `metadata.fulfillment_status` field | Reuses `crm_support_tickets.status` |
| New admin endpoint for status updates | Reuses existing `PUT /api/admin/crm/tickets/:id` |
| New admin dashboard page | Reuses existing CRM admin pages |
| No message thread | Full ticket message thread (merchant ↔ staff) |
| No activity log | Auto-logged activities on every status/assignment change |
| No task management | Full Kanban board with drag-and-drop reordering |
| No SLA tracking | First response time + resolution time tracked |
| New notification system | Reuses `CrmAlertService` + `BillingNotificationService` |

## Integration Points

### Files That Must Be Updated for Any New Service

| File | What to Add |
|------|-------------|
| `database/migrations/NNN_*.sql` | Feature key + capability link + catalog entry |
| `apps/api/src/services/PlatformServiceFulfillmentService.ts` | Add workflow template to `SERVICE_WORKFLOW_TEMPLATES` |
| `apps/api/src/services/resolvers/PlatformServiceResolver.ts` | Add to `SERVICE_KEYS` array |
| `apps/api/src/services/resolvers/types.ts` | Add to `PlatformServiceType` union + `EffectivePlatformServices` |
| `apps/web/src/services/CapabilityResolutionService.ts` | Add to `PlatformServiceType` + `PlatformServicesState` |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Add to `BackendEffectivePlatformServices` + `mapPlatformServices()` |

### Files That Must NOT Be Modified

| File | Why Not |
|------|---------|
| `bsaas-purchases.ts` `MERCHANT_GATE_MAP` | Platform services have no merchant gate |
| `bsaas-purchases.ts` `PARENT_GATE_FEATURES` | No parent gate — no companion purchases |
| `EffectiveCapabilityResolver.ts` `fetchMerchantSettings()` | No settings table to fetch |
| `MerchantSettingsBundle` in `types.ts` | No merchant settings interface needed |
| `bsaas-renewal.ts` | One-time purchases are automatically skipped |

## Anti-Patterns

### DON'T: Add a merchant settings table

Platform services are delivered by platform staff, not configured by merchants. There is no toggle for the merchant to turn on/off. The resolver takes only `features: Record<string, boolean>` — no `merchantPrefs` parameter.

### DON'T: Use recurring billing

All platform services use `billing_cycle: 'one_time'`. The service is purchased once, fulfilled once, and delivered. There is no renewal cycle. If you need recurring service offerings (e.g. monthly SEO maintenance), create a separate capability type with a different billing model.

### DON'T: Add to MERCHANT_GATE_MAP or PARENT_GATE_FEATURES

These maps are for capabilities where the merchant can soft-toggle a domain or where purchasing a sub-feature requires a parent gate to be enabled. Platform services have neither — any merchant can purchase any service at any time.

### DON'T: Assign individual service feature keys to tiers

Only `platform_services_enabled` (the master ON gate) is seeded into all tiers. Individual service keys (e.g. `platform_service_logo_design`) are NOT in any tier's `tier_features_list`. They are purchasable only via the BSaaS store. This ensures all merchants have equal access to purchase services regardless of their tier.

### DON'T: Skip the capability engagement bypass

`checkCapabilityEngagement()` in `bsaas-purchases.ts` requires that the tenant's tier has at least one enabled feature in the same capability type. Without `platform_services_enabled` seeded into all tiers, purchases would be blocked with "Your current plan doesn't include any features in the platform services category."

## Testing Checklist

When adding or modifying platform services, verify:

- [ ] `pnpm checkapi` — zero TS errors
- [ ] `pnpm checkweb` — zero TS errors
- [ ] Unit tests pass: `pnpm --filter api test -- --run PlatformServiceResolver`
- [ ] New service appears in Feature Store (`GET /api/subscription/feature-catalog`)
- [ ] Purchase succeeds and creates `tenant_feature_purchases` record
- [ ] Purchase auto-creates CRM ticket with `category: 'platform_service'`
- [ ] Purchase auto-creates workflow tasks on Kanban board
- [ ] Merchant receives CRM alert about service start
- [ ] `GET /api/tenants/:tenantId/capabilities` shows service as enabled after purchase
- [ ] `buildExpiredCapabilitiesResponse` includes `platform_services` block
- [ ] CRM admin UI can filter tickets by `category: 'platform_service'`
- [ ] CRM Services page shows fulfillment overview
- [ ] Ticket status transition (open → in_progress → resolved) works via existing CRM admin UI
- [ ] Delivered notification fires when ticket is resolved
- [ ] Resolver NOT added to `MERCHANT_GATE_MAP` or `PARENT_GATE_FEATURES`
- [ ] No merchant settings table created
- [ ] No new fulfillment tables created (uses existing CRM tables)
- [ ] `billing_cycle: 'one_time'` in catalog entry

## Reference Files

| File | Purpose |
|------|---------|
| `apps/api/src/services/resolvers/PlatformServiceResolver.ts` | Core resolver — simplest in the codebase |
| `apps/api/src/services/PlatformServiceFulfillmentService.ts` | CRM orchestration on purchase (ticket + tasks + alert) |
| `apps/api/src/services/resolvers/types.ts` | `EffectivePlatformServices` interface |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Pipeline wiring (both primary + MV-based) |
| `apps/api/src/services/CrmTicketService.ts` | Ticket CRUD + status transitions (existing, reused) |
| `apps/api/src/services/CrmTaskService.ts` | Task CRUD + Kanban reordering (existing, reused) |
| `apps/api/src/services/CrmAlertService.ts` | Alert creation (existing, reused) |
| `apps/api/src/routes/crm/admin/crm-admin.ts` | Admin CRM routes (existing, category filter added) |
| `apps/api/src/routes/public-tenant-capabilities.ts` | Expired capabilities fallback |
| `apps/api/src/routes/bsaas-purchases.ts` | Purchase flow + fulfillment hook |
| `apps/web/src/app/(platform)/settings/admin/crm/services/page.tsx` | CRM Services fulfillment overview |
| `apps/web/src/app/(platform)/settings/admin/crm/tickets/page.tsx` | Global Tickets (category filter added) |
| `apps/web/src/app/(platform)/settings/admin/crm/tasks/page.tsx` | Tasks Kanban (existing, reused) |
| `apps/web/src/components/crm/CrmNavPanel.tsx` | CRM sidebar nav (Services item added) |
| `apps/web/src/services/CapabilityResolutionService.ts` | Frontend state types |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Backend → frontend mapping |
| `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | `usePlatformServicesCapability` hook |
| `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | Dashboard showcase row |
| `apps/web/src/components/dashboard/PlanSummaryWidget.tsx` | Dashboard slim widget (capability status colors) |
| `apps/web/src/components/settings/PlanSummaryPanel.tsx` | Full plan summary panel (feature detail cards) |
| `database/migrations/107_platform_services_capability.sql` | Seed migration |

## Design Doc

`docs/PLATFORM_SERVICES_SPRINT_PLAN.md` — full sprint plan with implementation phases.
