# Platform Services Sprint Plan

## Overview

Sell platform-offered services (logo design, banner design, store setup, profile setup, etc.) to merchants through the existing BSaaS store infrastructure by registering a new `platform_services` capability type with per-service feature keys. This approach reuses 100% of the existing payment, lifecycle, and catalog infrastructure, and leverages the existing CRM architecture (tickets, tasks, alerts, activities) for fulfillment workflow management — no new fulfillment tables or admin UI needed.

**Design doc date**: 2026-07-13
**Estimated effort**: 3 sprints, 5-7 days total
**Closest analog**: `wholesale_matching_options` capability (simple resolver, minimal merchant gate)
**Fulfillment analog**: Existing CRM ticket/task/alert system (admin UI already built)

---

## Architecture

### How It Works

```
Merchant browses Feature Store
  → sees bsaas_catalog entries (platform_service_logo_design, etc.)
  → clicks Purchase
  → bsaas-purchases.ts charges via Stripe
  → creates tenant_feature_purchases record (billing_cycle: one_time)
  → invalidateEffectiveCapabilities() fires
  → resolver picks up purchased feature key
  → EffectivePlatformServices reflects purchased service as enabled
  → PlatformServiceFulfillmentService auto-creates (fire-and-forget):
      ├─ CRM ticket (category: 'platform_service', status: 'open')
      ├─ CRM tasks (service-specific workflow steps)
      └─ CRM alert (notifies merchant service has started)
  → platform staff manage fulfillment via existing CRM admin UI:
      ├─ Global Tickets page (filtered by category: 'platform_service')
      ├─ Tasks Kanban board (workflow steps with due dates)
      └─ Ticket detail page (messages, activities, status transitions)
  → ticket status: open → in_progress → resolved = fulfillment: pending → in_progress → delivered
  → merchant sees progress in their tenant CRM portal + receives alerts
```

### Why This Approach Works

| Concern | How It's Handled |
|---|---|
| Payment | Reused — `SubscriptionBillingService.chargePaymentMethod()` |
| Catalog | Reused — `bsaas_catalog` table, admin CRUD at `/api/admin/bsaas-catalog` |
| Purchase record | Reused — `tenant_feature_purchases` table |
| Cache invalidation | Reused — `invalidateEffectiveCapabilities()` |
| Renewal | Skipped — `one_time` billing cycle ignored by `bsaas-renewal.ts` |
| Notifications | Reused — `BillingNotificationService` purchase success email |
| Promo codes | Reused — existing `validatePromoCode()` flow |
| Feature Store UI | Reused — catalog entries appear automatically |
| Capability engagement | Bypassed — seed `platform_services_enabled` into all tiers |
| Fulfillment | Reused — CRM tickets + tasks + alerts (existing admin UI, activities, message threads) |

### Key Design Decisions

1. **No merchant settings table** — Unlike `wholesale_matching` which has `tenant_wholesale_matching_settings`, platform services have no merchant-facing toggle. The resolver takes only `features: Record<string, boolean>` — no `merchantPrefs` parameter.

2. **No merchant gate** — Not added to `MERCHANT_GATE_MAP` or `PARENT_GATE_FEATURES` in `bsaas-purchases.ts`. No companion purchases, no parent gate.

3. **Capability engagement bypass** — Seed `platform_services_enabled: true` into all tiers via `tier_features_list`. This satisfies `checkCapabilityEngagement()` which requires at least one enabled feature in the same capability type. The individual service feature keys (e.g. `platform_service_logo_design`) are NOT in any tier — they're purchasable only.

4. **One-time billing** — All `bsaas_catalog` entries use `billing_cycle: 'one_time'`. The renewal job naturally ignores these.

5. **Fulfillment via CRM** — When a platform service is purchased, `PlatformServiceFulfillmentService` auto-creates a CRM ticket (category: `platform_service`), workflow tasks, and a merchant alert. Platform staff use the existing CRM admin UI (Global Tickets, Tasks Kanban) to manage fulfillment. Ticket status transitions (`open` → `in_progress` → `resolved`) map to fulfillment status (`pending` → `in_progress` → `delivered`). No new fulfillment tables or admin UI needed.

6. **Service workflow templates** — Each service type has a code-defined task template (e.g. logo design: collect requirements → design draft → client review → final delivery). Tasks are auto-created with the ticket and appear on the Tasks Kanban board assigned to the platform staff member who picks up the ticket.

