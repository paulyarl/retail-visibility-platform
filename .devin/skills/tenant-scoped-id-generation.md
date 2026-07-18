---
description: How to generate tenant-scoped, URL-safe IDs using the id-generator utility instead of raw UUIDs, enabling visual traceability and cross-system correlation in a multi-tenant platform
---

# Tenant-Scoped ID Generation

Use this skill when creating new entities that need IDs, or when replacing raw `randomUUID()` calls with tenant-correlated identifiers. Covers the id-generator utility, the tenant key system, naming conventions, and when to use tenant-scoped vs global IDs.

**Source file:** `apps/api/src/lib/id-generator.ts` — all generators live here.

---

## 1. Why Not Raw UUIDs?

Raw UUIDs (e.g., `61a8ad0f-1703-4b1c-86ec-4dfdf1186108`) are:
- **36 characters** — long URLs, verbose logs, wide DB columns
- **Opaque** — no visual clue which tenant, customer, or domain an entity belongs to
- **Untraceable** — debugging requires a DB lookup to find the owning tenant

The id-generator produces **short, URL-safe, tenant-traceable IDs** using `nanoid` with a restricted alphabet (`0123456789abcdefghijklmnopqrstuvwxyz`).

### Before vs After

| Entity | Raw UUID | Tenant-Scoped ID |
|---|---|---|
| Bot conversation | `61a8ad0f-1703-4b1c-86ec-4dfdf1186108` | `botconv-A3K9-x7y2z9k4` |
| Order | `550e8400-e29b-41d4-a716-446655440000` | `order-A3K9-CUA3K9M-x7y2z9` |
| Payment | `6ba7b810-9dad-11d1-80b4-00c04fd430c8` | `pay-A3K9-m3n4o5p6q7` |
| CRM ticket | `f47ac10b-58cc-4372-a567-0e02b2c3d479` | `crmtk-A3K9-w8x9y0z1a2` |

**Benefits:**
- 60–70% shorter than UUIDs
- URL-friendly (no special chars, no hyphens-within-hyphens confusion)
- **Tenant key prefix** — visually identify the owning tenant in logs, URLs, and support tickets without a DB lookup
- **Cross-system correlation** — an order ID, payment ID, and shipment ID for the same tenant all share the same tenant key, making log tracing and debugging immediate
- **Collision-safe** — nanoid with 8+ chars has ~1 in 2.8 trillion collision probability

---

## 2. The Tenant Key System

The core primitive is `generateTenantKey(tenantId)` — a deterministic 4-character hash derived from the tenant ID string.

```typescript
import { generateTenantKey } from '../lib/id-generator';

const key = generateTenantKey('tid-abc12345');  // → "A3K9"
const key2 = generateTenantKey('tid-abc12345'); // → "A3K9" (deterministic)
```

