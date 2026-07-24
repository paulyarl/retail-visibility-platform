# Retrofit: UTM attribution for CRM and abandoned-cart recovery

## Goal

Capture `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` (and `ref`) at the first click, carry it into the cart/recovery record, and preserve it in the CRM customer profile so Growth can measure full-funnel Pinterest/Meta/organic performance.

## 1. Add UTM columns to the database

### `abandoned_carts`

```prisma
model abandoned_carts {
  // ... existing fields ...
  utm_source   String?  @db.VarChar(255)
  utm_medium   String?  @db.VarChar(255)
  utm_campaign String?  @db.VarChar(255)
  utm_content  String?  @db.VarChar(255)
  utm_term     String?  @db.VarChar(255)
  ref          String?  @db.VarChar(255)
}
```

### `customers`

Use a `first-touch` model on the customer record plus a `last_touch_utm` JSON block for updates.

```prisma
model customers {
  // ... existing fields ...
  first_utm_source   String?  @db.VarChar(255)
  first_utm_medium   String?  @db.VarChar(255)
  first_utm_campaign String?  @db.VarChar(255)
  first_utm_content  String?  @db.VarChar(255)
  last_utm_json      Json?    @default("{}")
}
```

Why both: `first_utm_*` columns are queryable in SQL; `last_utm_json` is flexible and can carry `utm_term`, `ref`, and dynamic platform fields without schema churn.

### Migration command

```bash
cd apps/api
npx prisma migrate dev --name add_utm_to_abandoned_carts_and_customers
npx prisma generate
```

## 2. Frontend: read stored UTM and send it to the cart track endpoint

`apps/web/src/lib/cart/cartManager.ts` already calls `checkoutService.trackCart(...)`. Update `trackCartWithServer` to include UTM params from `sessionStorage`:

```ts
import { getStoredUTMParams } from '@/lib/utm';

async function trackCartWithServer(tenantId: string, cart: Cart): Promise<void> {
  if (typeof window === 'undefined') return;
  if (cart.items.length === 0) return;

  try {
    const cartId = getCartKey(tenantId);
    const customerEmail = localStorage.getItem('customer_email') || undefined;
    const customerName = localStorage.getItem('customer_name') || undefined;
    const customerId = localStorage.getItem('customer_id') || undefined;
    const utmParams = getStoredUTMParams();

    const { checkoutService } = await import('@/services/CheckoutService');
    await checkoutService.trackCart({
      tenantId,
      cartId,
      customerEmail,
      customerName,
      customerId,
      items: cart.items.map(item => ({ /* ... */ })),
      utmParams,
    });
  } catch {
    // Silent fail — tracking is best-effort
  }
}
```

Update the `CheckoutService.trackCart` payload type:

```ts
// apps/web/src/services/CheckoutService.ts
async trackCart(payload: {
  tenantId: string;
  cartId: string;
  customerEmail?: string;
  customerName?: string;
  customerId?: string;
  items: any[];
  utmParams?: Record<string, string | undefined>;
}): Promise<void> { ... }
```

## 3. API route: forward UTM to the service

`apps/api/src/routes/cart.ts` (`POST /api/cart/track`):

```ts
const { tenantId, cartId, customerEmail, customerName, customerId, items, utmParams } = req.body;

await abandonedCartService.trackCart({
  cartId,
  tenantId,
  customerEmail,
  customerName,
  customerId,
  items,
  utmParams,
});
```

## 4. `AbandonedCartService`: store UTM and append it to the recovery URL

```ts
export interface TrackCartInput {
  cartId?: string;
  tenantId: string;
  customerEmail?: string;
  customerName?: string;
  customerId?: string;
  items: CartItemInput[];
  utmParams?: { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string; ref?: string };
}

async trackCart(input: TrackCartInput): Promise<void> {
  const { utmParams } = input;
  const cartValueCents = input.items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);

  // ...

  const data = {
    // existing fields
    utm_source: utmParams?.utm_source ?? null,
    utm_medium: utmParams?.utm_medium ?? null,
    utm_campaign: utmParams?.utm_campaign ?? null,
    utm_content: utmParams?.utm_content ?? null,
    utm_term: utmParams?.utm_term ?? null,
    ref: utmParams?.ref ?? null,
  };

  if (existing) {
    await this.prisma.abandoned_carts.update({ where: { id: existing.id }, data: { ...data, updated_at: new Date() } });
  } else {
    await this.prisma.abandoned_carts.create({
      data: { id: generateAbandonedCartId(input.tenantId), tenant_id: input.tenantId, ...data },
    });
  }
}
```

### Recovery URL with UTM appended

```ts
const utmQs = new URLSearchParams();
if (cart.utm_source) utmQs.set('utm_source', cart.utm_source);
if (cart.utm_medium) utmQs.set('utm_medium', cart.utm_medium);
if (cart.utm_campaign) utmQs.set('utm_campaign', cart.utm_campaign);
if (cart.utm_content) utmQs.set('utm_content', cart.utm_content);
if (cart.ref) utmQs.set('ref', cart.ref);

const query = utmQs.toString() ? `?${utmQs.toString()}` : '';
const recoveryUrl = `${webUrl}/tenant/${cart.tenant_id}?recover_cart=${cart.cart_id || cart.id}${query ? `&${query}` : ''}`;
```

