---
description: Complete guide for implementing and extending the Directory Promotion feature — covers lifecycle, data model, badge integration, bot knowledge, admin UI, tenant analytics, notifications, and navigation
---

# Directory Promotion Guide

> **Read this before working on any directory promotion feature.** This guide captures patterns, conventions, and architecture decisions from Sprints 1–6 of the Directory Promotion implementation.

## Feature Overview

Directory Promotion is a monetized feature that lets store owners promote their business in the public directory. It supports leveled plans (basic, premium, featured), one-time or auto-renewing purchases, grace periods, and analytics tracking.

**Trail-blazing status**: Directory Promotion is the first fully capability-aligned automated type on the platform. All feature keys are registered in `features_list` + `capability_features_list` (migration 086), making it the reference pattern for future automated capability types.

**Design doc**: `docs/DIRECTORY_PROMOTION_SPRINT_PLAN.md`

---

## 1. Data Model

### Core Tables

| Table | Purpose |
|---|---|
| `promotion_catalog` | Admin-managed plans (level, duration, price, active flag) |
| `promotion_purchases` | Purchase records (tenant, plan, status, Stripe payment, renewal chain) |
| `directory_listings_list` | Materialized view — promotion columns: `is_promoted`, `promotion_tier`, `promotion_started_at`, `promotion_expires_at`, `promotion_impressions`, `promotion_clicks` |
| `features_list` | Capability feature keys: `directory_promotion_enabled`, `_flexible`, `_disabled`, `_level_basic`, `_level_premium`, `_level_featured` |
| `capability_features_list` | Links all 6 directory_promotion feature keys to the `directory_promotion` capability type |
| `tier_features_list` | Platform tier → feature key assignments (controls which promotion levels each tier can purchase) |
| `badge_events` | Unified analytics log — promotion impressions/clicks tracked via `trackBadgeEvent` |
| `bot_knowledge_embeddings` | RAG embeddings — `source_type='promotion'` for bot knowledge |

### Purchase Status Flow

```
pending → active → (grace_period → expired | cancelled)
                ↻ renewed (auto-renewal creates new purchase, chains via renewed_from)
```

### Key Columns on `promotion_purchases`

- `id`: tenant-scoped ID via `generatePromotionPurchaseId` (`promo-{tk}-{nanoid}`)
- `plan_key`: references `promotion_catalog.plan_key`
- `tier`: `'basic' | 'premium' | 'featured'` (promotion level — not to be confused with platform subscription tiers)
- `status`: `'pending' | 'active' | 'grace_period' | 'expired' | 'cancelled'`
- `stripe_payment_intent_id`: payment reference
- `renewed_from`: ID of previous purchase (for auto-renewal chain)
- `auto_renew`: boolean
- `price_cents`, `currency`, `duration_days`

---

## 2. Backend Services

### `DirectoryPromotionService` (extends `BaseService`)

**File**: `apps/api/src/services/DirectoryPromotionService.ts`

Key methods:
- `getAvailableLevels()` — queries `features_list` for `directory_promotion_level_*` keys, returns available promotion levels (falls back to `['basic', 'premium', 'featured']` if none found)
- `listPlans(tenantId)` — active plans from catalog
- `createPurchase(tenantId, planKey)` — creates pending purchase + Stripe payment intent
- `activatePurchase(purchaseId, stripePaymentIntentId?)` — sets active, updates `directory_listings_list`, fires billing notification + bot embedding refresh
- `deactivatePurchase(purchaseId, reason)` — sets expired/cancelled, clears promotion columns, fires notification + embedding refresh
- `enterGracePeriod(purchaseId)` — sets grace_period status, fires warning notification
- `cancelPromotion(tenantId)` — tenant-initiated, stops auto-renewal
- `getRevenueSummary()` — admin revenue metrics (total, by tier, by status)
- `getDashboardStats()` — CRM dashboard widget data
- `getAnalytics(tenantId)` — tenant-facing analytics (impressions, clicks, CTR, daily averages)

### Fire-and-Forget Pattern

After any lifecycle transition, two fire-and-forget async IIFEs are dispatched:

```typescript
// 1. Billing notification (email + CRM alert)
(async () => {
  try {
    await getBillingNotificationService().sendNotification({ ... });
  } catch (err) {
    logger.warn('[DirectoryPromotion] Failed to send notification', undefined, { error: ... });
  }
})();

// 2. Bot knowledge embedding refresh
(async () => {
  try {
    await BotKnowledgeEmbeddingService.getInstance().refreshPromotionEmbeddings(tenant.tenant_id);
  } catch (err) {
    logger.warn('[DirectoryPromotion] Failed to refresh embeddings', undefined, { error: ... });
  }
})();
```

