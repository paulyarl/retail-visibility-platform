# Smart Sale Tagging System

## Overview

The Smart Sale Tagging System automatically tags products with the "sale" featured type when they have an active sale price, creating intelligent product discovery without manual intervention. This system leverages materialized views (MV) for performance and real-time sale detection.

## 🎯 Business Value

### For Merchants
- **Zero Manual Effort**: Products automatically appear in sale collections when priced
- **Revenue Optimization**: Sale products get prominent display without manual tagging
- **Consistent Branding**: All sale products uniformly tagged and displayed
- **Time Savings**: No need to manually tag each product when running sales

### For Customers
- **Better Discovery**: Sale products automatically highlighted in search and browsing
- **Trustworthy Display**: Consistent sale badge presentation across all products
- **Easy Shopping**: Clear identification of discounted items
- **Real-Time Updates**: Sale status reflects current pricing instantly

### For Platform
- **Data Quality**: Eliminates human error in sale product tagging
- **Performance**: MV-based system for fast sale product queries
- **Analytics**: Rich data on sale performance and auto-tagging effectiveness
- **Scalability**: Handles thousands of products with minimal overhead

## 🏗️ Architecture

### Core Components

1. **Enhanced Materialized View** (`storefront_products_mv`)
   - Automatically detects sale pricing
   - Applies smart featured type logic
   - Maintains performance with optimized indexes

2. **Smart Tagging Logic**
   - Detects: `sale_price_cents < price_cents` AND `sale_price_cents > 0`
   - Prioritizes: Manual settings over automatic tagging
   - Preserves: Existing manual featured types

3. **API Endpoints** (`/api/smart-sale-tagging/*`)
   - Statistics and monitoring
   - Manual refresh capabilities
   - Product listing with tagging info

4. **Refresh Scripts**
   - Automated MV refresh
   - Health monitoring
   - Statistics reporting

## 📋 Smart Tagging Logic

### Priority System

1. **Manual Featured Types** (Highest Priority)
   - Merchant manually sets featured type
   - Preserved even if product is on sale
   - Example: Manual "new_arrival" + sale price = "new_arrival" (not "sale")

2. **Automatic Sale Tagging** (Medium Priority)
   - Product has valid sale price
   - No manual "sale" tag exists
   - Automatically tagged as "sale" with priority 3

3. **Default State** (Lowest Priority)
   - No sale price
   - No manual featured type
   - No automatic tagging applied

### Tagging Rules

```sql
-- Smart featured type logic
CASE 
  WHEN i.sale_price_cents IS NOT NULL 
       AND i.sale_price_cents > 0 
       AND i.sale_price_cents < i.price_cents
       AND (fp.featured_type IS NULL OR fp.featured_type != 'sale')
  THEN 'sale'
  ELSE fp.featured_type
END AS featured_type
```

### Discount Calculation

```sql
-- Automatic discount percentage
CASE
  WHEN i.sale_price_cents IS NOT NULL 
       AND i.sale_price_cents > 0 
       AND i.sale_price_cents < i.price_cents
  THEN ROUND(((i.price_cents - i.sale_price_cents)::numeric / i.price_cents * 100), 2)
  ELSE 0
END AS discount_percentage
```

## 🚀 Implementation

### Migration Script

**File**: `apps/api/src/migrations/add-smart-sale-tagging-mv.sql`

- Drops and recreates `storefront_products_mv` with smart logic
- Adds new fields for analytics and monitoring
- Creates optimized indexes for performance
- Includes comprehensive documentation

### Key New Fields

| Field | Type | Description |
|-------|------|-------------|
| `is_on_sale` | boolean | True if product has active sale price |
| `auto_tagged_as_sale` | boolean | True if automatically tagged by MV |
| `discount_percentage` | numeric | Calculated discount percentage |

### New Indexes

```sql
-- Performance indexes for sale queries
CREATE INDEX idx_storefront_mv_on_sale ON storefront_products_mv USING btree (is_on_sale) WHERE (is_on_sale = true);
CREATE INDEX idx_storefront_mv_auto_tagged ON storefront_products_mv USING btree (auto_tagged_as_sale) WHERE (auto_tagged_as_sale = true);
CREATE INDEX idx_storefront_mv_discount ON storefront_products_mv USING btree (discount_percentage DESC) WHERE (discount_percentage > 0);
```

## 📊 API Endpoints

### GET `/api/smart-sale-tagging/stats`

