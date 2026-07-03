---
description: Complete guide for implementing and extending the Directory Promotion feature — covers lifecycle, data model, badge integration, bot knowledge, admin UI, tenant analytics, notifications, and navigation
---

# Directory Promotion Guide

> **Read this before working on any directory promotion feature.** This guide captures patterns, conventions, and architecture decisions from Sprints 1–6 of the Directory Promotion implementation.

## Feature Overview

Directory Promotion is a monetized feature that lets store owners promote their business in the public directory. It supports tiered plans (basic, premium, featured), one-time or auto-renewing purchases, grace periods, and analytics tracking.

**Design doc**: `docs/DIRECTORY_PROMOTION_SPRINT_PLAN.md`

---

## 1. Data Model

### Core Tables

| Table | Purpose |
|---|---|
| `promotion_catalog` | Admin-managed plans (tier, duration, price, active flag) |
| `promotion_purchases` | Purchase records (tenant, plan, status, Stripe payment, renewal chain) |
| `directory_listings_list` | Materialized view — promotion columns: `is_promoted`, `promotion_tier`, `promotion_started_at`, `promotion_expires_at`, `promotion_impressions`, `promotion_clicks` |
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
- `tier`: `'basic' | 'premium' | 'featured'`
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
2. Reads `directory_listings_list` for active promotion (tier, dates, impressions, clicks)
3. Chunks into text via `chunkPromotion()` — includes tier label, features list, dates, performance stats
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
| `directory_promotion_purchased` | `activatePurchase` (new) | Tier label, duration, expiration, price | Info severity |
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
- `GET /api/admin/promotion/catalog` — list all plans (including inactive)
- `POST /api/admin/promotion/catalog` — create plan
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
- `adminListPlans()`, `adminCreatePlan()`, `adminUpdatePlan()`, `adminDeletePlan()` — catalog CRUD
- `adminGetRevenue()`, `adminListPurchases()` — admin revenue dashboard

All methods use `makeDefaultRequest` with cache keys prefixed `directory-promotion-*`.

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
- **Tier colors**: `basic: amber`, `premium: blue`, `featured: purple` — consistent across all pages
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

### Adding a New Promotion Tier

1. Add to `TIER_FEATURES` in tenant promotion page
2. Add to `TIER_COLORS` in all promotion UI components
3. Add to `tierFeatures` map in `BotKnowledgeEmbeddingService.chunkPromotion()`
4. Add to `tierLabels` map in `BotKnowledgeEmbeddingService.chunkPromotion()`
5. Create a `promotion_catalog` entry via admin UI or SQL

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