**Why fire-and-forget**: The main transaction (purchase activation, deactivation) must not block on email delivery or embedding generation. Failures are logged but don't roll back the lifecycle change.

### `BotKnowledgeEmbeddingService.refreshPromotionEmbeddings(tenantId)`

**File**: `apps/api/src/services/BotKnowledgeEmbeddingService.ts`

1. Deletes existing `source_type='promotion'` embeddings for the tenant
2. Reads `directory_listings_list` for active promotion (level, dates, impressions, clicks)
3. Chunks into text via `chunkPromotion()` — includes level label, features list, dates, performance stats
4. Generates embedding and inserts into `bot_knowledge_embeddings`
5. Returns `{ processed, chunks }` — `{ 0, 0 }` if no active promotion (clears stale embeddings)

### `BotDynamicResponseService` — Promotion RAG

**File**: `apps/api/src/services/BotDynamicResponseService.ts`

Promotion RAG search is **not skill-gated** (unlike fulfillment which requires `chatbot_skill_inventory`). It's always available when promotion embeddings exist, because promotion status is factual store information that any customer might ask about.

```typescript
const hasPromotion = await knowledgeService.hasKnowledgeEmbeddings(tenantId, 'promotion');
if (hasPromotion) {
  const promotionResult = await knowledgeService.searchKnowledge(tenantId, message, ['promotion'], 2);
  if (promotionResult.chunks.length > 0) {
    knowledgeContext += '\n\nPromotion context:\n' + promotionResult.chunks.map(c => c.chunkText).join('\n\n');
  }
}
```

---

## 3. Badge Integration

### `directory_promoted` Badge

- Registered in `BadgeRegistryService` with `promotionalPriority: 200`
- Store-level badge (not product-level) — `inventoryItemId: 'store-level'`
- Appears on directory listings when `is_promoted = TRUE` on `directory_listings_list`

### Analytics Tracking

Impression and click endpoints in `apps/api/src/routes/promotion.ts`:

```typescript
// POST /api/tenants/:tenantId/promotion/track-impression
trackBadgeEvent({
  tenantId,
  badgeKey: 'directory_promoted',
  inventoryItemId: 'store-level',
  eventType: 'view',
}).catch(() => {});

// POST /api/tenants/:tenantId/promotion/track-click
trackBadgeEvent({
  tenantId,
  badgeKey: 'directory_promoted',
  inventoryItemId: 'store-level',
  eventType: 'click',
}).catch(() => {});
```

**Important**: Do NOT reuse the `featured` badge for directory promotion. Do NOT write to `featured_products` — this is a store-level badge, not a product-level badge.

---

## 4. Notification Types

Five notification types registered in `BillingNotificationService`:

| Type | Triggered On | Email Content | CRM Alert |
|---|---|---|---|
| `directory_promotion_purchased` | `activatePurchase` (new) | Level label, duration, expiration, price | Info severity |
| `directory_promotion_renewal_success` | `activatePurchase` (renewal) | Renewal confirmation, new expiration | Info severity |
| `directory_promotion_renewal_failed` | `promotion-renewal.ts` job | Payment failure, grace period start | Warning severity |
| `directory_promotion_grace_period_warning` | `enterGracePeriod` | Grace period warning, expiration date | Warning severity |
| `directory_promotion_expired` | `deactivatePurchase` | Expiration notice | Info severity |

Email templates include `process.env.WEB_URL` for constructing links back to the platform.

---

## 5. Renewal Job

**File**: `apps/api/src/jobs/promotion-renewal.ts`

Runs daily. Processes:
1. **Auto-renewals**: Active purchases expiring today with `auto_renew=true` → Stripe charge → new purchase record → activate
2. **Grace period entry**: Failed renewals → `enterGracePeriod()` → 7-day grace window
3. **Grace period expiration**: Grace period purchases past 7 days → `deactivatePurchase('expired')`
4. **Natural expirations**: Active purchases past `expires_at` without auto-renew → `deactivatePurchase('expired')`

Each transition fires the appropriate billing notification via `sendBillingNotification()` helper.

---

## 6. API Routes

**File**: `apps/api/src/routes/promotion.ts` (mounted at `/api`)

