# CRM Alerts Enhancement — Phase Plan

## Current State

### Merchant (Tenant) Side
- **Backend**: Full alerts pipeline — `CrmAlertService` (CRUD + `createOrderAlert` with 14 order event types), `OrderNotificationService` auto-bridges order events → CRM alerts, admin broadcast endpoint
- **Frontend service**: `CrmTenantCrmService` has `listAlerts`, `markAlertRead`, `markAllAlertsRead`, `dismissAlert`
- **Widget**: `CrmTenantWidget` on `TenantDashboardV2` — polls every 30s, shows alerts with toast notifications, unread badge, type-specific styling
- **Support page**: `/t/[tenantId]/support` — full alerts section with read/dismiss/mark-all-read

### Customer Side
- **Backend**: `crm-customer.ts` has tickets, messages, activities, orders, inquiries — **no alerts endpoints**
- **Frontend service**: `CrmCustomerService` has tickets, messages, activities, orders, inquiries — **no alert methods**
- **Widget**: `CrmCustomerWidget` on `/account` page — shows tickets + inquiries only, **no alerts section**
- **Support page**: `/account/support` — ticket list + create, **no alerts**

### Gap Summary

| Gap | Merchant | Customer |
|-----|----------|----------|
| `order` type in `ALERT_CONFIG` | ❌ Missing (falls back to `info`) | N/A — no alerts at all |
| Backend alerts endpoints | ✅ Exists | ❌ None |
| Frontend service alert methods | ✅ Exists | ❌ None |
| Widget alerts section | ✅ Exists | ❌ None |
| Toast notifications for new alerts | ✅ Exists | ❌ None |
| Read/dismiss actions | ✅ Exists | ❌ None |

---

## Phase 6A — Merchant Widget Alert Polish

**Goal**: Fix the visual gap where `order`-type alerts render with generic `info` styling instead of a distinct order-specific treatment.

### 6A.1 — Add `order` entry to `ALERT_CONFIG`

**File**: `apps/web/src/components/crm/CrmTenantWidget.tsx`

Add to `ALERT_CONFIG` map (line 25):
```ts
order: { icon: '🛒', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
```

This ensures order event alerts (placed, shipped, delivered, cancelled, refund, etc.) render with orange-themed styling distinct from `info` (sky-blue) or `warning` (orange-700 but different context).

### 6A.2 — Verify `ACTIVITY_CONFIG` alignment

`ACTIVITY_CONFIG` already has `order_notification`, `order_placed`, `order_cancelled`, `order_fulfilled`, `payment_event` entries (line 34-46). No changes needed — just confirm visual consistency with the new `ALERT_CONFIG.order` entry.

**Effort**: ~5 min (single-line edit)  
**Risk**: None — purely visual, fallback already works

---

## Phase 6B — Customer Alerts Backend

**Goal**: Add customer-facing alerts API so customers can see order status notifications and platform alerts relevant to them.

### 6B.1 — Customer alerts route: `GET /api/customer/crm/alerts`

**File**: `apps/api/src/routes/crm/customer/crm-customer.ts`

New endpoint that:
- Auth: requires `req.customer?.id` (same pattern as existing customer routes)
- Queries `crm_alerts` joined through the customer's order history — alerts where `type = 'order'` and the `metadata.order_id` belongs to an order placed by this customer email
- Also includes `type IN ('info', 'warning')` alerts targeted to this customer's tenants (broadcast alerts from stores they've purchased from)
- Supports filters: `type`, `unreadOnly`
- Returns `{ success: true, data: alerts[] }`

**Data access pattern**: Customer can only see alerts for:
1. Order alerts (`type = 'order'`) where `metadata.order_id` matches their orders
2. Platform/tenant broadcasts where the customer has a purchase relationship with that tenant

### 6B.2 — Customer alert read/dismiss routes

- `PUT /api/customer/crm/alerts/:alertId/read` — mark single alert read (ownership check via order relationship)
- `PUT /api/customer/crm/alerts/read-all` — mark all customer's alerts read
- `PUT /api/customer/crm/alerts/:alertId/dismiss` — dismiss single alert

### 6B.3 — Customer unread alert count

Add `unread_alert_count` to the existing `GET /api/customer/crm/stats` endpoint (or create a lightweight `GET /api/customer/crm/alerts/count` if no stats endpoint exists).

**Effort**: ~2-3 hours  
**Risk**: Low — follows existing customer route patterns; data access requires careful ownership scoping

---

## Phase 6C — Customer Alerts Frontend Service

**Goal**: Wire the new backend endpoints into the customer CRM service and types.

### 6C.1 — Add alert methods to `CrmCustomerService`

**File**: `apps/web/src/services/crm/CrmCustomerService.ts`