> Note: prefer `mergeUTMIntoHref`-style logic so `recover_cart` is preserved as the lead param and UTM params are appended after.

## 5. CRM: persist UTM on the customer record

There are two touchpoints:

### A. On first signup/contact creation

Wherever `customers.create` is called, pass the stored UTM params from the request/session and set `first_utm_*` if they are still `null`:

```ts
const customer = await prisma.customers.create({
  data: {
    // ... required fields ...
    first_utm_source: utm.utm_source,
    first_utm_medium: utm.utm_medium,
    first_utm_campaign: utm.utm_campaign,
    first_utm_content: utm.utm_content,
    last_utm_json: utm as any,
  },
});
```

### B. On every returning login/order/tracked cart

Update `last_utm_json` with the latest UTM set so the last-touch source is current, while `first_utm_*` stays unchanged:

```ts
await prisma.customers.update({
  where: { id: customerId },
  data: {
    last_utm_json: utm as any,
    updated_at: new Date(),
  },
});
```

## 6. `CrmAlertService`: include UTM in alert metadata

Update `createAbandonedCartAlert` to accept `utmParams` and add it to `metadata`:

```ts
async createAbandonedCartAlert(params: {
  // ... existing params ...
  utmParams?: { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; ref?: string };
}): Promise<void> {
  // ...
  metadata: {
    abandoned_cart_id: params.abandonedCartId,
    customer_email: params.customerEmail,
    cart_value_cents: params.cartValueCents,
    item_count: params.itemCount,
    recovery_url: params.recoveryUrl,
    utm_source: params.utmParams?.utm_source,
    utm_medium: params.utmParams?.utm_medium,
    utm_content: params.utmParams?.utm_content,
    ref: params.utmParams?.ref,
  },
}
```

## 7. Email recovery copy alignment

The abandoned-cart recovery email is already generated in `AbandonedCartService.sendRecoveryEmail`. With UTM on the recovery URL:

- **Subject:** keep the subject emotional/commercial, but if `utm_source === 'pinterest'`, optionally A/B test a Pinterest-specific subject ("Still thinking about this?").
- **Body CTA:** the `Complete Your Purchase` link now carries `utm_source=pinterest&utm_content=P-03&ref=pinterest`, so a returning checkout is still attributed.
- **Plain text:** use the same UTM-appended `recoveryUrl`.

## 8. Reporting queries

### Abandoned cart conversion by UTM source

```sql
SELECT
  utm_source,
  utm_content,
  COUNT(*) AS carts,
  SUM(CASE WHEN converted THEN 1 ELSE 0 END) AS recovered,
  ROUND(100.0 * SUM(CASE WHEN converted THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS recovery_rate,
  SUM(cart_value_cents) / 100 AS total_value
FROM abandoned_carts
WHERE utm_source IS NOT NULL
GROUP BY utm_source, utm_content
ORDER BY recovery_rate DESC;
```

### Customer LTV by first-touch UTM

```sql
SELECT
  first_utm_source,
  first_utm_content,
  COUNT(*) AS customers,
  SUM(platform_value_cents) / 100 AS revenue,
  AVG(platform_value_cents) / 100 AS aov
FROM customers
WHERE first_utm_source IS NOT NULL
GROUP BY first_utm_source, first_utm_content;
```

## 9. Does email marketing need its own setup?

Not a separate tool at first. The existing abandoned-cart recovery email is the first email in the UTM-aware funnel. What changes is the **data model** so every email link can be tagged.

### Recommended follow-up campaigns

| Campaign | Trigger | UTM | Goal |
|---|---|---|---|
| Pinterest welcome | Email captured on `/solutions/*` via lead magnet | `utm_source=pinterest&utm_medium=email` | Trial start |
| 7-day win-back | Pinterest-referred cart not recovered | `utm_source=pinterest&utm_medium=email` | Return to checkout |
| Trial-to-paid | Pinterest-referred trial expiring | `utm_source=pinterest&utm_medium=email` | Convert to paid |

These reuse the same `first_utm_*` / `last_utm_json` fields to seed UTM parameters in outgoing email links.

## 10. Rollout order

1. Merge the Prisma schema changes and migration.
2. Regenerate the Prisma client (`npx prisma generate`).
3. Update `cartManager.ts` and `CheckoutService.ts` on the web.
4. Update `apps/api/src/routes/cart.ts`.
5. Update `apps/api/src/services/AbandonedCartService.ts` and `CrmAlertService.ts`.
6. Update any `customers.create` / `customers.update` call sites to write UTM.
7. Run `pnpm checkweb` and `pnpm checkapi`.
8. Validate with a staged UTM-tagged URL: `https://tenant.example.com/products/abc?utm_source=pinterest&utm_content=P-03`, add to cart, confirm the `abandoned_carts` row has the UTM values.
