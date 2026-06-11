# Order Tracking — Phases 3–5 Implementation Plan

> **Status**: Phase 1 ✅ | Phase 2 ✅ | Phase 3–5 pending  
> **Last updated**: 2026-06-11  
> **Zero TS errors** on `pnpm checkapi` after Phase 2

---

## Completed Work (Phases 1–2)

### Phase 1 — Critical Tracking Flow (DONE)

| Item | File(s) | Summary |
|------|---------|---------|
| Tracking URL generator | `apps/api/src/utils/tracking-url-generator.ts` | Maps 7 carriers (USPS, UPS, FedEx, DHL, Amazon, OnTrac, LaserShip) to URL templates. Exports `generateTrackingUrl`, `isCarrierSupported`, `getSupportedCarriers`. |
| Shipments include (buyer) | `apps/api/src/routes/buyer-orders.ts` | `GET /api/orders/:orderId` now includes `shipments` relation. Both list and detail responses expose `trackingNumber`, `trackingUrl`, `carrier`. |
| Tracking fallback bug fix | `apps/api/src/routes/buyer-orders.ts` | Removed `|| order.shipping_provider` fallback that was incorrectly treating the provider name as a tracking number. |
| Carrier + tracking_url on shipment | `apps/api/src/routes/tenant-orders.ts` | `PUT /tenants/:tenantId/orders/:orderId/fulfillment` now sets `carrier` and `tracking_url` on both shipment create and update. Uses `shipment_status: 'in_transit'` on fulfill. |
| `order_shipped` notification | `apps/api/src/services/OrderNotificationService.ts` | Added `order_shipped` type. `notifyOrderShipped` sends email with carrier, tracking number, and clickable tracking URL. `order_fulfilled` is now fulfillment-method-aware (pickup vs shipping). |
| Fire shipped notification | `apps/api/src/routes/tenant-orders.ts` | When shipping order gets tracking + carrier + trackingUrl, fires `notifyOrderShipped`. |
| Frontend interfaces | `CustomerOrderService.ts`, `TenantOrderService.ts`, `OrdersClient.tsx` | All order interfaces now include `trackingUrl?: string` and `carrier?: string`. |
| Frontend clickable links | `BuyerOrderHistory.tsx`, `OrderDetailClient.tsx` | Tracking number renders as `<a href={trackingUrl}>` when URL exists; plain text otherwise. |

### Phase 2 — Capability Gating (DONE)

| Item | File(s) | Summary |
|------|---------|---------|
| `order_tracking` capability | `canonical-features.ts` | New feature: `order_tracking` with `autoTrackingUrl`, `shippedNotifications`, `supportedCarriers` metadata. |
| Tier feature arrays | `tier-hierarchies.ts` | Added to `COMMITMENT_FEATURES` (level 4+). `FEATURE_TIER_REQUIREMENTS['order_tracking'] = 4`. |
| Feature operation | `feature-operations.ts` | `order_tracking` operation → commitment tier, `/api/orders/fulfillment` + `/api/shipments`. |
| Capability gate engine | `CapabilityGateEngine.ts` | `order_tracking` capability: commitment = `{manual_tracking, auto_tracking_url, shipped_notification}`, professional = `+{tracking_events, status_progression}`. |
| Gated auto-URL + notification | `tenant-orders.ts` | `generateTrackingUrl()` only runs if `checkTierAccessWithOverrides(tenantId, 'order_tracking')` passes. Shipped notification only fires when `trackingUrl` exists (i.e., capability present). Below commitment: manual tracking entry still works, but no auto URL, no shipped email. |
| Admin shipments include | `order-management.ts` | `GET /api/order-management/orders/:orderId` now includes `shipments` with tracking fields in response. |

---

## Phase 3 — Shipment Status Progression & Admin Tracking UI

**Goal**: Real-time shipment status tracking with timeline UI, carrier selection dropdown, and shipment status progression that syncs with `fulfillment_status`.

### 3a. Shipment Status Progression Service ✅

**File**: `apps/api/src/services/ShipmentStatusService.ts` (CREATED)

Implemented:
- `VALID_TRANSITIONS` map with all allowed status transitions
- `transitionShipmentStatus()` — validates transition, updates `shipment_status`, sets timestamp fields (`shipped_at`, `delivered_at`, `out_for_delivery_at`, etc.), appends tracking event
- `syncFulfillmentStatus()` — when all shipments delivered → `fulfillment_status = 'fulfilled'`; on failure/return → drops to `'processing'`
- `getShipmentTimeline()` — ordered list of status changes
- `maybeFireNotification()` — fires `order_out_for_delivery` and `order_delivered` notifications

### 3b. Shipment Status API Routes ✅

**File**: `apps/api/src/routes/shipments.ts` (CREATED) + `apps/api/src/index.ts` (mounted)