---

## Sprint 1: Backend Capability + Catalog (3-4 days)

### 1.1 Database Migration

**File**: `database/migrations/107_platform_services_capability.sql`

Follow the pattern from `106_wholesale_matching_capability.sql`:

**Step 0**: No merchant settings table (unlike wholesale_matching, platform services have no merchant gate).

**Step 1**: Insert feature keys into `features_list`:
- `platform_services_enabled` — Master ON gate (seeded into all tiers)
- `platform_services_disabled` — Explicit disable (seeded false into all tiers)
- `platform_service_logo_design` — Logo design service
- `platform_service_banner_design` — Banner design service
- `platform_service_store_setup` — Store setup service
- `platform_service_profile_setup` — Profile setup service
- `platform_service_seo_optimization` — SEO optimization service
- `platform_service_social_media_kit` — Social media kit service

All with `category: 'platform_services'`, `is_active: true`.

**Step 2**: Create capability type:
```sql
INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'platform_services',
  'Platform Services',
  'Platform-offered professional services: logo design, banner design, store setup, profile setup, and more.',
  'platform_services',
  true,
  7,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET ...;
```

**Step 3**: Link features to capability type via `capability_features_list` (same DO $$ block pattern as migration 106).

**Step 4**: Assign tier features — ALL tiers get `platform_services_enabled: true` and `platform_services_disabled: false`. This satisfies the capability engagement check. Individual service keys are NOT assigned to any tier (purchasable only via BSaaS).

**Step 5**: Insert `bsaas_catalog` entries for each service:
```sql
INSERT INTO bsaas_catalog (feature_key, marketing_name, description, price_cents, billing_cycle, trial_days, is_active, sort_order, trial_eligible, demo_eligible, is_private)
VALUES
  ('platform_service_logo_design', 'Professional Logo Design', '...', 9900, 'one_time', 0, true, 100, false, false, false),
  ('platform_service_banner_design', 'Custom Banner Design', '...', 4900, 'one_time', 0, true, 101, false, false, false),
  ('platform_service_store_setup', 'Complete Store Setup', '...', 19900, 'one_time', 0, true, 102, false, false, false),
  ('platform_service_profile_setup', 'Profile Setup & Optimization', '...', 7900, 'one_time', 0, true, 103, false, false, false),
  ('platform_service_seo_optimization', 'SEO Optimization', '...', 12900, 'one_time', 0, true, 104, false, false, false),
  ('platform_service_social_media_kit', 'Social Media Kit', '...', 5900, 'one_time', 0, true, 105, false, false, false)
ON CONFLICT (feature_key) DO UPDATE SET ...;
```

**Step 6**: Link capability type to representative tier for admin UI:
```sql
UPDATE capability_type_list SET tier_id = 'tier_professional' WHERE key = 'platform_services' AND tier_id IS NULL;
```

**Verification queries** at the end (commented out, same pattern as migration 106).

### 1.2 Prisma Schema

**File**: `apps/api/prisma/schema.prisma`

No new model needed — `bsaas_catalog` and `tenant_feature_purchases` already exist. Run `prisma db pull` to introspect any schema changes if needed, but the migration only inserts data into existing tables.

### 1.3 Backend Resolver

**File**: `apps/api/src/services/resolvers/PlatformServiceResolver.ts` (NEW)

```typescript
import type { EffectivePlatformServices, PlatformServiceType } from './types';

const SERVICE_KEYS: PlatformServiceType[] = [
  'logo_design',
  'banner_design',
  'store_setup',
  'profile_setup',
  'seo_optimization',
  'social_media_kit',
];

export function resolvePlatformServices(
  features: Record<string, boolean>
): EffectivePlatformServices {
  const disabled = !!features.platform_services_disabled;
  const enabled = !disabled && !!features.platform_services_enabled;

  const allowedServices = SERVICE_KEYS.filter(s =>
    !!features[`platform_service_${s}`]
  );

  return {
    enabled,
    allowed_services: allowedServices,
    can_use_logo_design: enabled && allowedServices.includes('logo_design'),
    can_use_banner_design: enabled && allowedServices.includes('banner_design'),
    can_use_store_setup: enabled && allowedServices.includes('store_setup'),
    can_use_profile_setup: enabled && allowedServices.includes('profile_setup'),
    can_use_seo_optimization: enabled && allowedServices.includes('seo_optimization'),
    can_use_social_media_kit: enabled && allowedServices.includes('social_media_kit'),
    is_flexible: false,
  };
}
```