**Character set:** `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 chars, no ambiguous chars like `0`/`O` or `1`/`I`)

**Algorithm:** Simple DJB-style hash → modulo into the 32-char alphabet → 4 characters. This is **not** cryptographically secure — it's a visual correlation key, not a security primitive.

### Related Key Functions

| Function | Input | Output | Length | Example |
|---|---|---|---|---|
| `generateTenantKey(tenantId)` | Tenant ID | 4-char key | 4 | `A3K9` |
| `generateCustomerKey(customerId)` | Customer ID | `CU` + 5-char key | 7 | `CUA3K9M` |
| `generateOrganizationKey(orgId)` | Org ID | 3-char key | 3 | `K3M` |
| `generateOwnerKey(ownerId)` | Owner ID | 5-char key | 5 | `M3N4O` |
| `generateOrderKey(orderId)` | Order ID | 6-char key | 6 | `A3K9M2` |

All are **deterministic** — the same input always produces the same key, enabling cross-system correlation.

---

## 3. ID Format Convention

Every generated ID follows this pattern:

```
{prefix}-{tenantKey}-{nanoid}
```

- **prefix** — 2–8 char domain identifier (e.g., `order`, `pay`, `crmtk`, `botconv`)
- **tenantKey** — 4-char tenant correlation key from `generateTenantKey()`
- **nanoid** — random suffix for uniqueness (6–12 chars depending on collision tolerance)

### Exceptions (No Tenant Key)

Some IDs are **global** (not tenant-scoped) and omit the tenant key:

| Function | Format | Why Global |
|---|---|---|
| `generateTenantId()` | `tid-{nanoid}` | The tenant itself |
| `generateUserId()` | `uid-{nanoid}` | Platform-wide user |
| `generateCustomerId()` | `cust-{nanoid}` | Platform-wide customer |
| `generateCrmTicketMessageId()` | `crmmsg-{nanoid}` | Message belongs to ticket, not tenant |
| `generateCrmRequestReadId()` | `crmrd-{nanoid}` | Read receipt, not tenant-scoped |
| `generateCrmUserReadStateId()` | `crmurs-{nanoid}` | User state, not tenant-scoped |
| `generateAuditId()` | `audit-{nanoid}` | Audit logs are platform-level |
| `generateTierId()` | `tier-{nanoid}` | Tiers are platform-level |
| `generateFeatureId()` | `feature-{nanoid}` | Features are platform-level |

### Multi-Entity Correlation IDs

Some IDs embed **two** correlation keys for cross-entity tracing:

| Function | Format | Example |
|---|---|---|
| `generateOrderId(tenantId, customerId)` | `order-{tk}-{ck}-{nanoid}` | `order-A3K9-CUA3K9M-x7y2z9` |
| `generateCustomerTenantRelationshipId(tenantId, customerId)` | `ctr-{tk}-{ck}-{nanoid}` | `ctr-A3K9-CUA3K9M-m3n4o5` |
| `generateUserTenantId(userId, tenantId)` | `utid-{userId}-{tk}-{nanoid}` | `utid-uid-x7y2-A3K9-m3n4o` |

---

## 4. Complete Generator Catalog

### Tenant-Scoped IDs (include tenant key)

| Generator | Prefix | Format | Use Case |
|---|---|---|---|
| `generateTenantItemId(tenantId)` | `pid` | `pid-{tk}-{nanoid}` | Tenant product items |
| `generatePhotoId(tenantId, itemId)` | `photo` | `photo-{tk}-{itemId}-{nanoid}` | Product photos |
| `generateSessionId(tenantId)` | `session` | `session-{tk}-{nanoid}` | User sessions |
| `generateOrderId(tenantId, customerId?)` | `order` | `order-{tk}-{ck\|GUEST}-{nanoid}` | Orders |
| `generateOrderItemId(id, tenantId)` | `orderitem` | `orderitem-{tk}-{id}-{nanoid}` | Order line items |
| `generateOrderItemHistoryId(id, tenantId)` | `orderhist` | `orderhist-{tk}-{id}-{nanoid}` | Order history |
| `generateShipmentId(tenantId)` | `ship` | `ship-{tk}-{nanoid}` | Shipments |
| `generatePaymentId(tenantId)` | `pay` | `pay-{tk}-{nanoid}` | Payments |
| `generateBillingMethodId(tenantId)` | `bill` | `bill-{tk}-{nanoid}` | Billing methods |
| `generateInvoiceId(tenantId)` | `inv` | `inv-{tk}-{nanoid}` | Subscription invoices |
| `generateSubscriptionPaymentId(invoiceId, tenantId)` | `subpay` | `subpay-{tk}-{inv}-{nanoid}` | Subscription payments |
| `generateServiceChargeId(tenantId)` | `charge` | `charge-{tk}-{nanoid}` | Service charges |
| `generateManualInvoiceId(tenantId)` | `manual` | `manual-{tk}-{nanoid}` | Manual invoices |
| `generateTimeSlotId(tenantId)` | `slot` | `slot-{tk}-{nanoid}` | Fulfillment time slots |
| `generateScheduleId(tenantId)` | `sched` | `sched-{tk}-{nanoid}` | Fulfillment schedules |
| `generateNotificationId(tenantId)` | `notif` | `notif-{tk}-{nanoid}` | Fulfillment notifications |
| `generateDownloadPageId(tenantId)` | `dlp` | `dlp-{tk}-{nanoid}` | Download pages |
| `generateDigitalAssetId(tenantId)` | `asset` | `asset-{tk}-{nanoid}` | Digital assets |
| `generateDownloadLogId(tenantId)` | `dlog` | `dlog-{tk}-{nanoid}` | Download access logs |
| `generateTenantCommerceSettingsId(tenantId)` | `cs` | `cs-{tk}-{nanoid}` | Commerce settings |
| `generateAccessGrantId(tenantId)` | `grant` | `grant-{tk}-{nanoid}` | Access grants |
| `generateCategoryMirrorId(catId, tenantId)` | `cmid` | `cmid-{tk}-{catId}-{nanoid}` | Category mirrors |
| `generateProductCatId(tenantId)` | `itemcat` | `itemcat-{tk}-{nanoid}` | Product categories |
| `generateDirectoryFeaturedId(tenantId)` | `dirfeatured` | `dirfeatured-{tk}-{nanoid}` | Directory featured |
| `generateGbpHoursSyncLogId(tenantId)` | `gbphours` | `gbphours-{tk}-{nanoid}` | GBP hours sync |
| `generateSpecialHoursId(tenantId)` | `special` | `special-{tk}-{nanoid}` | Special hours |
| `generateTenantVariantId(parentItemId, tenantId)` | `variant` | `variant-{itemId}-{tk}-{nanoid}` | Product variants |
| `generateEmbedKey(tenantId)` | `ek` | `ek-{tk}-{nanoid}` | Bot embed license keys |
| `generateBotConversationSessionId(tenantId)` | `botconv` | `botconv-{tk}-{nanoid}` | Bot conversation sessions |
| `generateCorrelationId(tenantId?)` | `corr` | `corr-{tk\|GLBL}-{nanoid}` | Request tracing |
| `generateQrAnalyticsId(tenantId)` | `qra` | `qra-{tk}-{nanoid}` | QR analytics aggregates |
| `generateQrScanEventId(tenantId)` | `qrse` | `qrse-{tk}-{nanoid}` | QR scan events |
| `generateBadgeAnalyticsId(tenantId)` | `bdga` | `bdga-{tk}-{nanoid}` | Badge analytics aggregates |
| `generateBadgeEventId(tenantId)` | `bdge` | `bdge-{tk}-{nanoid}` | Badge events |
| `generateCouponId(tenantId)` | `cpn` | `cpn-{tk}-{nanoid}` | Merchant coupon definitions |
| `generateRedemptionId(tenantId)` | `redm` | `redm-{tk}-{nanoid}` | Coupon redemptions |
| `generateCouponEventId(tenantId)` | `cpe` | `cpe-{tk}-{nanoid}` | Coupon events (view, copy, click, validate, redeem, fail) |
| `generateCouponAnalyticsId(tenantId)` | `cpa` | `cpa-{tk}-{nanoid}` | Coupon analytics aggregates |

### Merchant Gate / Settings IDs (tenant-scoped)

Added during merchant gate table correlation key audit (June 2026). These replace ad-hoc `Date.now()` + `Math.random()` patterns that were used before the audit.

| Generator | Prefix | Format | Use Case |
|---|---|---|---|
| `generatePaymentGatewayId(tenantId)` | `gw` | `gw-{tk}-{nanoid}` | Payment gateways (Square, PayPal, Stripe) |
| `generatePaymentGatewaySettingsId(tenantId)` | `pgs` | `pgs-{tk}-{nanoid}` | Payment gateway settings |
| `generateStorefrontOptionsSettingsId(tenantId)` | `sos` | `sos-{tk}-{nanoid}` | Storefront options settings |
| `generateStorefrontTypeSettingsId(tenantId)` | `sts` | `sts-{tk}-{nanoid}` | Storefront type settings |
| `generateFeaturedOptionsSettingsId(tenantId)` | `fos` | `fos-{tk}-{nanoid}` | Featured options settings |
| `generateProductOptionsSettingsId(tenantId)` | `pos` | `pos-{tk}-{nanoid}` | Product options settings |
| `generateQuickstartOptionsSettingsId(tenantId)` | `qos` | `qos-{tk}-{nanoid}` | Quickstart options settings |
| `generateFeatureOverrideId(tenantId)` | `fov` | `fov-{tk}-{nanoid}` | Feature overrides (pricing, limits, featured, approvals) |
| `generateFeatureFlagId(tenantId)` | `ff` | `ff-{tk}-{nanoid}` | Feature flags |
| `generateShippingCarrierId(tenantId)` | `carrier` | `carrier-{tk}-{nanoid}` | Shipping carriers (uses 'carrier' to avoid collision with `ship` prefix) |

### CRM IDs (tenant-scoped)

| Generator | Prefix | Format | Use Case |
|---|---|---|---|
| `generateCrmContactId(tenantId)` | `crmct` | `crmct-{tk}-{nanoid}` | CRM contacts |
| `generateCrmTicketId(tenantId)` | `crmtk` | `crmtk-{tk}-{nanoid}` | Support tickets |
| `generateCrmTaskId(tenantId)` | `crmtask` | `crmtask-{tk}-{nanoid}` | CRM tasks |
| `generateCrmActivityId(tenantId)` | `crmact` | `crmact-{tk}-{nanoid}` | CRM activities |
| `generateCrmInquiryId(tenantId)` | `crminq` | `crminq-{tk}-{nanoid}` | CRM inquiries |
| `generateCrmAlertId(tenantId)` | `crmalt` | `crmalt-{tk}-{nanoid}` | CRM alerts |

### Organization IDs

| Generator | Prefix | Format | Use Case |
|---|---|---|---|
| `generateOrganizationId(ownerId)` | `org` | `org-{ok}-{nanoid}` | Organizations |
| `generateOrganizationCommerceSettingsId(orgId)` | `ocs` | `ocs-org-{ok}-{nanoid}` | Org commerce settings |

### Clover Integration IDs (global)

| Generator | Prefix | Format | Use Case |
|---|---|---|---|
| `generateCloverItemId()` | `csid` | `csid-{nanoid}` | Clover items |
| `generateCloverIntegrationId()` | `cigid` | `cigid-{nanoid}` | Clover integrations |
| `generateCloverItemMappingsId()` | `csmid` | `csmid-{nanoid}` | Clover item mappings |
| `generateCloverCatId()` | `clovercat` | `clovercat-{nanoid}` | Clover categories |
| `generateCloverOauthChangeLogId()` | `cloveroauth` | `cloveroauth-{nanoid}` | OAuth change logs |
| `generateCloverSyncLogId()` | `cloversync` | `cloversync-{nanoid}` | Sync logs |

### Global IDs (no tenant key)

| Generator | Prefix | Format | Use Case |
|---|---|---|---|
| `generateTenantId()` | `tid` | `tid-{nanoid}` | New tenants |
| `generateUserId()` | `uid` | `uid-{nanoid}` | Platform users |
| `generateCustomerId()` | `cust` | `cust-{nanoid}` | Platform customers |
| `generateCustomerAddressId(customerId)` | `caddr` | `caddr-{ck}-{nanoid}` | Customer addresses |
| `generateCustomerPaymentMethodId(customerId)` | `cpm` | `cpm-{ck}-{nanoid}` | Payment methods |
| `generateCustomerTenantRelationshipId(tenantId, customerId)` | `ctr` | `ctr-{tk}-{ck}-{nanoid}` | Customer-tenant links |
| `generateGlobalProductId()` | `gpc` | `gpc-{nanoid}` | Global product catalog |
| `generateAuditId()` | `audit` | `audit-{nanoid}` | Audit logs |
| `generateTierId()` | `tier` | `tier-{nanoid}` | Tiers |
| `generateFeatureId()` | `feature` | `feature-{nanoid}` | Features |
| `generateTierChangeId()` | `tcid` | `tcid-{nanoid}` | Tier changes |
| `generateTierPricingId()` | `tierprice` | `tierprice-{nanoid}` | Tier pricing |
| `generateFeedPushJobId()` | `feed` | `feed-{nanoid}` | Feed push jobs |
| `generateAccessToken()` | `atok` | `atok-{nanoid}` | Download access tokens |
| `generateLicenseKey()` | — | `XXXX-XXXX-XXXX-XXXX` | Product license keys |

---

## 5. How to Add a New Tenant-Scoped ID Generator

When creating a new entity type that belongs to a tenant:

**Step 1 — Choose a prefix**

Pick a short, descriptive prefix in lowercase. Check the catalog above to avoid collisions. Examples: `coupon`, `review`, `wishlist`.

**Step 2 — Add the generator function**

```typescript
/**
 * Generates short coupon IDs
 * Format: coupon-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateCouponId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `coupon-${generateTenantKey(tenantId)}-${nanoid()}`;
}
```

**Step 3 — Use it in the service layer**

```typescript
import { generateCouponId } from '../lib/id-generator';

// In your service method:
const id = generateCouponId(tenantId);
await prisma.coupons.create({ data: { id, tenant_id: tenantId, ... } });
```

**Step 4 — Replace any raw UUID calls**

Search for `randomUUID` or `gen_random_uuid` in the relevant service and replace with the new generator. The DB column should be `VarChar(255)` (not `Uuid`) to accommodate the shorter format.

**Step 5 — Verify**

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

---

## 6. Multi-Tenant Platform Benefits

### 6.1 Visual Traceability

In logs, URLs, and support tickets, the tenant key prefix immediately identifies the owning tenant:

```
# Without tenant key — which tenant?
POST /api/public/bot/conversations/61a8ad0f-1703-4b1c-86ec-4dfdf1186108/messages

# With tenant key — tenant A3K9
POST /api/public/bot/conversations/botconv-A3K9-x7y2z9k4/messages
```

Support staff can grep logs by tenant key without a DB lookup:
```bash
grep "A3K9" /var/log/app.log  # All events for tenant A3K9
```

### 6.2 Cross-System Correlation

When a customer places an order, the related entities all share the same tenant key:

```
order-A3K9-CUA3K9M-x7y2z9     ← order
pay-A3K9-m3n4o5p6q7            ← payment for that order
ship-A3K9-r8s9t0u1v2           ← shipment for that order
notif-A3K9-w3x4y5z6a7          ← fulfillment notification
```

This makes it trivial to trace a customer journey across services without joins or lookups.

### 6.3 URL-Friendly Identifiers

Short IDs produce cleaner URLs in the browser, API, and admin panel:

```
# UUID — 36 chars, ugly
/admin/orders/550e8400-e29b-41d4-a716-446655440000

# Tenant-scoped — 22 chars, readable
/admin/orders/order-A3K9-CUA3K9M-x7y2z9
```

### 6.4 Cache Key Isolation

Tenant keys can be used as cache namespace prefixes to prevent cross-tenant cache collisions:

```typescript
const cacheKey = `${generateTenantKey(tenantId)}:product:${productId}`;
```

### 6.5 Debugging & Support

When a merchant reports an issue with order `order-A3K9-CUA3K9M-x7y2z9`:
1. **Tenant** is immediately known: `A3K9` — no DB lookup needed
2. **Customer** is immediately known: `CUA3K9M` — no DB lookup needed
3. **Entity type** is immediately known: `order` — from the prefix
4. All related entities (payments, shipments, notifications) share the `A3K9` key for log tracing

### 6.6 Reduced Storage

Shorter IDs mean smaller indexes, smaller logs, and smaller URL payloads. For high-volume tables (messages, notifications, audit logs), this adds up:

| ID Type | Length | 10M rows index size (approx) |
|---|---|---|
| UUID | 36 chars | ~720 MB |
| Tenant-scoped | ~20 chars | ~400 MB |

---

## 7. When to Use Tenant-Scoped vs Global IDs

**Use tenant-scoped** when:
- The entity belongs to a single tenant (orders, products, payments, bot conversations)
- The entity is created in a tenant context and needs tenant traceability
- Logs, URLs, or support tickets benefit from visual tenant identification

**Use global** when:
- The entity is platform-level (tenants, users, tiers, features, audit logs)
- The entity spans multiple tenants (customer-tenant relationships use dual keys)
- The entity belongs to an integration partner (Clover items, sync logs)

**Use multi-key** when:
- The entity connects two domains (customer + tenant, order + customer)
- Cross-domain correlation is needed (e.g., `order-{tk}-{ck}-{nanoid}` traces both tenant and customer)

---

## 8. Migration: Replacing Raw UUIDs

When migrating an existing entity from UUID to tenant-scoped IDs:

1. **Add the generator** to `id-generator.ts` (see Section 5)
2. **Update the service** — replace `randomUUID()` with the new generator
3. **Check the Prisma schema** — if the column is `@db.Uuid`, change to `@db.VarChar(255)` and create a migration
4. **Check for UUID validation** — search for `.uuid()` in Zod schemas or `isUUID()` checks that validate the ID format
5. **Existing data** — old UUID rows remain valid; new rows get the short format. No backfill needed unless you want uniformity
6. **Frontend** — verify no UUID format assumptions (e.g., regex validation, URL parsing that expects 36-char UUIDs)
7. **API routes** — verify `:param` route handlers don't validate as UUID

### Common Pitfalls

- **Don't** use tenant-scoped IDs for primary keys that are `@db.Uuid` in the database — Postgres `gen_random_uuid()` generates UUIDs at the DB level. You need to pass the ID explicitly from the application layer and change the column type.
- **Don't** use the tenant key as a security boundary — it's a visual aid, not an access control mechanism. Always enforce tenant isolation with RLS and explicit `WHERE tenant_id = $1` queries.
- **Don't** change the tenant key algorithm — it's deterministic. Changing it would break all existing correlation keys in logs and external systems.
- **Don't** use ad-hoc `Date.now()` + `Math.random()` patterns for tenant-scoped entity IDs — they produce opaque, non-correlatable IDs. Always use the corresponding generator from `id-generator.ts`.
- **Don't** rely on DB-level `@default(dbgenerated("gen_random_uuid()"))` for tenant-scoped tables — the application layer should always pass an explicit tenant-scoped ID. If a schema column has this default, remove it and pass the ID explicitly from the service/route layer.
- **Don't** forget to check for prefix collisions when adding new generators — e.g., `generateShipmentId` uses `ship-`, so `generateShippingCarrierId` uses `carrier-` instead.

---

## 9. Key Files

| File | Purpose |
|---|---|
| `apps/api/src/lib/id-generator.ts` | All ID generators + key derivation functions |
| `apps/api/prisma/schema.prisma` | Column types (`@db.Uuid` vs `@db.VarChar`) |
| `apps/api/src/services/*.ts` | Service layer — where generators are called |

---

## 10. Audit History

### Merchant Gate Tables Audit (June 2026)

Audited all `tenant_*` merchant gate tables for correlation key compliance. Found 12 of 14 tables using ad-hoc `Date.now()` + `Math.random()` patterns or DB-generated UUIDs instead of tenant-scoped generators.

**Fixed (13 tables, 20 call sites):**
- `tenant_payment_gateways` — 4 sites (SquareOAuthService x2, PayPalOAuthService, payment-gateways.ts) → `generatePaymentGatewayId`
- `tenant_payment_gateway_settings` — 1 site → `generatePaymentGatewaySettingsId`
- `tenant_storefront_options_settings` — 2 sites → `generateStorefrontOptionsSettingsId`
- `tenant_storefront_type_settings` — 1 site → `generateStorefrontTypeSettingsId`
- `tenant_featured_options_settings` — 1 site → `generateFeaturedOptionsSettingsId`
- `tenant_product_options_settings` — 1 site → `generateProductOptionsSettingsId`
- `tenant_quickstart_options_settings` — 1 site → `generateQuickstartOptionsSettingsId`
- `tenant_feature_overrides_list` — 7 sites → `generateFeatureOverrideId`
- `tenant_feature_flags_list` — 1 site → `generateFeatureFlagId`
- Subscription payment in `subscription-billing.ts` — 1 site → existing `generatePaymentId`

**Already compliant (2 tables):**
- `tenant_commerce_settings` — already used `generateTenantCommerceSettingsId`
- `tenant_storefront_policies` — already used `generateStorefrontPolicyId`

**Deferred (1 table — requires column type migration):**
- `tenant_feature_purchases` — schema uses `@db.Uuid` with `gen_random_uuid()` default. Needs migration to `VarChar(255)` + `generateFeaturePurchaseId(tenantId)` → `fpur-{tk}-{nanoid}`. Low priority (admin-only table, low volume).

**No app-level creates found (1 table):**
- `tenant_shipping_carriers` — no `prisma.tenant_shipping_carriers.create()` calls in `src/`. Generator `generateShippingCarrierId` added for future use.

## 11. Verification

```bash
# Backend type check
cd apps/api && npx tsc --noEmit

# Frontend type check
cd apps/web && npx tsc --noEmit
```