Implemented:
- `GET /api/tenants/:tenantId/shipments/:shipmentId` — detail with timeline
- `PATCH /api/tenants/:tenantId/shipments/:shipmentId/status` — update status (gated by `order_tracking`)
- `GET /api/tenants/:tenantId/shipments/:shipmentId/events` — tracking events (gated by `order_tracking`, professional+)
- Route mounted at `/api/tenants` in `index.ts`

### 3c. Carrier Selection Dropdown ✅

**File**: `apps/web/src/components/orders/CarrierSelect.tsx` (CREATED)

Searchable dropdown of 7 carriers (USPS, UPS, FedEx, DHL, Amazon, OnTrac, LaserShip). Integrated into `OrderDetailClient.tsx` tracking input section.

### 3d. Shipment Status Timeline UI ✅

**File**: `apps/web/src/components/orders/ShipmentTimeline.tsx` (CREATED)

Vertical timeline with status icons, timestamps, locations, and descriptions. Shows current status highlighted. Integrated into `OrderDetailClient.tsx` below tracking info.

### 3e. Shipment Status Badge Component ✅

**File**: `apps/web/src/components/orders/ShipmentStatusBadge.tsx` (CREATED)

Color-coded badge mapping all 9 `shipment_status` values to Badge variants. Shown in `OrderDetailClient.tsx` header and tracking section.

### 3f. Additional Notification Types ✅

**File**: `apps/api/src/services/OrderNotificationService.ts`

- Added `order_out_for_delivery` and `order_delivered` to `OrderNotificationType`
- Added email templates with carrier, tracking number, estimated delivery (OOD), and remaining balance reminder (delivered)
- Added `notifyOrderOutForDelivery()` and `notifyOrderDelivered()` methods
- CRM alert integration for both new event types

### 3g. Sync `fulfillment_status` with shipment status ✅

**File**: `apps/api/src/routes/tenant-orders.ts` + `apps/api/src/services/ShipmentStatusService.ts`

- `tenant-orders.ts`: When tracking is added but order is `unfulfilled`, auto-set `fulfillment_status = 'processing'`
- `ShipmentStatusService.syncFulfillmentStatus()`: All delivered → `fulfilled`; failed/return after fulfilled → `processing`

---

## Phase 4 — Carrier API Integration (External Tracking)

**Goal**: Integrate with carrier APIs to automatically fetch tracking events and update shipment status without manual intervention.

**Prerequisite**: Phase 3 must be complete. This phase is gated behind `professional` tier (level 5) per the `CapabilityGateEngine` definition (`tracking_events`, `status_progression` features).

### 4a. Carrier Tracking API Abstraction

**File**: `apps/api/src/services/carriers/CarrierTrackingAdapter.ts` (NEW)

```typescript
export interface CarrierTrackingEvent {
  status: string;              // Maps to shipment_status enum
  timestamp: string;
  location?: string;
  description: string;
  rawStatus?: string;          // Original carrier status string
}

export interface CarrierTrackingResponse {
  carrier: string;
  trackingNumber: string;
  events: CarrierTrackingEvent[];
  estimatedDelivery?: string;
}

export abstract class CarrierTrackingAdapter {
  abstract carrierKey: string;
  abstract track(trackingNumber: string): Promise<CarrierTrackingResponse>;
  abstract validateTrackingNumber(trackingNumber: string): boolean;
}
```

### 4b. Carrier-Specific Implementations

**Files**: `apps/api/src/services/carriers/` (NEW directory)

| File | Carrier | API |
|------|---------|-----|
| `USPSTrackingAdapter.ts` | USPS | USPS Tracking API (requires API key) |
| `UPSTrackingAdapter.ts` | UPS | UPS Tracking API (requires OAuth client credentials) |
| `FedExTrackingAdapter.ts` | FedEx | FedEx Tracking API (requires OAuth + API key) |
| `DHLTrackingAdapter.ts` | DHL | DHL Shipment Tracking API (requires API key) |

Each adapter:
1. Authenticates with carrier API
2. Fetches tracking events for a given tracking number
3. Maps carrier-specific status codes to `shipment_status` enum values
4. Returns normalized `CarrierTrackingResponse`

**API keys**: Store in `tenant_settings` or a new `carrier_credentials` table. Never hardcode.

### 4c. Tracking Polling Service

**File**: `apps/api/src/services/TrackingPollingService.ts` (NEW)

A service that periodically polls carrier APIs for shipment updates:

```typescript
class TrackingPollingService {
  // Poll all active shipments (status < delivered) for a tenant
  async pollTenantShipments(tenantId: string): Promise<void>;
  
  // Poll a single shipment
  async pollShipment(shipmentId: string): Promise<void>;
  
  // Get the appropriate adapter for a carrier
  getAdapter(carrier: string): CarrierTrackingAdapter | null;
  
  // Process tracking response — update shipment status, events, fire notifications
  async processTrackingUpdate(shipmentId: string, response: CarrierTrackingResponse): Promise<void>;
}
```