### 1.4 Backend Types

**File**: `apps/api/src/services/resolvers/types.ts`

Add:
```typescript
// ====================
// PLATFORM SERVICES
// ====================

export type PlatformServiceType =
  | 'logo_design' | 'banner_design' | 'store_setup'
  | 'profile_setup' | 'seo_optimization' | 'social_media_kit';

export interface EffectivePlatformServices {
  enabled: boolean;
  allowed_services: PlatformServiceType[];
  can_use_logo_design: boolean;
  can_use_banner_design: boolean;
  can_use_store_setup: boolean;
  can_use_profile_setup: boolean;
  can_use_seo_optimization: boolean;
  can_use_social_media_kit: boolean;
  is_flexible: boolean;
}
```

Add `platform_services: EffectivePlatformServices;` to `EffectiveCapabilities.effective`.
Do NOT add to `MerchantSettingsBundle` (no merchant settings table).

### 1.5 Resolver Pipeline Wiring

**File**: `apps/api/src/services/EffectiveCapabilityResolver.ts`

1. Import `resolvePlatformServices` from `./resolvers`
2. Add to BOTH `Promise.all` blocks (primary resolver ~line 142 and MV-based resolver ~line 596):
```typescript
resolvePlatformServices(
  rawCaps.capabilities.platform_services?.features || {}
),
```
3. Add to BOTH result objects (~line 236 and ~line 690):
```typescript
platform_services: effective[21],
```
4. Do NOT add to `fetchMerchantSettings()` — no settings table to fetch.

### 1.6 Resolver Index Export

**File**: `apps/api/src/services/resolvers/index.ts`

Add:
```typescript
export { resolvePlatformServices } from './PlatformServiceResolver';
```

### 1.7 Expired Capabilities Fallback

**File**: `apps/api/src/routes/public-tenant-capabilities.ts`

Add to `buildExpiredCapabilitiesResponse()`:
```typescript
platform_services: {
  enabled: false,
  allowed_services: [],
  can_use_logo_design: false,
  can_use_banner_design: false,
  can_use_store_setup: false,
  can_use_profile_setup: false,
  can_use_seo_optimization: false,
  can_use_social_media_kit: false,
  is_flexible: false,
},
```

### 1.8 PlatformServiceFulfillmentService

**File**: `apps/api/src/services/PlatformServiceFulfillmentService.ts` (NEW)

Singleton extending `BaseService`. Orchestrates CRM object creation on platform service purchase. Called fire-and-forget from `bsaas-purchases.ts` after successful purchase.