### Tenant Endpoints
- `GET /api/tenants/:tenantId/promotion/plans` — list active plans
- `POST /api/tenants/:tenantId/promotion/purchase` — create purchase + Stripe intent
- `POST /api/tenants/:tenantId/promotion/activate/:purchaseId` — activate after payment
- `POST /api/tenants/:tenantId/promotion/cancel` — cancel auto-renewal
- `GET /api/tenants/:tenantId/promotion/status` — current promotion status
- `GET /api/tenants/:tenantId/promotion/analytics` — impressions, clicks, CTR, daily averages
- `POST /api/tenants/:tenantId/promotion/track-impression` — increment + badge event
- `POST /api/tenants/:tenantId/promotion/track-click` — increment + badge event

### Admin Endpoints
- `GET /api/admin/promotion/levels` — list available promotion levels from capability feature keys (`directory_promotion_level_*`)
- `GET /api/admin/promotion/catalog` — list all plans (including inactive)
- `POST /api/admin/promotion/catalog` — create plan (plan_key auto-generated from level + duration)
- `PUT /api/admin/promotion/catalog/:planKey` — update plan
- `DELETE /api/admin/promotion/catalog/:planKey` — delete plan
- `GET /api/admin/promotion/revenue` — revenue summary
- `GET /api/admin/promotion/purchases` — list all purchases
- `GET /api/admin/promotion/stats` — CRM dashboard widget data
- `GET /api/admin/promotion/tenant/:tenantId` — tenant-specific promotion data for CRM

---

## 7. Frontend Architecture

### `DirectoryPromotionService` (singleton)

**File**: `apps/web/src/services/DirectoryPromotionService.ts`

Extends `TenantApiSingleton`. Methods:
- `getPlans(tenantId)`, `getStatus(tenantId)`, `createPurchase()`, `activatePurchase()`, `cancelPromotion()`
- `getAnalytics(tenantId)` — tenant analytics dashboard data
- `trackImpression(tenantId)` — fire-and-forget POST to `/promotion/track-impression` (no caching, silent failure)
- `trackClick(tenantId)` — fire-and-forget POST to `/promotion/track-click` (no caching, silent failure)
- `adminGetLevels()` — fetches available promotion levels from `GET /api/admin/promotion/levels` (capability-driven)
- `adminListPlans()`, `adminCreatePlan()`, `adminUpdatePlan()`, `adminDeletePlan()` — catalog CRUD (create no longer requires `planKey` — auto-generated by backend)
- `adminGetRevenue()`, `adminListPurchases()` — admin revenue dashboard

All methods use `makeDefaultRequest` with cache keys prefixed `directory-promotion-*`. Tracking methods are fire-and-forget (no cache key, wrapped in try/catch with empty catch).

### Frontend Tracking Wiring

Impression and click tracking must be fired by directory components when rendering or clicking promoted store cards. The pattern uses a `useRef` guard to ensure impressions fire only once per component mount:

**Components that fire tracking:**

| Component | Impression | Click |
|---|---|---|
| `StoreCard.tsx` | `useEffect` on mount, guarded by `impressionFired` ref | `onClick` on `<Link>` |
| `UnifiedStoreCard.tsx` | `useEffect` after `isPromoted` is declared, guarded by `impressionFired` ref | `onClick` on all 4 `<Link>` elements (list title, grid logo, grid title, visit button) |
| `PromotedStoresCarousel.tsx` | Fires for all stores after fetch completes, guarded by `impressionFired` ref | `onClick` on each store `<Link>` |

**Important**: In `UnifiedStoreCard`, the `useEffect` must be placed AFTER the `isPromoted` variable declaration (line ~108), not before it. Placing it before causes TS2448 (block-scoped variable used before declaration).

**Pattern**:
```typescript
const impressionFired = useRef(false);

useEffect(() => {
  if (listing.isPromoted && !impressionFired.current) {
    impressionFired.current = true;
    DirectoryPromotionService.trackImpression(listing.tenantId);
  }
}, [listing.isPromoted, listing.tenantId]);

// On Link click:
onClick={() => { if (listing.isPromoted) DirectoryPromotionService.trackClick(listing.tenantId); }}
```

### Pages

| Route | File | Purpose |
|---|---|---|
| `/t/[tenantId]/settings/promotion` | `page.tsx` | Tenant promotion management (purchase, status, cancel) |
| `/t/[tenantId]/settings/promotion/analytics` | `analytics/PromotionAnalyticsClient.tsx` | Tenant analytics dashboard |
| `/settings/admin/promotion-catalog` | `promotion-catalog/PromotionCatalogClient.tsx` | Admin CRUD for plans |
| `/settings/admin/promotion-revenue` | `promotion-revenue/PromotionRevenueDashboard.tsx` | Admin revenue dashboard |

