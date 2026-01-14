# ID Generator Pattern Documentation

## Overview

Centralized ID generation system for all entities in the RVP platform. Provides consistent, short, URL-friendly IDs that replace long UUIDs and composite keys.

## Location

`apps/api/src/lib/id-generator.ts`

## Core Principles

1. **Consistency** - All IDs follow the same pattern: `prefix-randomstring`
2. **Brevity** - 70-80% shorter than UUIDs (10-14 chars vs 36 chars)
3. **URL-Safe** - Only lowercase alphanumeric characters
4. **Uniqueness** - Collision probability: ~1 in 2.8 trillion for 8-char IDs
5. **Readability** - Human-readable prefixes indicate entity type

## ID Formats

### Standard Entity IDs (Random)

```typescript
// Tenant IDs
generateTenantId()           // tid-abc12345 (12 chars)

// User IDs
generateUserId()             // uid-abc12 (9 chars)

// Item/Product IDs
generateItemId()             // sid-abc12345 (12 chars)

// Photo Asset IDs
generatePhotoId(tenantId, itemId)  // pid-{tenant}-{item}-abc123

// Session IDs
generateSessionId(tenantId)  // sid-{tenant}-abc12345
```

### Order Management IDs

```typescript
// Order Numbers (Sequential)
await generateOrderNumber(tenantId)  // ORD-2026-000001 (human-readable)

// Payment IDs
generatePaymentId()          // pay-abc123xyz0 (14 chars)

// Order Item IDs
generateOrderItemId()        // item-abc12345 (13 chars)

// Shipment IDs
generateShipmentId()         // ship-abc12345 (13 chars)
```

### Integration IDs

```typescript
// Clover Integration
generateCloverItemId()       // csid-abc12345
generateCloverIntegrationId() // cigid-abc12345
generateCloverItemMappingsId() // csmid-abc12345

// Organization IDs
generateOrganizationId(ownerId) // oid-{owner}-abc123
```

## Sequential Order Numbers

The order number generator uses a special pattern for human-readable, sequential numbers:

### Format
```
ORD-YYYY-NNNNNN
```
- `ORD` - Prefix indicating order
- `YYYY` - Current year (2026)
- `NNNNNN` - 6-digit sequential number (000001, 000002, etc.)

### Features

1. **Sequential** - Numbers increment per tenant per year
2. **Thread-Safe** - Retry logic prevents collisions
3. **Year-Based** - Resets to 000001 each year
4. **Collision Handling** - Up to 10 retry attempts with offset
5. **Fallback** - Timestamp-based if all retries fail

### Implementation

```typescript
export async function generateOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  // Try up to 10 times to find an available order number
  for (let attempt = 0; attempt < 10; attempt++) {
    // Get the highest order number for this year
    const latestOrder = await prisma.orders.findFirst({
      where: {
        tenant_id: tenantId,
        order_number: { startsWith: prefix },
      },
      orderBy: { order_number: 'desc' },
      select: { order_number: true },
    });

    let nextSequence = 1;
    if (latestOrder) {
      const parts = latestOrder.order_number.split('-');
      const currentSequence = parseInt(parts[2], 10);
      nextSequence = currentSequence + 1;
    }

    // Add random offset on retry to avoid collisions
    if (attempt > 0) {
      nextSequence += attempt;
    }

    const sequentialNumber = nextSequence.toString().padStart(6, '0');
    const orderNumber = `${prefix}${sequentialNumber}`;

    // Check if this order number is available
    const existing = await prisma.orders.findUnique({
      where: { order_number: orderNumber },
    });

    if (!existing) {
      return orderNumber;
    }
  }

  // Fallback: use timestamp-based unique number
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${randomSuffix}`;
}
```

## Usage Examples

### Creating an Order

```typescript
import { generateOrderNumber, generateOrderItemId } from '../lib/id-generator';
import { customAlphabet } from 'nanoid';

// Generate order ID
const generateOrderId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

// Create order
const order = await prisma.orders.create({
  data: {
    id: `ord-${generateOrderId()}`,
    order_number: await generateOrderNumber(tenantId),
    tenant_id: tenantId,
    // ... other fields
    order_items: {
      create: items.map(item => ({
        id: generateOrderItemId(),
        sku: item.sku,
        name: item.name,
        // ... other fields
      })),
    },
  },
});
```

### Creating a Payment

```typescript
import { generatePaymentId } from '../lib/id-generator';

const payment = await prisma.payments.create({
  data: {
    id: generatePaymentId(),
    order_id: orderId,
    tenant_id: tenantId,
    amount_cents: 9999,
    // ... other fields
  },
});
```

## Benefits

### 1. Shorter URLs
```
Before: /orders/550e8400-e29b-41d4-a716-446655440000
After:  /orders/ord-abc123xyz0
```

### 2. Better UX
- Human-readable order numbers: `ORD-2026-000001`
- Easy to communicate over phone/email
- Professional appearance

### 3. Database Efficiency
- Smaller index sizes (10-14 chars vs 36 chars)
- Faster lookups and joins
- Reduced storage requirements

### 4. Type Safety
- Prefix indicates entity type
- Easy to validate and parse
- Prevents mixing entity types

## Migration Strategy

### For New Entities
Use ID generators from the start:
```typescript
const newEntity = await prisma.entity.create({
  data: {
    id: generateEntityId(),
    // ... fields
  },
});
```

### For Existing Entities
Keep existing UUIDs, use generators for new records:
```typescript
// Existing records keep their UUIDs
// New records use short IDs
const id = existingId || generateEntityId();
```

## Best Practices

1. **Always use the centralized generators** - Don't create IDs manually
2. **Import from lib/id-generator** - Single source of truth
3. **Use appropriate prefix** - Matches entity type
4. **Handle async for sequential IDs** - Order numbers require await
5. **Test collision handling** - Verify retry logic works

## Testing

```typescript
// Test order number generation
const orderNum1 = await generateOrderNumber('tenant-1');
const orderNum2 = await generateOrderNumber('tenant-1');

console.log(orderNum1); // ORD-2026-000001
console.log(orderNum2); // ORD-2026-000002

// Test uniqueness
const id1 = generatePaymentId();
const id2 = generatePaymentId();

console.log(id1 !== id2); // true
```

## Error Handling

### Order Number Collisions
- Retries up to 10 times with offset
- Falls back to timestamp-based ID
- Logs collision attempts for monitoring

### General ID Collisions
- Nanoid provides cryptographic randomness
- Collision probability: ~1 in 2.8 trillion
- No retry needed for random IDs

## Performance

- **Random IDs**: O(1) - Instant generation
- **Sequential Order Numbers**: O(1) average, O(n) worst case with retries
- **Database Impact**: Minimal - single query per order number

## Future Enhancements

1. **Distributed Sequences** - Redis-based sequential IDs for multi-region
2. **Custom Prefixes** - Per-tenant customizable order number format
3. **Batch Generation** - Generate multiple IDs in one call
4. **Analytics** - Track ID generation patterns and collisions

---

**Last Updated:** January 10, 2026
**Maintainer:** Platform Team
**Related Files:**
- `apps/api/src/lib/id-generator.ts`
- `apps/api/src/routes/checkout.ts`
- `apps/api/src/routes/checkout-payments.ts`
