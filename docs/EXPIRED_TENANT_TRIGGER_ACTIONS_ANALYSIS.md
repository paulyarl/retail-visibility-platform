# Expired Tenant Trigger Actions — Analysis Report

> **Date:** 2026-06-22
> **Purpose:** Reference document for planning behavior changes when a tenant's subscription expires.
> **Scope:** Backend middleware, API routes, frontend dashboard, background jobs, public visibility.

---

## 1. Subscription Lifecycle & State Machine

The platform derives an `InternalStatus` from raw tenant fields in `apps/api/src/utils/subscription-status.ts:9-16`:

| Internal Status | Meaning | DB State |
|---|---|---|
| `trialing` | Active 14-day trial | `subscription_status='trial'`, `trial_ends_at` in future |
| `active` | Paid subscription in good standing | `subscription_status='active'` |
| `past_due` | Payment failed, 30-day grace period | `subscription_status='past_due'` |
| `maintenance` | Limited access (google_only within window) | `tier='google_only'`, within `trial_ends_at` boundary |
| `frozen` | Read-only visibility mode | `tier='expired_trial'` OR canceled/expired outside maintenance |
| `canceled` | Explicitly canceled | `subscription_status='canceled'` |
| `expired` | Trial or subscription expired | `subscription_status='expired'` or `subscription_ends_at < now` |

### Transition Flow

```
trialing → (payment success) → active
active → (payment fail) → past_due
past_due → (30-day grace expires) → frozen (downgrade to expired_trial)
trialing → (trial ends, payment fail) → past_due → frozen
any → (user cancels) → canceled
```

The downgrade is executed by `TrialManagementService.downgradeToExpired()` at `apps/api/src/services/subscription/TrialManagementService.ts:323-362`, which sets `subscription_tier='expired_trial'` and `subscription_status='canceled'`.

### Key Files

- `apps/api/src/utils/subscription-status.ts` — Backend `deriveInternalStatus()` and `getMaintenanceState()`
- `apps/web/src/lib/subscription-status.ts` — Frontend mirror of the same logic
- `apps/api/src/services/subscription/SubscriptionStatusService.ts` — Status transition handlers
- `apps/api/src/services/subscription/TrialManagementService.ts` — Trial lifecycle (start, charge, downgrade)
- `apps/api/src/jobs/subscription-grace-period.ts` — Daily job: process trial ends, retry payments, demote expired
- `apps/api/src/jobs/expireManualSubscriptionControl.ts` — Daily job: expire manual subscription overrides

---

## 2. What IS Currently Gated for Expired/Frozen Tenants

### 2.1 Backend Middleware (Working)

#### `requireWritableSubscription` (tier-access.ts)

Located at `apps/api/src/middleware/tier-access.ts:484-539`.

Checks `getMaintenanceState()` — blocks write operations when state is `freeze`. Returns 403 with `subscription_read_only` error.

**Routes using this middleware:**

| Route File | Endpoint | Method |
|---|---|---|
| `routes/clone.ts:47` | `/clone/product` | POST |
| `routes/clone.ts:191` | `/clone/category` | POST |
| `routes/quick-start.ts:121` | `/tenants/:tenantId/quick-start` | POST |
| `routes/quick-start.ts:506` | `/tenants/:tenantId/categories/quick-start` | POST |
| `routes/scan.ts:62` | `/scan/start` | POST |

#### Feed Job Freeze Check

`routes/feed-jobs.ts:124-156` — Inline check (not middleware) that blocks feed pushes for fully frozen tenants. Allows google_only fallback tenants within the maintenance window.

### 2.2 Frontend Banners (Working)

#### `SubscriptionStateBanner`

File: `apps/web/src/components/subscription/SubscriptionStateBanner.tsx`

Shows dismissible banners (persisted in localStorage):
- **Frozen** (red): "Account Frozen - Read-Only Mode" with upgrade CTA
- **Maintenance** (yellow): "Maintenance Mode - Limited Access" with what's allowed/blocked

**Rendered on:**
- `TenantDashboardV2.tsx:219`
- `TenantDashboard.tsx:361`
- `ItemsClient.tsx:427`

#### `SubscriptionStatusGuide`