```typescript
import { BaseService } from './BaseService';
import { CrmTicketService } from './CrmTicketService';
import { CrmTaskService } from './CrmTaskService';
import { CrmAlertService } from './CrmAlertService';

interface ServiceFulfillmentParams {
  tenantId: string;
  featureKey: string;      // e.g. 'platform_service_logo_design'
  serviceName: string;      // e.g. 'Professional Logo Design'
  purchaseId: string;       // tenant_feature_purchases.id
  priceCents: number;
}

const SERVICE_WORKFLOW_TEMPLATES: Record<string, { title: string; description: string; dueDays: number }[]> = {
  logo_design: [
    { title: 'Collect logo requirements', description: 'Gather brand info, style preferences, color palette from merchant', dueDays: 1 },
    { title: 'Design initial logo concepts', description: 'Create 3 logo concepts for merchant review', dueDays: 3 },
    { title: 'Client review and feedback', description: 'Send concepts to merchant, collect feedback', dueDays: 5 },
    { title: 'Final logo delivery', description: 'Deliver final logo in multiple formats (PNG, SVG, PDF)', dueDays: 7 },
  ],
  banner_design: [
    { title: 'Collect banner requirements', description: 'Gather dimensions, messaging, brand assets', dueDays: 1 },
    { title: 'Design banner drafts', description: 'Create 2 banner variations for review', dueDays: 2 },
    { title: 'Client review and feedback', description: 'Send drafts to merchant, collect feedback', dueDays: 4 },
    { title: 'Final banner delivery', description: 'Deliver final banner in required formats', dueDays: 5 },
  ],
  store_setup: [
    { title: 'Store audit and planning', description: 'Review current store config, plan setup steps', dueDays: 1 },
    { title: 'Configure storefront settings', description: 'Set up layout, hours, contact info, policies', dueDays: 3 },
    { title: 'Product catalog setup', description: 'Assist with initial product creation and categorization', dueDays: 5 },
    { title: 'Final review and handoff', description: 'Walk merchant through completed setup, provide documentation', dueDays: 7 },
  ],
  profile_setup: [
    { title: 'Profile audit', description: 'Review existing profile, identify gaps', dueDays: 1 },
    { title: 'Profile optimization', description: 'Update business info, photos, descriptions for SEO', dueDays: 2 },
    { title: 'Final review', description: 'Merchant reviews optimized profile', dueDays: 3 },
  ],
  seo_optimization: [
    { title: 'SEO audit', description: 'Analyze current SEO state, identify opportunities', dueDays: 2 },
    { title: 'On-page optimization', description: 'Optimize meta tags, headings, content, images', dueDays: 4 },
    { title: 'Local SEO setup', description: 'Configure Google Business Profile, local citations', dueDays: 6 },
    { title: 'Final report and handoff', description: 'Deliver SEO report with recommendations', dueDays: 7 },
  ],
  social_media_kit: [
    { title: 'Collect brand assets', description: 'Gather logo, colors, fonts, brand guidelines', dueDays: 1 },
    { title: 'Create template designs', description: 'Design social media templates for each platform', dueDays: 3 },
    { title: 'Final kit delivery', description: 'Deliver social media kit with usage guide', dueDays: 5 },
  ],
};

class PlatformServiceFulfillmentService extends BaseService {
  private static instance: PlatformServiceFulfillmentService;
  private constructor() { super(); }
  static getInstance() {
    if (!PlatformServiceFulfillmentService.instance) {
      PlatformServiceFulfillmentService.instance = new PlatformServiceFulfillmentService();
    }
    return PlatformServiceFulfillmentService.instance;
  }

  async createFulfillmentWorkflow(params: ServiceFulfillmentParams): Promise<void> {
    const { tenantId, featureKey, serviceName, purchaseId, priceCents } = params;
    const serviceType = featureKey.replace('platform_service_', '');
    const workflow = SERVICE_WORKFLOW_TEMPLATES[serviceType] || [];
    const ticketService = CrmTicketService.getInstance();
    const taskService = CrmTaskService.getInstance();
    const alertService = CrmAlertService.getInstance();

    // 1. Create CRM ticket for the service fulfillment
    const ticket = await ticketService.create({
      tenant_id: tenantId,
      title: `Platform Service: ${serviceName}`,
      description: `Service purchased via Feature Store.\n\nService: ${serviceName}\nFeature Key: ${featureKey}\nPurchase ID: ${purchaseId}\nPrice: $${(priceCents / 100).toFixed(2)}\n\nFulfillment workflow has been auto-created with ${workflow.length} tasks.`,
      priority: 'medium',
      category: 'platform_service',
    });

    // 2. Create workflow tasks linked to the ticket
    for (let i = 0; i < workflow.length; i++) {
      const step = workflow[i];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + step.dueDays);

      await taskService.create({
        tenant_id: tenantId,
        title: step.title,
        description: step.description,
        priority: i === 0 ? 'high' : 'medium',
        due_date: dueDate,
        created_by: 'system',
      });
    }

    // 3. Create merchant alert
    await alertService.create({
      tenant_id: tenantId,
      type: 'platform_service',
      title: `Service started: ${serviceName}`,
      body: `Your "${serviceName}" service has been initiated. Our team will begin working on it shortly. You can track progress in your CRM portal.`,
      icon: '🎨',
      metadata: {
        feature_key: featureKey,
        purchase_id: purchaseId,
        ticket_id: ticket.id,
        service_type: serviceType,
        price_cents: priceCents,
      },
    });
  }
}
```

### 1.9 Purchase Hook in bsaas-purchases.ts

**File**: `apps/api/src/routes/bsaas-purchases.ts`

After the existing `invalidateEffectiveCapabilities()` + CRM alert block in the purchase handler (~line 1158), add fire-and-forget fulfillment workflow creation:

```typescript
// 5d. If this is a platform service purchase, auto-create fulfillment workflow — fire-and-forget
if (featureKey.startsWith('platform_service_')) {
  (async () => {
    try {
      const { PlatformServiceFulfillmentService } = await import('../services/PlatformServiceFulfillmentService');
      await PlatformServiceFulfillmentService.getInstance().createFulfillmentWorkflow({
        tenantId,
        featureKey,
        serviceName: catalogEntry.marketing_name || featureKey,
        purchaseId: purchase.id,
        priceCents: catalogEntry.price_cents,
      });
    } catch (err) {
      console.error('[BSaaS] Failed to create fulfillment workflow:', err);
    }
  })();
}
```

This follows the exact same fire-and-forget pattern as the existing `CrmAlertService.getInstance().createAppStoreAlert()` call.

### 1.10 Billing Notification

**File**: `apps/api/src/services/subscription/BillingNotificationService.ts`

Add new notification type: `platform_service_delivered` with email template (service delivered notification) + CRM alert payload. This fires when a platform service ticket is resolved (hooked via ticket status update in `CrmTicketService.update()` or a post-update webhook).

### 1.11 Sprint 1 Verification

- `pnpm checkapi` — zero TS errors
- Run migration against staging DB
- Verify capability type appears in admin UI at `/settings/admin/capabilities`
- Verify `bsaas_catalog` entries appear in Feature Store
- Verify `GET /api/tenants/:tenantId/capabilities` response includes `platform_services` block
- Verify test purchase creates CRM ticket with `category: 'platform_service'`
- Verify workflow tasks appear on Tasks Kanban board
- Verify merchant receives CRM alert

---

## Sprint 2: Frontend Capability Mapping + UI (2-3 days)

### 2.1 Frontend Types

**File**: `apps/web/src/services/CapabilityResolutionService.ts`

Add:
```typescript
export type PlatformServiceType =
  | 'logo_design' | 'banner_design' | 'store_setup'
  | 'profile_setup' | 'seo_optimization' | 'social_media_kit';

export interface PlatformServicesState {
  enabled: boolean;
  allowedServices: PlatformServiceType[];
  canUseLogoDesign: boolean;
  canUseBannerDesign: boolean;
  canUseStoreSetup: boolean;
  canUseProfileSetup: boolean;
  canUseSeoOptimization: boolean;
  canUseSocialMediaKit: boolean;
  isFlexible: boolean;
}
```

Add `platformServices: PlatformServicesState;` to `AllCapabilitiesState`.
Add `'platform_service_': 'platform_services'` to feature prefix mapping.

### 2.2 Frontend Mapping

**File**: `apps/web/src/services/UnifiedCapabilityService.ts`

Add:
- `BackendEffectivePlatformServices` interface
- `mapPlatformServices()` function
- `getPlatformServicesState()` method
- `'platform_service_': 'platformServices'` to prefix mapping
- Add to `BackendEffectiveCapabilities.effective`
- Add `platformServices: mapPlatformServices(b.effective.platform_services)` to `mapAllCapabilities()`

### 2.3 Frontend Hook

**File**: `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts`

Add `usePlatformServicesCapability` hook following the `useWholesaleMatchingCapability` pattern.

### 2.4 CapabilityShowcase Row

**File**: `apps/web/src/components/dashboard/CapabilityShowcase.tsx`

Add "Platform Services" row:
- Icon: `Sparkles` or `Wrench`
- Shows purchased service count
- Links to Feature Store (`/t/${tenantId}/settings/feature-store`)
- No merchant gate indicator

### 2.5 CRM Admin UI Enhancements

Instead of a separate fulfillment dashboard, enhance the existing CRM admin pages to filter and display platform service tickets.

**File**: `apps/web/src/app/(platform)/settings/admin/crm/tickets/page.tsx` (MODIFY)

Add a category filter dropdown (`platform_service` option) to the existing Global Tickets page. When `category=platform_service` is selected, tickets are filtered to show only platform service fulfillment tickets. The existing table already shows: Title, Tenant, Status, Priority, Assigned, Created, Actions (View). This is sufficient for fulfillment management — staff click "View" to open the ticket detail page for messages and status transitions.

**File**: `apps/web/src/app/(platform)/settings/admin/crm/page.tsx` (MODIFY)

