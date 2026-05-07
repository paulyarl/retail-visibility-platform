# Order Pricing History - Capturing Sale Prices at Purchase Time

## Overview

When a customer purchases an item that's on sale, we capture both the list price and the sale price in the order history.

## Database Schema

### order_items Table

Pricing fields (all in cents):
- unit_price_cents: Actual price paid (sale price if on sale)
- list_price_cents: Original list price (if item was on sale)
- discount_cents: Total discount amount for this line item
- quantity: Number of items
- subtotal_cents: unit_price_cents * quantity

## Pricing Logic

When item is NOT on sale:
- unit_price_cents = product.price_cents
- list_price_cents = NULL
- discount_cents = 0

When item IS on sale:
- unit_price_cents = product.sale_price_cents
- list_price_cents = product.price_cents
- discount_cents = (list_price_cents - unit_price_cents) * quantity

## Benefits

1. Historical accuracy - Exact price paid at time of purchase
2. Customer service - Reference for returns, refunds, disputes
3. Analytics - Track promotion effectiveness
4. Compliance - Accurate financial records
5. Customer experience - Show savings on receipts

## Receipt Display Example

Regular Purchase:
Widget Pro (x2)                    $199.98

Sale Purchase:
Widget Pro (x2)
  Regular: $99.99 each
  Sale: $79.99 each                $159.98
  You saved: $40.00 (20%)