Displayed alongside the banner on the items page.

---

## 3. What IS NOT Gated — The Gaps

### 3.1 Chatbot — No Subscription Gating At All

#### Bot Merchant Routes (`apps/api/src/routes/bot-merchant.ts`)

All 18+ routes use only `authenticateToken`. No `requireWritableSubscription`, no subscription status check.

**An expired/frozen tenant can:**
- Read and update bot config (PUT `/config`)
- View conversations, analytics, dashboard
- Update skills (PUT `/skills/:skillId`)
- Refresh FAQ and product embeddings
- Start dashboard chat conversations
- Upload bot avatar
- Run GDPR erase and retention policies

#### Bot Public Routes (`apps/api/src/routes/bot-public.ts`)

All routes use only `resolveEmbedKey`. No subscription check.

**The bot widget remains fully functional for expired tenants** — customers can still:
- Start conversations
- Send messages
- Search products via bot
- Create CRM tickets through bot
- Submit feedback

#### Frontend

`TenantDashboardV2.tsx` renders the bot widget (`PublicBotWidget`) and bot stats with no check on subscription status. `botConfig?.status === 'active'` is a bot-level toggle, not a subscription gate.

### 3.2 CRM — No Subscription Gating At All

#### Tenant CRM Routes (`apps/api/src/routes/crm/tenant/crm-tenant.ts`)

All 20+ routes have **no auth middleware, no subscription check**. They only extract `tenantId` from the request.

**An expired tenant can:**
- Create/update/delete contacts
- Create/update tickets
- Send messages on tickets
- Create and update inquiries
- Reorder tickets/tasks (Kanban)
- Manage alerts (read, dismiss, mark read)
- Promote inquiries to tickets
- Create FAQs from inquiries

#### Customer CRM Routes (`apps/api/src/routes/crm/customer/crm-customer.ts`)

All routes check `customer?.id` only. No tenant subscription check.

**Customers of expired tenants can still:**
- Create tickets
- Send messages
- Submit inquiries
- View orders and activities

#### Frontend

`TenantDashboardV2.tsx:328` renders `CrmTenantWidget` with no subscription check. CRM stat badges (tickets, tasks, inquiries, alerts) display normally for expired tenants.

### 3.3 Items/Inventory — Partially Gated

The main items POST route at `apps/api/src/index.ts:5155` has `checkSubscriptionLimits` **commented out**:

```typescript
app.post(["/api/items", "/api/inventory", "/items", "/inventory"], /* checkSubscriptionLimits, */ async (req, res) => {
```

This means expired/frozen tenants can potentially create new items through the main API, though the clone and quick-start routes are blocked.

### 3.4 Storefront Options & Settings — No Gating

No subscription checks on:
- Storefront options settings
- Featured products settings
- Integrations settings (Google, Clover, Square)
- Tenant profile/business hours
- Directory entry options

### 3.5 Public Visibility — Not Filtered

The public tenant info route (`apps/api/src/routes/public/tenants.ts`) exposes `subscriptionStatus` and `subscriptionTier` but does **not filter** expired_trial tenants from public views.

The `expired_trial` tier is supposed to make tenants "invisible on public pages" per code comments in `TrialManagementService.ts:321`, but there's no actual query filter excluding `expired_trial` tenants from the directory or storefront materialized views.

### 3.6 Background Jobs — Not Disabled for Expired Tenants

- `apps/api/src/jobs/bot-product-embedding-sync.ts` — Runs every 12 hours for all tenants with active chatbot. No subscription status check.
- The grace period job correctly processes expirations, but **no job disables bot widgets, pauses CRM auto-responses, or deactivates integrations** for expired tenants.

### 3.7 Dead Middleware

Two middleware functions exist in `apps/api/src/middleware/subscription.ts` but are **not imported or used by any route**:

- `requireActiveSubscription` (lines 9-119) — Would block canceled, expired trial, expired subscription, past_due
- `requireWritableSubscription` (lines 263-349) — A second version that checks `deriveInternalStatus`

The tier-access.ts version of `requireWritableSubscription` is the one actually used.

---

## 4. Summary: Current vs Expected Behavior