### UI Patterns

- **Server component** wraps **client component** — `page.tsx` imports and renders the `*Client.tsx`
- **Loading states**: Full-page spinner with `RefreshCw` animated icon
- **Error states**: Red-bordered alert box with error message
- **Empty states**: Centered icon + heading + description, with CTA when applicable
- **Level colors**: `basic: amber`, `premium: blue`, `featured: purple` — consistent across all pages
- **Promise.allSettled**: Used in revenue dashboard to fetch from multiple services gracefully

### Settings Cards

Admin settings cards are in `apps/web/src/app/(platform)/settings/admin/page.tsx`:
- "Promotion Catalog" — amber, `tags` icon, `bg-amber-600`
- "Promotion Revenue" — indigo, `chart` icon, `bg-indigo-600`

Tenant promotion page has inline "View detailed analytics" link to the analytics sub-page.

### Navigation Links

- **Tenant sidebar**: `nav-tenant-directory-promotion` — sibling of "Featured Store" (migration 079)
- **Admin sidebar**: `nav-admin-promotion-catalog` and `nav-admin-promotion-revenue` — siblings of "Placement Revenue" (migration 080)
- **File-based fallbacks**: Updated in `DynamicTenantSidebar.tsx` (tenant) and `AdminNavContent.tsx` (admin)

---

## 8. CRM Integration

### CRM Dashboard Widget

**File**: `apps/web/src/app/(platform)/settings/admin/crm/page.tsx`

`DirectoryPromotionsWidget` shows:
- Active count, total revenue, grace period count, expired count
- 3-column layout: upcoming renewals, grace period promotions, recent activations

### CRM Tenant Detail — Promotion Tab

**File**: `apps/web/src/app/(platform)/settings/admin/crm/tenants/[tenantId]/page.tsx`

Shows current promotion status (tier, status badge, price, dates, auto-renew) and purchase history table.

### Frontend Service

**File**: `apps/web/src/services/crm/CrmAdminService.ts`

- `getPromotionStats()` — calls `GET /api/admin/promotion/stats`
- `getTenantPromotion(tenantId)` — calls `GET /api/admin/promotion/tenant/:tenantId`

---

## 9. Common Pitfalls

1. **Don't confuse `promotion_catalog` with `promotion_purchases`** — catalog is admin-managed plans (templates), purchases are tenant transactions. A purchase references a plan by `plan_key`.

2. **Don't forget to update `directory_listings_list`** — The materialized view has promotion columns that must be set on activation and cleared on deactivation. This is what the directory badge display reads.

3. **Don't skip `invalidateBadgeRegistryCache()`** — After activation or deactivation, call this to ensure the `directory_promoted` badge appears/disappears immediately in the storefront.

4. **Use fire-and-forget for side effects** — Notifications and embedding refreshes should never block the main lifecycle transaction. Wrap in `(async () => { try { ... } catch { logger.warn(...) } })()`.

5. **Tenant-scoped IDs only** — All `promotion_purchases` and `promotion_catalog` IDs must use `generatePromotionPurchaseId` / `generatePromotionCatalogId` from `id-generator.ts`. Never use `randomUUID()`.

6. **Analytics is read-only on `directory_listings_list`** — The `promotion_impressions` and `promotion_clicks` columns are incremented via `UPDATE ... SET col = col + 1` in the track endpoints. The analytics endpoint reads them and computes CTR/daily averages in SQL.

7. **Bot knowledge is optional** — If `BotKnowledgeEmbeddingService.refreshPromotionEmbeddings` fails, the bot still works — it just won't have promotion context in its RAG. The fire-and-forget pattern ensures this.

8. **Settings cards + nav links are separate concerns** — Settings cards go on the landing page (`admin/page.tsx` or tenant settings). Nav links go in the sidebar (DB-driven via `navigation_links` table + file-based fallback). Both are needed for discoverability.

---

## 10. Extension Points

### Adding a New Promotion Level

1. Add a `directory_promotion_level_{name}` feature key to `features_list` + link to `directory_promotion` in `capability_features_list`
2. Add to `ALL_LEVELS` in `DirectoryPromotionResolver.ts` (resolver is a pure function — cannot query DB)
3. Add to `TIER_FEATURES` in tenant promotion page
4. Add to `LEVEL_COLORS` in promotion UI components (for badge color)
5. Add to `tierFeatures` map in `BotKnowledgeEmbeddingService.chunkPromotion()`
6. Add to `tierLabels` map in `BotKnowledgeEmbeddingService.chunkPromotion()`
7. Create a `promotion_catalog` entry via admin UI — level dropdown auto-populates from `features_list`, plan key auto-generated as `{level}_{duration}day`