**Scheduling**: Use a cron job or job queue. Recommended: `node-cron` or integration with existing job system.

**Polling strategy**:
- `pending` / `label_created`: Poll every 6 hours
- `picked_up` / `in_transit`: Poll every 2 hours
- `out_for_delivery`: Poll every 30 minutes
- `delivered` / `cancelled` / `returned`: Stop polling

**Rate limiting**: Respect carrier API rate limits. Batch requests per carrier.

### 4d. Manual Refresh Endpoint

**File**: `apps/api/src/routes/shipments.ts` (extend from 3b)

```
POST /api/tenants/:tenantId/shipments/:shipmentId/refresh-tracking
```

Manually trigger a tracking refresh for a single shipment. Returns updated tracking events. Gated by `order_tracking` capability.

### 4e. Carrier Credentials Management

**File**: `apps/api/src/routes/carrier-credentials.ts` (NEW)

```
GET    /api/tenants/:tenantId/carrier-credentials           — List configured carriers
POST   /api/tenants/:tenantId/carrier-credentials           — Add carrier credentials
DELETE /api/tenants/:tenantId/carrier-credentials/:carrier  — Remove carrier credentials
```

Credentials stored encrypted in database. Gated by `order_tracking` + `canManage` permission.

**Database**: New table `carrier_credentials` or store in `tenant_settings.metadata.encrypted_carrier_credentials`.

---

## Phase 5 — Advanced Tracking Features

**Goal**: Customer-facing tracking page, multi-package shipments, and tracking analytics.

### 5a. Public Tracking Page

**File**: `apps/web/src/app/track/[trackingNumber]/page.tsx` (NEW)

A public page where customers can enter a tracking number and see shipment status without logging in.

- Uses `GET /api/track/:trackingNumber` (unauthenticated, read-only)
- Shows `ShipmentTimeline` component
- Shows carrier logo + estimated delivery
- No order details exposed — only shipment status

**API route**: `apps/api/src/routes/public-tracking.ts` (NEW)
```
GET /api/track/:trackingNumber — Returns shipment status + events (no auth required)
```

### 5b. Multi-Package Shipments

Currently the system assumes 1 shipment per order (`shipments?.[0]`). Phase 5 adds support for orders with multiple packages.

**Backend changes**:
- `buyer-orders.ts`: Return all shipments (not just `[0]`), mapped as array
- `tenant-orders.ts`: Return all shipments as array
- `OrderDetailClient.tsx`: Show each package as separate tracking entry
- `ShipmentTimeline.tsx`: One timeline per shipment

**Interface changes**:
```typescript
interface TenantOrder {
  // Replace single tracking fields with shipments array:
  shipments?: Array<{
    id: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    carrier: string | null;
    shipmentStatus: string;
    shippedAt: string | null;
    deliveredAt: string | null;
  }>;
  // Keep backward-compat single fields (derived from first shipment):
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
}
```

### 5c. Tracking Analytics Dashboard

**File**: `apps/web/src/app/t/[tenantId]/analytics/tracking/page.tsx` (NEW)

A dashboard showing:
- Average delivery time by carrier
- On-time delivery rate
- Shipment status distribution (pie chart)
- Carrier performance comparison
- Failed delivery rate

Gated by `advanced_analytics` + `order_tracking` capabilities.

### 5d. Estimated Delivery Date

Leverage `shipments.estimated_delivery_date` column (already exists in schema).

- When carrier API returns estimated delivery, store it
- Show in `ShipmentTimeline` and `OrderDetailClient`
- If estimated date passes without delivery, highlight in amber

---

## Database Considerations

### Existing columns (no migration needed)

The `shipments` table already has all columns needed for Phases 3–5:
- `shipment_status` enum: `pending`, `label_created`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `failed_delivery`, `returned`, `cancelled`
- `tracking_events` JSON column for event history
- Timestamp columns: `shipped_at`, `in_transit_at`, `out_for_delivery_at`, `delivered_at`, `failed_delivery_at`, `returned_at`
- `estimated_delivery_date` Date column
- `carrier_response` JSON column for raw carrier API responses

### Potential new tables (Phase 4+)

| Table | Purpose | Phase |
|-------|---------|-------|
| `carrier_credentials` | Encrypted carrier API keys per tenant | 4e |
| `tracking_poll_jobs` | Job queue for polling carrier APIs | 4c |

### Prisma client regeneration

After any schema change, run:
```bash
cd apps/api && npx prisma generate
```

The `shipment_status` enum in `schema.prisma` already includes all 9 values, but the generated Prisma client may be stale. Run `prisma generate` before starting Phase 3.

---

## Implementation Order & Dependencies