Add:
- `listAlerts(filters?: { type?: string; unreadOnly?: boolean }): Promise<CrmAlert[]>`
- `markAlertRead(alertId: string): Promise<void>`
- `markAllAlertsRead(): Promise<void>`
- `dismissAlert(alertId: string): Promise<void>`

Add `'crm-customer-alerts'` to `getServiceCachePatterns()`.

### 6C.2 — Add `CrmAlert` import to customer service

**File**: `apps/web/src/services/crm/CrmCustomerService.ts`

Import `CrmAlert` from `@/types/crm` (type already exists and includes `order` in `AlertType` union).

**Effort**: ~30 min  
**Risk**: None — follows existing service patterns exactly

---

## Phase 6D — Customer Widget Alerts Section

**Goal**: Add an alerts section to `CrmCustomerWidget` so customers see order status notifications and platform alerts on their account page.

### 6D.1 — Add alerts state and loading to `CrmCustomerWidget`

**File**: `apps/web/src/components/crm/CrmCustomerWidget.tsx`

- Add `alerts` state (`CrmAlert[]`), `unreadAlertCount` state
- Add `ALERT_CONFIG` map (same as merchant widget, including `order` entry from Phase 6A)
- Fetch alerts alongside tickets/inquiries in `loadData`
- Add polling interval (30s, same as merchant widget) for real-time order updates
- Add toast notifications for new alerts (delta detection with refs, same pattern as `CrmTenantWidget`)

### 6D.2 — Render alerts section in widget

Add alerts section between header and tickets:
- Unread alert count pill in header badge
- Alert cards with type-specific styling (icon, color, bg, border from `ALERT_CONFIG`)
- Read/dismiss inline actions
- "Mark all read" link
- Links to `/account/support` for detail view

### 6D.3 — Update empty state

Change empty state condition from `tickets.length === 0 && inquiries.length === 0` to include `alerts.length === 0`.

**Effort**: ~1-2 hours  
**Risk**: Low — mirrors existing merchant widget pattern

---

## Phase 6E — Customer Support Page Alerts Tab

**Goal**: Add a dedicated alerts view on the customer support page with full read/dismiss/batch actions.

### 6E.1 — Add alerts section to `/account/support`

**File**: `apps/web/src/app/account/support/page.tsx`

- Add `alerts` state and `unreadAlertCount` state
- Fetch alerts on mount via `crmCustomerService.listAlerts()`
- Add alerts card section above ticket list:
  - Header with count + "Mark all read" button
  - Alert rows with icon, title, body, type badge, relative time
  - Read/dismiss per-alert actions
  - Unread highlight (purple/amber bg for unread, neutral for read)
- Filter tabs: All | Orders | Platform (filter by `alert.type`)

### 6E.2 — Add order-deep-link from alerts

For `type = 'order'` alerts, link the alert row to `/account/orders/[orderId]` using `metadata.order_id` so customers can jump directly to the relevant order.

**Effort**: ~1-2 hours  
**Risk**: Low — follows existing support page patterns

---

## Phase 6F — Advanced Alerts (Future)

**Goal**: Enhanced alert capabilities for both merchant and customer sides.

### 6F.1 — Real-time alerts via SSE/WebSocket

Replace 30s polling with server-sent events or WebSocket push for instant order status updates. Both `CrmTenantWidget` and `CrmCustomerWidget` would subscribe to a live alert stream.

### 6F.2 — Alert preferences / notification settings

Let customers and merchants configure which alert types they want to see (e.g., mute `order_delivered`, keep `order_cancelled` and `refund_processed`).

### 6F.3 — Email/push integration for alerts

Bridge CRM alerts to email notifications (order events already send emails via `OrderNotificationService`, but platform alerts — milestone, subscription, warning — have no email channel yet).

### 6F.4 — Alert action buttons

Inline action buttons on alerts (e.g., "Track Order" on `order_shipped`, "View Refund" on `refund_processed`, "Renew" on `subscription` alerts).

**Effort**: Significant — requires infra decisions (SSE vs WS, notification preferences table, email template work)  
**Risk**: Medium — cross-cutting concerns (auth, real-time infra, email deliverability)

---

## Dependency Graph

```
6A (merchant widget polish) ──→ independent, ship immediately
6B (customer backend) ────────→ 6C (customer service) ──→ 6D (customer widget) ──→ 6E (support page)
6F (advanced) ────────────────→ depends on 6D + 6E being stable
```

## Recommended Ship Order

1. **6A** — Single-line fix, ship now
2. **6B** — Backend foundation for customer alerts
3. **6C** — Frontend service wiring (blocks 6D)
4. **6D** — Customer widget alerts (highest customer-facing impact)
5. **6E** — Support page alerts (polish)
6. **6F** — Future enhancements