| Feature | Current Behavior | Expected Behavior |
|---|---|---|
| **Bot widget (public)** | Fully active | Should be disabled or show "unavailable" message |
| **Bot config (merchant)** | Fully editable | Should be read-only or blocked |
| **Bot dashboard chat** | Fully active | Should be blocked |
| **Bot embedding sync** | Continues running | Should skip expired tenants |
| **CRM (tenant)** | Fully functional | Write operations blocked; read should work |
| **CRM (customer)** | Fully functional | Ticket creation should work (support channel) with limitations |
| **Items creation** | Partially gated (middleware commented out) | Should be fully blocked |
| **Storefront settings** | Fully editable | Should be read-only |
| **Integration syncs** | Feed jobs blocked, other syncs not checked | All syncs should be blocked |
| **Public directory** | expired_trial not filtered | Should be hidden or badged |
| **Dashboard UI** | Banner shown, but all widgets active | Widgets should show locked/disabled state |
| **Sidebar nav** | All links visible | Premium feature links should be hidden/disabled |

---

## 5. Recommended Trigger Actions (Priority Order)

### Tier 1 — Critical (Backend Hard Gates)

1. **Add `requireWritableSubscription` to bot-merchant write routes** — PUT `/config`, PUT `/skills/:skillId`, POST `/embeddings/refresh`, POST `/product-embeddings/refresh`, POST `/avatar`, POST `/dashboard-chat/start`, POST `/dashboard-chat/message`, POST `/gdpr-erase`, POST `/retention`, POST `/faq-webhook`

2. **Add `requireWritableSubscription` to CRM tenant write routes** — POST/PUT on contacts, tickets, ticket messages, inquiries, alerts, reorder endpoints

3. **Uncomment `checkSubscriptionLimits` on main items POST route** at `apps/api/src/index.ts:5155`

4. **Add subscription check to bot-public routes** — For `frozen`/`canceled` tenants, return a graceful "bot unavailable" response instead of processing messages. Keep `/config` endpoint working so the widget can display the unavailable state.

5. **Filter `expired_trial` tenants from public directory/storefront** — Add `WHERE subscription_tier != 'expired_trial'` to public tenant queries, or filter in the materialized view definition.

### Tier 2 — Important (Frontend UX)

6. **Disable bot widget on tenant dashboard** when `internalStatus === 'frozen' || 'canceled'` — show a "Upgrade to use chatbot" locked card instead of `PublicBotWidget`

7. **Disable CRM widget on tenant dashboard** when frozen — show a "CRM is read-only" locked card with upgrade CTA instead of `CrmTenantWidget`

8. **Hide/disable premium sidebar navigation links** for expired tenants (bot, CRM, integrations, quick start, scan). Note: navigation is database-driven — see `.devin/skills/database-navigation-system.md`. Links would need conditional visibility based on subscription status, or be filtered client-side.

9. **Disable settings pages** (storefront options, featured products, integrations) for frozen tenants — show locked state with upgrade CTA.

### Tier 3 — Operational (Background Jobs)

10. **Skip expired tenants in `bot-product-embedding-sync.ts`** — add `subscription_status NOT IN ('canceled', 'expired')` to the tenant query.

11. **Pause bot auto-responses** for expired tenants in `BotDynamicResponseService` — check subscription status before generating responses. Alternatively, check in `bot-public.ts` middleware before routing to the response service.

12. **Disable CRM auto-response rules** for expired tenants — if any auto-response or escalation rules exist, skip them for frozen tenants.

13. **Stop integration sync jobs** (GBP, Google Shopping, Clover, Square) for expired tenants — add subscription status checks to all sync job queries.

### Tier 4 — Graceful Degradation

14. **Customer-facing bot**: Instead of hard 403, show a branded "This store's assistant is temporarily unavailable" message with a link to the tenant's support email.