Get comprehensive statistics about smart sale tagging.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_products": 1250,
    "sale_products": 180,
    "auto_tagged_sales": 142,
    "sale_featured": 180,
    "auto_sale_featured": 142,
    "avg_discount": 23.5,
    "max_discount": 75,
    "min_discount": 5,
    "sale_percentage": 14,
    "auto_tag_percentage": 79
  },
  "tenant_breakdown": [...]
}
```

### POST `/api/smart-sale-tagging/refresh`

Manually refresh the materialized view (admin only).

**Permissions:** `PLATFORM_ADMIN`, `TENANT_ADMIN`, `TENANT_OWNER`

### GET `/api/smart-sale-tagging/products`

Get products with smart sale tagging information.

**Query Parameters:**
- `tenant_id` (optional): Filter by tenant
- `auto_tagged_only` (optional): Show only auto-tagged products
- `limit` (optional): Pagination limit (default: 50)
- `offset` (optional): Pagination offset (default: 0)

### GET `/api/smart-sale-tagging/health`

Health check for the smart sale tagging system.

## 🔄 Refresh Strategy

### Automatic Refresh

The MV should be refreshed when:
- Products are updated with new sale prices
- Inventory changes affect stock status
- Featured products are manually modified

### Manual Refresh

```bash
# Run the refresh script
npx ts-node apps/api/src/scripts/refresh-smart-sale-mv.ts

# Or via API
curl -X POST http://localhost:3000/api/smart-sale-tagging/refresh \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Scheduled Refresh

Consider adding to cron for production:
```bash
# Refresh every 15 minutes during business hours
*/15 8-22 * * * cd /app && npx ts-node src/scripts/refresh-smart-sale-mv.ts
```

## 📈 Monitoring & Analytics

### Key Metrics

1. **Tagging Effectiveness**
   - Percentage of sale products auto-tagged
   - Manual vs automatic tagging ratio
   - Tagging accuracy (false positives/negatives)

2. **Sale Performance**
   - Total products on sale
   - Average discount percentage
   - Sale product distribution by tenant

3. **System Health**
   - MV refresh frequency
   - Query performance metrics
   - Data consistency checks

### Sample Analytics Queries

```sql
-- Auto-tagging effectiveness
SELECT 
  COUNT(*) as total_sales,
  COUNT(CASE WHEN auto_tagged_as_sale = true THEN 1 END) as auto_tagged,
  ROUND(COUNT(CASE WHEN auto_tagged_as_sale = true THEN 1 END) * 100.0 / COUNT(*), 2) as auto_tag_percentage
FROM storefront_products_mv 
WHERE is_on_sale = true;

-- Discount distribution
SELECT 
  CASE 
    WHEN discount_percentage BETWEEN 1 AND 10 THEN '1-10%'
    WHEN discount_percentage BETWEEN 11 AND 25 THEN '11-25%'
    WHEN discount_percentage BETWEEN 26 AND 50 THEN '26-50%'
    WHEN discount_percentage > 50 THEN '50%+'
  END as discount_range,
  COUNT(*) as product_count
FROM storefront_products_mv 
WHERE discount_percentage > 0
GROUP BY discount_range
ORDER BY product_count DESC;
```

## 🛠️ Troubleshooting

### Common Issues

1. **MV Not Refreshing**
   - Check refresh script logs
   - Verify database permissions
   - Monitor for long-running transactions

2. **Incorrect Tagging**
   - Verify sale price logic (`sale_price_cents < price_cents`)
   - Check for NULL values in price fields
   - Review manual featured type overrides

3. **Performance Issues**
   - Monitor MV refresh duration
   - Check index usage
   - Optimize query patterns

### Health Check

```bash
# Check MV status
curl http://localhost:3000/api/smart-sale-tagging/health

# Expected response
{
  "success": true,
  "healthy": true,
  "last_refresh": "2024-01-25T10:30:00Z",
  "message": "Smart sale tagging system is healthy"
}
```

## 🎯 Best Practices

### For Merchants

1. **Pricing Strategy**
   - Set meaningful sale prices (not just $1 off)
   - Use consistent discount percentages
   - Monitor auto-tagged products for accuracy

2. **Featured Type Management**
   - Manual tags override automatic sale tagging
   - Use manual tags for special campaigns
   - Review auto-tagged products periodically

### For Developers

1. **Query Optimization**
   - Use new sale-specific indexes
   - Filter by `is_on_sale` for sale products
   - Leverage `discount_percentage` for sorting

2. **API Integration**
   - Monitor `/health` endpoint
   - Handle MV refresh delays gracefully
   - Use pagination for large product sets

### For Platform Admins

1. **System Monitoring**
   - Track auto-tagging percentages
   - Monitor MV refresh performance
   - Set up alerts for system health

2. **Data Quality**
   - Regular validation of tagging logic
   - Review edge cases and exceptions
   - Maintain documentation updates

## 📚 Related Systems

- **Featured Products System**: Manual featured type management
- **Product Display System**: Frontend sale price display
- **Shopping Cart System**: Sale price calculation and checkout
- **Analytics System**: Sale performance tracking

## 🔄 Version History

### v1.0.0 (Current)
- Initial smart sale tagging implementation
- Enhanced materialized view with sale detection
- API endpoints for monitoring and management
- Comprehensive documentation and tooling

---

**Status**: ✅ Production Ready  
**Last Updated**: January 25, 2026  
**Dependencies**: PostgreSQL 12+, Node.js 18+