Add a "Platform Services" widget to the CRM Dashboard showing:
- Active service tickets count (tickets with `category: 'platform_service'` and `status != 'closed'`)
- Pending tasks count (tasks from service workflows with `status: 'pending'`)
- In-progress services count
- Delivered services count (tickets with `status: 'resolved'`)
- Quick-link to filtered tickets view (`/settings/admin/crm/tickets?category=platform_service`)

This widget follows the same pattern as the existing `DirectoryPromotionsWidget` already on the dashboard.

**File**: `apps/web/src/components/crm/CrmNavPanel.tsx` (MODIFY)

Add a "Services" nav item below "Tasks":
```typescript
{ href: '/settings/admin/crm/services', label: 'Services', icon: IconPalette, emoji: '🎨' },
```

**File**: `apps/web/src/app/(platform)/settings/admin/crm/services/page.tsx` (NEW)

A dedicated platform services fulfillment overview page using `CrmPageShell`. Shows:
- Summary cards: Active services, Pending tasks, In progress, Delivered (this week)
- Tickets table filtered by `category: 'platform_service'` (reuses `crmAdminService.listGlobalTickets` with a new `category` filter param)
- Tasks table filtered to service workflow tasks (reuses `crmAdminService.listTasks`)
- Links to individual ticket detail pages for message threads and status updates

This page is a filtered view of existing CRM data — no new API endpoints needed beyond adding `category` as a filter param to the existing `GET /api/admin/crm/tickets` route.

### 2.6 Backend: Add Category Filter to CRM Admin Tickets

**File**: `apps/api/src/routes/crm/admin/crm-admin.ts` (MODIFY)

Add `category` to the query params for `GET /api/admin/crm/tickets`:
```typescript
router.get('/tickets', async (req: Request, res: Response) => {
  const filters: { assignedTo?: string; status?: string; priority?: string; category?: string } = {};
  if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo as string;
  if (req.query.status) filters.status = req.query.status as string;
  if (req.query.priority) filters.priority = req.query.priority as string;
  if (req.query.category) filters.category = req.query.category as string;
  // ... pass filters to ticketService.listGlobal
});
```

**File**: `apps/api/src/services/CrmTicketService.ts` (MODIFY)

Add `category` to `listGlobal` filters:
```typescript
async listGlobal(filters: { assignedTo?: string; status?: string; priority?: string; category?: string } = {}) {
  const where: any = {};
  if (filters.assignedTo) where.assigned_to = filters.assignedTo;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.category) where.category = filters.category;
  return prisma.crm_support_tickets.findMany({ where, orderBy: [...] });
}
```

**File**: `apps/web/src/services/crm/CrmAdminService.ts` (MODIFY)

Add `category` to `listGlobalTickets` filters.

### 2.7 Navigation

**File**: `apps/web/src/app/(platform)/settings/admin/page.tsx` (MODIFY)

Add a "Platform Services" card in the CRM section linking to `/settings/admin/crm/services`.

**File**: `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` (MODIFY)

No change needed — the CRM section already exists in the admin sidebar. The "Services" nav item is added to `CrmNavPanel` instead (see 2.5).

### 2.8 Sprint 2 Verification

- `pnpm checkapi` — zero TS errors
- `pnpm checkweb` — zero TS errors
- Verify CapabilityShowcase shows Platform Services row
- Verify CRM Services page loads and displays platform service tickets
- Verify category filter works on Global Tickets page
- Verify CRM Dashboard widget shows service counts
- Verify CrmNavPanel shows "Services" link

---

## Sprint 3: Agent Skill Doc + Polish (1 day)

### 3.1 Agent Skill Document

**File**: `.devin/skills/platform-services-guide.md` (NEW)