15. **Customer-facing CRM**: Keep ticket creation available (it's a support channel) but disable inquiry submission and bot escalation for expired tenants.

16. **Public storefront**: Keep visible but remove add-to-cart / checkout capabilities (commerce should already be gated by capability, but verify).

17. **Reactivation flow**: When a frozen tenant upgrades, automatically restore bot config, re-enable CRM write access, and trigger embedding refresh.

---

## 6. Subscription-Status-Aware Capability Resolution (Architectural Refactor)

### The Insight

Instead of bolting `requireWritableSubscription` middleware onto every individual route, the **capability resolution system itself** should factor in subscription status. This is the single chokepoint where all feature gating decisions are made — making it subscription-status-aware cascades automatically to every frontend component and backend route that reads capabilities.

### Current Architecture (The Gap)

The `EffectiveCapabilityResolver` at `apps/api/src/services/EffectiveCapabilityResolver.ts:71-219` is the core orchestrator. It:

1. Fetches tenant data including `subscription_status` and `subscription_tier` (line 104)
2. Fetches raw tier capabilities and merchant settings
3. Dispatches to 15 per-domain resolvers (commerce, CRM, chatbot, etc.)
4. Returns a unified `EffectiveCapabilities` manifest

**The critical gap:** The resolver fetches `subscription_status` at line 104 but **never passes it to the per-domain resolvers**. Each resolver (e.g., `CrmOptionsResolver.ts:20-23`, `ChatbotOptionsResolver.ts:36-39`) determines `enabled` purely from tier features and merchant preferences — subscription status is invisible to them.

### Data Flow Chain

```
EffectiveCapabilityResolver
  → fetches tenant.subscription_status (line 104) ← UNUSED in resolution
  → dispatches to resolveCrmOptions(features, capabilityEnabled)
  → dispatches to resolveChatbotOptions(features, capabilityEnabled)
  → ... 13 more resolvers
  → returns EffectiveCapabilities

Frontend:
  useEffectiveCapabilities(tenantId) → fetches /effective-capabilities
  useAllCapabilities(tenantId) → same via UnifiedCapabilityService
  → components read state.enabled, state.crm.enabled, state.chatbot.enabled
  → show/hide UI based on enabled flags
```

### Proposed Change

Make `EffectiveCapabilityResolver` derive the tenant's `internalStatus` and pass it to each per-domain resolver. When the tenant is `frozen`, `canceled`, or `expired`, the resolvers return `enabled: false` (or a degraded state).

#### Option A: Post-Resolution Override (Minimal Change)

After all 15 resolvers run, apply a subscription-status override in `EffectiveCapabilityResolver` before caching:

```typescript
// After line 181 (after all resolvers complete)
const internalStatus = deriveInternalStatus({
  subscriptionStatus: tenant.subscription_status || 'active',
  subscriptionTier: tenant.subscription_tier || 'starter',
  trialEndsAt: tenant.trial_ends_at,
  subscriptionEndsAt: tenant.subscription_ends_at,
});

const isReadOnly = internalStatus === 'frozen' || internalStatus === 'canceled' || internalStatus === 'expired';

if (isReadOnly) {
  // Override all capabilities to disabled
  result.effective.crm.enabled = false;
  result.effective.chatbot.enabled = false;
  result.effective.commerce.enabled = false;
  // ... etc for all capabilities
  // OR: zero out all `enabled` flags programmatically
}
```

**Pros:** Single file change, no resolver signature changes.
**Cons:** Brute-force override, doesn't allow per-capability degradation rules.

#### Option B: Pass Subscription Context to Resolvers (Clean Architecture)

Add a `SubscriptionContext` parameter to each resolver function:

```typescript
interface SubscriptionContext {
  internalStatus: InternalStatus;
  maintenanceState: MaintenanceState;
  isReadOnly: boolean;  // frozen || canceled || expired
  isLimited: boolean;   // maintenance || past_due
}
```

Each resolver then decides how to degrade:

```typescript
// CrmOptionsResolver.ts
export function resolveCrmOptions(
  features: Record<string, boolean>,
  capabilityEnabled?: boolean,
  subCtx?: SubscriptionContext  // NEW
): EffectiveCrm {
  // ... existing logic ...
  const enabled = (capabilityEnabled ?? !!feat.crm_enabled) && !subCtx?.isReadOnly;
  // ...
}
```

**Pros:** Each resolver controls its own degradation rules. Some capabilities could remain partially active (e.g., CRM read-only but no writes).
**Cons:** Requires updating all 15 resolver signatures.

#### Option C: Hybrid (Recommended)

Use Option A for the immediate override (fast to implement), then migrate to Option B as each capability gets its own degradation rules during implementation.

### Degradation Rules Per Capability

Not all capabilities should degrade the same way. Some should be fully disabled, others should become read-only, and some should remain active as support channels:

| Capability | Frozen | Canceled | Expired | Maintenance | Past Due |
|---|---|---|---|---|---|
| **Commerce** | Disabled | Disabled | Disabled | Read-only | Active |
| **Payment Gateway** | Disabled | Disabled | Disabled | Active | Active |
| **Storefront** | Read-only | Read-only | Read-only | Read-only | Active |
| **Fulfillment** | Disabled | Disabled | Disabled | Read-only | Active |
| **Barcode Scan** | Disabled | Disabled | Disabled | Disabled | Active |
| **Product Options** | Read-only | Read-only | Read-only | Read-only | Active |
| **Featured Options** | Read-only | Read-only | Read-only | Disabled | Active |
| **Integrations** | Disabled | Disabled | Disabled | Read-only | Active |
| **Quickstart** | Disabled | Disabled | Disabled | Disabled | Active |
| **Storefront Options** | Read-only | Read-only | Read-only | Read-only | Active |
| **Directory Entry** | Read-only | Read-only | Read-only | Read-only | Active |
| **FAQ** | Read-only | Read-only | Read-only | Active | Active |
| **CRM** | Read-only (tickets only) | Read-only | Read-only | Active | Active |
| **Chatbot** | Disabled | Disabled | Disabled | Disabled | Active |
| **Org Options** | Read-only | Read-only | Read-only | Read-only | Active |

**Key design decisions:**
- **CRM stays read-only** (not fully disabled) for frozen tenants — they can still view and respond to existing support tickets, but cannot create new inquiries or use advanced features
- **Chatbot is fully disabled** — no customer-facing bot for expired tenants
- **Storefront remains visible** (read-only) — the tenant's public presence stays, but they can't modify it
- **Payment Gateway stays active in maintenance** — tenants in maintenance can still process orders
- **Org Options is a first-class capability** — when a tenant is frozen, their org-level tabs (overview, locations, propagation, capabilities, team, commerce, billing) and panels (task_checklist, quick_links, system_status, recommendations, crm_summary) become read-only. Propagation operations (org_propagation_products, org_propagation_categories, org_propagation_business_info, org_propagation_settings) are disabled. The org's own subscription status is a separate consideration — see below.

### Organization Capability — Special Considerations

The `OrgOptionsResolver` at `apps/api/src/services/resolvers/OrgOptionsResolver.ts` is org-scoped rather than tenant-scoped. This introduces a dual-status dimension:

1. **Tenant-level freeze:** An individual tenant within an org is frozen → that tenant loses write access to org features (propagation, team management, commerce settings) but can still view org overview and billing
2. **Org-level freeze:** The org itself has a canceled/expired subscription → all member tenants lose org capabilities regardless of their individual status

**Current gap in `EffectiveCapabilityResolver`:** The resolver fetches `organizations_list.subscription_tier` (line 106) but **not** `organizations_list.subscription_status`. To properly gate org capabilities, the resolver should also fetch the org's subscription status and derive an `orgInternalStatus`. The org capability would then be disabled if **either** the tenant OR the org is in a read-only state.

**Additional fetch needed:**
```typescript
organizations_list: {
  select: {
    subscription_tier: true,
    subscription_status: true,  // NEW — needed for org-level freeze detection
  },
},
```

**Degradation rule for org:**
- If tenant is frozen/canceled/expired → org tabs become read-only (overview + billing visible, propagation disabled)
- If org is frozen/canceled/expired → org capability fully disabled for all members
- If both are active → full org access per tier features

### Frontend Impact

The frontend already reads capability states via:
- `useEffectiveCapabilities(tenantId)` → `apps/web/src/hooks/useEffectiveCapabilities.ts`
- `useAllCapabilities(tenantId)` → `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts:493-519`
- `useCrmOptionsCapability(tenantId)` → `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts:429-455`
- `useChatbotOptionsCapability(tenantId)` → `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts:461-487`
- Plus 11 more domain-specific hooks

All of these would automatically receive `enabled: false` from the backend. Components that already check `enabled` before rendering (like `CapabilityShowcase.tsx`, settings pages) would show locked states without any frontend changes.

The `TenantDashboardV2.tsx` bot widget and CRM widget sections would need to check the capability `enabled` flag before rendering, but this is a simple conditional — not a new system.

### Backend Route Protection

With subscription-status-aware capabilities, backend routes can use a capability-based middleware instead of `requireWritableSubscription`:

```typescript
// New middleware: requireCapabilityEnabled('crm')
// Checks the effective capability, which already factors in subscription status
export function requireCapabilityEnabled(capabilityKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = extractTenantId(req);
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps.effective[capabilityKey]?.enabled) {
      return res.status(403).json({
        error: 'capability_disabled',
        message: 'This feature is not available on your current plan',
        upgradeUrl: '/settings/subscription',
      });
    }
    next();
  };
}
```

This replaces both `requireWritableSubscription` and `requireTierFeature` with a single, unified gate that is automatically subscription-status-aware.

### Cache Invalidation

The `EffectiveCapabilityResolver` has a 60-second in-memory cache (`MEMORY_TTL_MS = 60_000` at line 49). When a tenant's subscription status changes (e.g., downgrade to `expired_trial`), the cache must be invalidated. The existing `invalidateEffectiveCapabilities(tenantId)` function at line 55 should be called from:

- `TrialManagementService.downgradeToExpired()` — after setting `expired_trial`
- `SubscriptionStatusService.handleGracePeriodExpiry()` — after grace period expires
- `SubscriptionStatusService.handlePaymentSuccess()` — after reactivation
- Any admin action that changes subscription status

### Key Files for This Refactor

| File | Change |
|---|---|
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Derive `internalStatus`, apply subscription override or pass to resolvers |
| `apps/api/src/services/resolvers/types.ts` | Add `SubscriptionContext` interface (Option B) |
| `apps/api/src/services/resolvers/CrmOptionsResolver.ts` | Accept and apply subscription context |
| `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts` | Accept and apply subscription context |
| `apps/api/src/services/resolvers/CommerceResolver.ts` | Accept and apply subscription context |
| `apps/api/src/services/resolvers/OrgOptionsResolver.ts` | Accept and apply subscription context — also needs org-level status check |
| `apps/api/src/services/resolvers/*.ts` | All 15 resolvers updated |
| `apps/api/src/services/subscription/TrialManagementService.ts` | Call `invalidateEffectiveCapabilities` after downgrade |
| `apps/api/src/services/subscription/SubscriptionStatusService.ts` | Call `invalidateEffectiveCapabilities` on status changes |
| `apps/api/src/middleware/tier-access.ts` | Optional: new `requireCapabilityEnabled` middleware |
| `apps/web/src/components/dashboard/TenantDashboardV2.tsx` | Check `enabled` flags before rendering bot/CRM widgets |

---

## 7. SubscriptionDisplayCard Visual Status Indicator

### Current State

File: `apps/web/src/components/subscription/SubscriptionDisplayCard.tsx`

The card currently shows a `Badge` with a basic color mapping (lines 95-103):

```typescript
const getStatusColor = (status: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'active': return 'success';
    case 'trial': return 'info';
    case 'past_due': return 'warning';
    case 'canceled': return 'error';
    default: return 'default';
  }
};
```

This only maps the raw `subscription_status` — it does **not** account for derived `internalStatus` (frozen, maintenance, expired). The card itself has no border or background color treatment based on status.

The card is rendered on both dashboard versions:
- `TenantDashboardV2.tsx:423`
- `TenantDashboard.tsx:518`

### Proposed Enhancement

Add a subtle visual indicator to the `SubscriptionDisplayCard` based on the tenant's **derived internal status** (not just raw `subscription_status`). The indicator should use the `deriveInternalStatus()` function from `apps/web/src/lib/subscription-status.ts` and the `useSubscriptionUsage` hook which already provides `internalStatus`.

#### Color Mapping (Subtle Tones)

| Internal Status | Badge Color | Card Border | Card Background | Dot Indicator |
|---|---|---|---|---|
| `active` | Green | `border-emerald-200` | `bg-emerald-50/30` | `bg-emerald-500` |
| `trialing` | Blue | `border-blue-200` | `bg-blue-50/30` | `bg-blue-500` |
| `past_due` | Amber | `border-amber-200` | `bg-amber-50/30` | `bg-amber-500` |
| `maintenance` | Yellow | `border-yellow-200` | `bg-yellow-50/30` | `bg-yellow-500` |
| `frozen` | Red | `border-red-200` | `bg-red-50/30` | `bg-red-500` |
| `canceled` | Red | `border-red-200` | `bg-red-50/30` | `bg-red-500` |
| `expired` | Red | `border-red-200` | `bg-red-50/30` | `bg-red-500` |

**Design principles:**
- Colors should be subtle (50/30 opacity backgrounds, 200 border weight)
- Not saturated — the card should blend with the dashboard aesthetic
- A small colored dot next to the "Subscription" title for at-a-glance status
- The existing status badge in the card body should use the same color mapping
- Dark mode variants: use `dark:bg-*-950/30` and `dark:border-*-800` equivalents

#### Implementation Notes

- The `useSubscriptionUsage` hook (`apps/web/src/hooks/useSubscriptionUsage.ts`) already derives `internalStatus` and `maintenanceState` — reuse this instead of re-deriving
- The `SubscriptionDisplayCard` currently receives `tierData` as a prop with raw `subscriptionStatus` — it should also receive or derive `internalStatus`
- Option A: Pass `internalStatus` as an additional prop from the parent dashboard
- Option B: Use `useSubscriptionUsage(tenantId)` inside the card itself (simpler, self-contained)
- The card border/background treatment should be applied to the outer `<Card>` element at line 268

#### Affected Files

| File | Change |
|---|---|
| `apps/web/src/components/subscription/SubscriptionDisplayCard.tsx` | Add status-based border/bg/dot, update `getStatusColor` to use `internalStatus` |
| `apps/web/src/components/dashboard/TenantDashboardV2.tsx` | Pass `internalStatus` if using Option A |
| `apps/web/src/components/dashboard/TenantDashboard.tsx` | Pass `internalStatus` if using Option A |

---

## 8. Key Files Reference

### Backend

| File | Purpose |
|---|---|
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | **Core orchestrator** — fetches tenant + tier + merchant settings, dispatches to 15 resolvers. Fetches `subscription_status` but doesn't use it. |
| `apps/api/src/services/resolvers/types.ts` | Types for all 15 effective capability interfaces + merchant settings |
| `apps/api/src/services/resolvers/CrmOptionsResolver.ts` | CRM capability resolver — `enabled` from tier features only |
| `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts` | Chatbot capability resolver — `enabled` from tier features only |
| `apps/api/src/services/resolvers/*.ts` | All 15 per-domain resolvers |
| `apps/api/src/utils/subscription-status.ts` | `deriveInternalStatus()`, `getMaintenanceState()` |
| `apps/api/src/middleware/tier-access.ts:484-539` | Active `requireWritableSubscription` middleware |
| `apps/api/src/middleware/subscription.ts` | Dead middleware (not imported by routes) |
| `apps/api/src/services/subscription/SubscriptionStatusService.ts` | Status transition handlers |
| `apps/api/src/services/subscription/TrialManagementService.ts` | Trial lifecycle, `downgradeToExpired()` |
| `apps/api/src/jobs/subscription-grace-period.ts` | Daily grace period processing job |
| `apps/api/src/jobs/expireManualSubscriptionControl.ts` | Manual subscription control expiry |
| `apps/api/src/jobs/bot-product-embedding-sync.ts` | Bot embedding sync (no sub check) |
| `apps/api/src/routes/bot-merchant.ts` | Bot merchant routes (no sub gating) |
| `apps/api/src/routes/bot-public.ts` | Bot public routes (no sub gating) |
| `apps/api/src/routes/crm/tenant/crm-tenant.ts` | Tenant CRM routes (no sub gating) |
| `apps/api/src/routes/crm/customer/crm-customer.ts` | Customer CRM routes (no sub gating) |
| `apps/api/src/routes/feed-jobs.ts` | Feed jobs (has inline freeze check) |
| `apps/api/src/routes/clone.ts` | Clone routes (gated) |
| `apps/api/src/routes/quick-start.ts` | Quick start routes (gated) |
| `apps/api/src/routes/scan.ts` | Scan routes (gated) |
| `apps/api/src/index.ts:5155` | Main items POST (checkSubscriptionLimits commented out) |

### Frontend

| File | Purpose |
|---|---|
| `apps/web/src/hooks/useEffectiveCapabilities.ts` | React Query hook fetching `/effective-capabilities` endpoint |
| `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` | 15+ domain-specific capability hooks (CRM, chatbot, commerce, etc.) |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Frontend service wrapping the effective-capabilities API call |
| `apps/web/src/lib/subscription-status.ts` | Frontend `deriveInternalStatus()`, `getMaintenanceState()`, `getStatusLabel()`, `getStatusColor()` |
| `apps/web/src/hooks/useSubscriptionUsage.ts` | Hook providing `internalStatus`, `maintenanceState`, SKU/location usage |
| `apps/web/src/components/subscription/SubscriptionDisplayCard.tsx` | Subscription card (needs visual status indicator) |
| `apps/web/src/components/subscription/SubscriptionStateBanner.tsx` | Frozen/maintenance banner (working) |
| `apps/web/src/components/dashboard/TenantDashboardV2.tsx` | Main tenant dashboard (renders banner, bot widget, CRM widget, subscription card) |
| `apps/web/src/components/dashboard/TenantDashboard.tsx` | Legacy tenant dashboard (same components) |
| `apps/web/src/components/dashboard/CapabilityShowcase.tsx` | Capability display on dashboard |
| `apps/web/src/lib/capability-gate.ts` | Tier-based capability gate engine |
| `apps/web/src/services/CapabilityResolutionService.ts` | Capability resolution types and logic |

---

## 9. Implementation Phases (Revised)

### Phase 1: Subscription-Status-Aware Capability Resolution (Core Refactor)
**This is the foundational change — all subsequent phases build on it.**

- Add `deriveInternalStatus()` call in `EffectiveCapabilityResolver` using the already-fetched `subscription_status`
- Apply subscription-status override to all 15 effective capability results (Option A — post-resolution override)
- Add cache invalidation calls in `TrialManagementService.downgradeToExpired()` and `SubscriptionStatusService` status change handlers
- Verify frontend automatically receives disabled capabilities via existing hooks

### Phase 2: SubscriptionDisplayCard Visual Indicator
- Implement subtle color-coded status indicator on the card
- Update badge color mapping to use `internalStatus` (green=active, blue=trial, amber=past_due, yellow=maintenance, red=frozen/canceled/expired)
- Add card border/background/dot treatment with low-opacity subtle tones

### Phase 3: Frontend Widget Locking
- Check `enabled` flags from capability state before rendering bot widget on dashboard
- Check `enabled` flags before rendering CRM widget on dashboard
- Disable/hide premium nav links for expired tenants (client-side filtering on capability state)
- Lock settings pages when their capability is disabled

### Phase 4: Backend Route Protection via Capabilities
- Replace per-route `requireWritableSubscription` with `requireCapabilityEnabled('crm')`, `requireCapabilityEnabled('chatbot')`, etc.
- Uncomment `checkSubscriptionLimits` on items route or replace with capability check
- Add capability check to bot-public routes (return graceful unavailable response)
- Filter `expired_trial` from public directory/storefront views

### Phase 5: Background Job Gating
- Skip expired tenants in `bot-product-embedding-sync.ts`
- Pause bot auto-responses for expired tenants
- Stop integration sync jobs for expired tenants

### Phase 6: Graceful Degradation
- Customer-facing bot: branded unavailable message instead of hard 403
- Customer CRM: keep ticket creation as support channel, disable inquiries
- Public storefront: keep visible but commerce disabled (already handled by capability)
- Reactivation flow: auto-restore capabilities on upgrade (cache invalidation handles this)