```
Phase 3a (ShipmentStatusService) ──→ Phase 3b (Shipment routes) ──→ Phase 3f (notifications)
        │                                                                      │
        ↓                                                                      ↓
Phase 3c (CarrierSelect) ──→ Phase 3d (Timeline UI) ──→ Phase 3e (Status Badge) ──→ Phase 3g (fulfillment sync)

Phase 4a (Adapter abstraction) ──→ Phase 4b (Carrier adapters) ──→ Phase 4c (Polling service) ──→ Phase 4d (Refresh endpoint)
                                                                                                    ↑
                                                              Phase 4e (Credentials management) ──┘

Phase 5a (Public tracking) ──→ Phase 5b (Multi-package) ──→ Phase 5c (Analytics) ──→ Phase 5d (Est. delivery)
```

**Recommended starting point**: Phase 3a → 3b → 3c → 3d (service + routes + UI in sequence)

---

## Testing Strategy

### Unit tests
- `ShipmentStatusService`: Test all valid transitions, reject invalid jumps, test fulfillment sync
- `tracking-url-generator`: Already has utility functions; add test for edge cases
- `CarrierTrackingAdapter` subclasses: Mock carrier API responses

### Integration tests
- `PUT /tenants/:tenantId/orders/:orderId/fulfillment`: Verify carrier + tracking_url set, notification fired
- `PATCH /tenants/:tenantId/shipments/:shipmentId/status`: Verify status transitions, timestamp updates
- `GET /api/orders/:orderId`: Verify shipments included in response

### Manual testing checklist
- [ ] Create order with shipping fulfillment method
- [ ] Add tracking number + carrier → verify auto URL generated (commitment+ tenant)
- [ ] Add tracking number + carrier → verify NO auto URL (starter tenant)
- [ ] Verify `order_shipped` email sent only when tracking URL exists
- [ ] Click tracking link in buyer order history → opens carrier tracking page
- [ ] Click tracking link in tenant order detail → opens carrier tracking page
- [ ] Update shipment status through timeline → verify status badge updates
- [ ] Verify fulfillment_status auto-syncs when all shipments delivered

---

## File Map Summary

### New files to create

| Phase | File | Purpose |
|-------|------|---------|
| 3a | `apps/api/src/services/ShipmentStatusService.ts` | Status transition validation + fulfillment sync |
| 3b | `apps/api/src/routes/shipments.ts` | Shipment CRUD + status update routes |
| 3c | `apps/web/src/components/orders/CarrierSelect.tsx` | Carrier dropdown component |
| 3d | `apps/web/src/components/orders/ShipmentTimeline.tsx` | Vertical timeline UI |
| 3e | `apps/web/src/components/orders/ShipmentStatusBadge.tsx` | Color-coded status badge |
| 4a | `apps/api/src/services/carriers/CarrierTrackingAdapter.ts` | Abstract adapter |
| 4b | `apps/api/src/services/carriers/USPSTrackingAdapter.ts` | USPS implementation |
| 4b | `apps/api/src/services/carriers/UPSTrackingAdapter.ts` | UPS implementation |
| 4b | `apps/api/src/services/carriers/FedExTrackingAdapter.ts` | FedEx implementation |
| 4b | `apps/api/src/services/carriers/DHLTrackingAdapter.ts` | DHL implementation |
| 4c | `apps/api/src/services/TrackingPollingService.ts` | Cron-based polling |
| 4e | `apps/api/src/routes/carrier-credentials.ts` | Credential management routes |
| 5a | `apps/web/src/app/track/[trackingNumber]/page.tsx` | Public tracking page |
| 5a | `apps/api/src/routes/public-tracking.ts` | Unauthenticated tracking API |
| 5c | `apps/web/src/app/t/[tenantId]/analytics/tracking/page.tsx` | Tracking analytics |

### Existing files to modify

| Phase | File | Changes |
|-------|------|---------|
| 3f | `OrderNotificationService.ts` | Add `order_out_for_delivery`, `order_delivered` types |
| 3g | `tenant-orders.ts` | Change fulfillment_status logic: `processing` on ship, `fulfilled` on deliver |
| 3c | `OrderDetailClient.tsx` | Replace tracking input with CarrierSelect + tracking input row |
| 3d | `OrderDetailClient.tsx` | Add ShipmentTimeline below tracking info |
| 3e | `OrdersClient.tsx` | Add ShipmentStatusBadge to order list rows |
| 3e | `OrderDetailClient.tsx` | Add ShipmentStatusBadge to header |
| 3d | `BuyerOrderHistory.tsx` | Add ShipmentTimeline in expanded detail |
| 5b | `buyer-orders.ts` | Return shipments array instead of single `[0]` |
| 5b | `tenant-orders.ts` | Return shipments array instead of single `[0]` |
| 5b | `order-management.ts` | Return shipments array instead of single `[0]` |