Comprehensive guide covering:
- Architecture overview (capability type + BSaaS catalog + fulfillment)
- How to add a new platform service (step-by-step)
- Data flow diagram
- Fulfillment metadata schema
- Integration points (resolver pipeline, bsaas-purchases, notifications)
- Anti-patterns (don't add merchant gate, don't add to MERCHANT_GATE_MAP, don't use recurring billing)
- Testing checklist

### 3.2 Unit Tests

**File**: `apps/api/src/services/resolvers/PlatformServiceResolver.test.ts` (NEW)

Test cases:
1. Returns disabled when no features
2. Returns disabled when `platform_services_disabled` is true
3. Returns enabled when `platform_services_enabled` is true
4. Returns correct `can_use_*` flags for each service
5. Returns multiple services when multiple features are enabled
6. Returns empty `allowed_services` when only `_enabled` is set (no individual services)

### 3.3 Sprint 3 Verification

- `pnpm checkapi` — zero TS errors
- `pnpm checkweb` — zero TS errors
- Unit tests pass: `pnpm --filter api test -- --run PlatformServiceResolver`
- Agent skill doc reviewed

---

## File Inventory

### New Files
| File | Sprint |
|---|---|
| `database/migrations/107_platform_services_capability.sql` | 1 |
| `apps/api/src/services/resolvers/PlatformServiceResolver.ts` | 1 |
| `apps/api/src/services/PlatformServiceFulfillmentService.ts` | 1 |
| `apps/web/src/app/(platform)/settings/admin/crm/services/page.tsx` | 2 |
| `apps/api/src/services/resolvers/PlatformServiceResolver.test.ts` | 3 |
| `.devin/skills/platform-services-guide.md` | 3 |

### Modified Files
| File | Sprint | Changes |
|---|---|---|
| `apps/api/src/services/resolvers/types.ts` | 1 | Add `PlatformServiceType`, `EffectivePlatformServices`, add to `EffectiveCapabilities` |
| `apps/api/src/services/resolvers/index.ts` | 1 | Export `resolvePlatformServices` |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | 1 | Import + wire resolver in both pipelines + result objects |
| `apps/api/src/routes/public-tenant-capabilities.ts` | 1 | Add `platform_services` to `buildExpiredCapabilitiesResponse` |
| `apps/api/src/routes/bsaas-purchases.ts` | 1 | Add fire-and-forget fulfillment workflow creation for `platform_service_*` purchases |
| `apps/api/src/services/subscription/BillingNotificationService.ts` | 1 | Add `platform_service_delivered` notification type |
| `apps/api/src/services/CrmTicketService.ts` | 2 | Add `category` filter to `listGlobal()` |
| `apps/api/src/routes/crm/admin/crm-admin.ts` | 2 | Add `category` query param to `GET /api/admin/crm/tickets` |
| `apps/web/src/services/CapabilityResolutionService.ts` | 2 | Add `PlatformServicesState`, prefix mapping |
| `apps/web/src/services/UnifiedCapabilityService.ts` | 2 | Add backend interface, mapper, getter, prefix mapping |
| `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | 2 | Add `usePlatformServicesCapability` hook |
| `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | 2 | Add Platform Services row |
| `apps/web/src/components/crm/CrmNavPanel.tsx` | 2 | Add "Services" nav item |
| `apps/web/src/app/(platform)/settings/admin/crm/tickets/page.tsx` | 2 | Add category filter dropdown |
| `apps/web/src/app/(platform)/settings/admin/crm/page.tsx` | 2 | Add Platform Services widget to dashboard |
| `apps/web/src/app/(platform)/settings/admin/page.tsx` | 2 | Add Platform Services card in CRM section |
| `apps/web/src/services/crm/CrmAdminService.ts` | 2 | Add `category` to `listGlobalTickets` filters |

---

## End-of-Sprint Checklist

After each sprint, verify:

- [ ] `pnpm checkapi` — zero TS errors
- [ ] `pnpm checkweb` — zero TS errors
- [ ] No new tables created (Sprint 1 creates none — fulfillment uses existing CRM tables)
- [ ] Resolver follows `WholesaleMatchingResolver` pattern (no merchant prefs for this capability)
- [ ] Not added to `MERCHANT_GATE_MAP` or `PARENT_GATE_FEATURES`
- [ ] `buildExpiredCapabilitiesResponse` includes new capability block
- [ ] Both resolver pipelines (primary + MV-based) updated in `EffectiveCapabilityResolver.ts`
- [ ] Frontend `UnifiedCapabilityService` prefix mapping includes `platform_service_`
- [ ] `CapabilityShowcase` row added
- [ ] `PlatformServiceFulfillmentService` creates CRM ticket + tasks + alert on purchase
- [ ] CRM admin UI can filter tickets by `category: 'platform_service'`
- [ ] CRM Services page shows fulfillment overview
- [ ] Agent skill doc updated (Sprint 3)