**Note**: Steps 1 and 7 are now the primary steps. The admin catalog dropdown and backend validation are **DB-driven** — they automatically pick up new levels from `features_list`. Steps 2–6 are for the resolver, frontend display, and bot knowledge — they still require manual updates because those components use hardcoded arrays/maps.

### Adding a New Notification Type

1. Add to `BillingNotificationType` union in `BillingNotificationService.ts`
2. Add `buildEmailPayload` switch case
3. Add `buildCrmAlertPayload` switch case
4. Add email template builder method
5. Fire from the appropriate lifecycle method in `DirectoryPromotionService` or `promotion-renewal.ts`

### Adding a New Admin Dashboard Metric

1. Add aggregation method to `DirectoryPromotionService` (backend)
2. Add route in `promotion.ts` if new endpoint needed
3. Add method to frontend `DirectoryPromotionService` or `CrmAdminService`
4. Add UI card/section to the dashboard component
5. Use `Promise.allSettled` when combining data from multiple services

---

## 11. Capability-Gated Purchase Model

Directory Promotion is the first capability type where the platform tier's feature key assignment directly controls **which promotion levels a tenant can purchase**. This is the trail-blazing pattern for automated capability types.

### How Platform Tier Controls Promotion Level Availability

The `DirectoryPromotionResolver` reads the tenant's platform tier feature keys and builds an `allowed_tiers` array. The `DirectoryPromotionService.createPurchase()` method checks this array before allowing a purchase.

| Platform Tier Assignment | `enabled` | `allowed_tiers` | Effect on Tenant |
|---|---|---|---|
| `directory_promotion_disabled` | `false` | `[]` | Promotion completely unavailable — no levels purchasable |
| `directory_promotion_flexible` | `true` | `['basic', 'premium', 'featured']` | All levels available for purchase |
| `directory_promotion_enabled` only | `true` | `[]` | Promotion enabled but no specific levels granted — tenant must purchase levels via BSaaS or upgrade |
| `directory_promotion_level_basic` | `true` | `['basic']` | Only Basic level purchasable |
| `directory_promotion_level_basic` + `_level_premium` | `true` | `['basic', 'premium']` | Basic and Premium levels purchasable |
| All three `_level_*` keys | `true` | `['basic', 'premium', 'featured']` | All levels purchasable (same as flexible) |
| No keys assigned | `false` | `[]` | Default disabled — no levels purchasable |

### Why This Is Groundbreaking

This pattern unifies two previously separate concepts:

1. **Capability gating** (can the tenant access this feature at all?) — controlled by `_enabled` / `_disabled` / `_flexible`
2. **Tier-differentiated offerings** (which specific options within the capability can the tenant purchase?) — controlled by individual `_level_*` feature keys

Before this, capability types either had flat feature keys (on/off per feature) or group gates (creation/layout/sections). Directory Promotion introduces **purchasable levels** — where the platform tier determines the ceiling of what's available, and the tenant purchases within that ceiling.

### Data Flow

```
Platform Tier (subscription_tiers_list)
  ↓
tier_features_list (which directory_promotion_* keys are enabled for this tier)
  ↓
DirectoryPromotionResolver.resolveDirectoryPromotion()
  → enabled: !_disabled && (_enabled || _flexible || any _level_* key)
  → allowed_tiers: [_level_basic, _level_premium, _level_featured] filtered by tier assignment
  ↓
DirectoryPromotionService.createPurchase()
  → checks enabled && allowed_tiers.includes(plan.tier)
  → blocks purchase if level not in allowed_tiers
  ↓
Tenant purchases within their allowed levels
```

### Admin UI Implications

In the admin tier-capabilities dialog, admins assign `directory_promotion_*` feature keys to platform tiers:
- **Trial tier**: Assign `directory_promotion_disabled` → no promotions available
- **Starter tier**: Assign `directory_promotion_level_basic` → only Basic purchasable
- **Growth tier**: Assign `directory_promotion_level_basic` + `_level_premium` → Basic and Premium purchasable
- **Scale/Enterprise tier**: Assign `directory_promotion_flexible` → all levels purchasable

This replaces the previous hard-coded tier mapping in `registry.yaml` with a fully admin-manageable capability assignment.

### Catalog-Level Alignment

The admin promotion catalog (`/settings/admin/promotion-catalog`) is now **fully aligned** with capability features:

- **Level dropdown**: Dynamically populated from `GET /api/admin/promotion/levels`, which queries `features_list` for `directory_promotion_level_*` keys — no hardcoded `<option>` tags
- **Plan key**: Auto-generated as `{level}_{duration}day` (e.g., `basic_30day`, `premium_90day`) — admin no longer types a plan key
- **Backend validation**: `createCatalogPlan()` and `updateCatalogPlan()` validate the level against `features_list` — rejects with `invalid_level` if the feature key doesn't exist
- **Duplicate prevention**: Creating a plan with an existing level+duration combination returns `plan_key_exists` (409)

This eliminates the previous three-independent-hardcoded-lists problem (resolver `ALL_LEVELS`, backend `validTiers`, frontend `<select>` options). Adding a new level to `features_list` automatically makes it available in the admin dropdown and passes backend validation.

---

## 12. Tier Feature Auditing

### `TIER_FEATURES` Constant

**File**: `apps/web/src/app/t/[tenantId]/settings/promotion/page.tsx`

The `TIER_FEATURES` constant maps level names to feature lists displayed on the promotion purchase page. **Every feature listed must be backed by an actual platform-delivered capability.** Do not list features that the platform cannot deliver.

### Current Delivered Features (as of 2026-07-04)

| Level | Feature | Delivery Mechanism |
|---|---|---|
| Basic | Gold marker on map | `DirectoryMap.tsx` / `DirectoryMapGoogle.tsx` — gold pin, larger size, star badge, z-index boost |
| Basic | Promoted badge | `StoreCard.tsx` / `UnifiedStoreCard.tsx` — registry-driven badge with tier-colored gradient |
| Basic | Higher visibility | `directory-v2.ts` — SQL `ORDER BY promotionBoost` (featured=0, premium=1, basic=2) |
| Basic | Basic analytics | `/promotion/analytics` endpoint — impressions, clicks, CTR, daily averages |
| Premium | Featured in search results | `directory-v2.ts` — premium tier gets boost priority 1 |
| Premium | Homepage carousel spot | `PromotedStoresCarousel.tsx` — renders in 3 directory layouts |
| Premium | Detailed analytics dashboard | `/t/[tenantId]/settings/promotion/analytics` page with CTR, daily averages, days active |
| Premium | Chatbot promotion awareness | `BotKnowledgeEmbeddingService.refreshPromotionEmbeddings()` — RAG context injection |
| Featured | Highest search priority | `directory-v2.ts` — featured tier gets boost priority 0 |
| Featured | Premium badge styling | Purple gradient badge in `StoreCard`, `UnifiedStoreCard`, `PromotedStoresCarousel` |
| Featured | Enhanced carousel placement | Purple gradient carousel cards with tier-colored borders |
| Featured | Automated renewal protection | `promotion-renewal.ts` job + 7-day grace period + billing email/CRM alerts |

### Audit Methodology

When auditing level features against platform delivery:

1. **Search the backend service** (`DirectoryPromotionService.ts`) for activation/deactivation logic — what columns are set/cleared on `directory_listings_list`
2. **Search the directory rendering components** (`StoreCard.tsx`, `UnifiedStoreCard.tsx`, `DirectoryMap.tsx`, `DirectoryMapGoogle.tsx`, `PromotedStoresCarousel.tsx`) for `isPromoted` / `promotionTier` conditional rendering
3. **Search the directory API** (`directory-v2.ts`) for SQL `ORDER BY` clauses that boost promoted listings
4. **Search for analytics endpoints** (`promotion.ts`) — what metrics are returned and are they level-differentiated
5. **Search for ancillary systems** — bot knowledge embeddings, billing notifications, renewal jobs, CRM widgets
6. **Map each promised feature** to the specific code that delivers it. If no code delivers it, either replace the feature text with a delivered equivalent or implement the missing capability

### Level Card Interactivity

The level cards on the promotion page must be `<button>` elements (not `<div>`) with `onClick` handlers that call `setSelectedPlanKey(firstPlan.planKey)` for the clicked level. This enables:
- All three levels (basic, premium, featured) to be selectable
- Duration options and price summary to update dynamically based on selected level
- Keyboard accessibility (buttons are focusable by default)

If level cards are non-interactive `<div>` elements, only the default level (premium) is selectable and the other levels are visually present but functionally inert.
