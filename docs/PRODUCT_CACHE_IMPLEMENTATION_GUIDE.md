# Product Cache Implementation Guide

## Quick Summary

**What:** Intelligent product caching system that grows organically
**Why:** 95-99% cost reduction, 10x faster, self-improving
**How:** Cache-first with AI fallback, usage tracking, quality scoring

## Installation Steps

### 1. Install OpenAI Package

```bash
cd apps/api
npm install openai
# or
pnpm add openai
```

### 2. Add Environment Variable

```bash
# In .env or Doppler
OPENAI_API_KEY=sk-proj-...your-key-here...
```

### 3. Run Database Migration

```bash
# Apply the schema
psql $DATABASE_URL < prisma/migrations/add_quick_start_product_cache.sql

# Or use Prisma if you add to schema.prisma
npx prisma db push
```

### 4. Import the Service

```typescript
import { productCacheService } from './services/ProductCacheService';
```

## Usage Examples

### Basic Usage

```typescript
// Get 10 products for a pharmacy category
const products = await productCacheService.getProductsForScenario({
  businessType: 'pharmacy',
  categoryName: 'Over-the-Counter Medications',
  googleCategoryId: '5427',
  count: 10
});

// Returns:
[
  {
    name: "Tylenol Extra Strength 500mg (100 caplets)",
    price: 1299,
    brand: "Tylenol",
    description: "Fast-acting pain reliever...",
    sku: "TYL-ES-500-100"
  },
  // ... 9 more products
]
```

### Integration with Quick-Start

```typescript
// In quick-start endpoint
router.post('/quick-start', async (req, res) => {
  const { businessType, productCount } = req.body;
  
  // Step 1: Generate categories (existing logic)
  const categories = await generateCategories(businessType);
  
  // Step 2: Get products for each category
  const allProducts = [];
  const productsPerCategory = Math.ceil(productCount / categories.length);
  
  for (const category of categories) {
    const products = await productCacheService.getProductsForScenario({
      businessType,
      categoryName: category.name,
      googleCategoryId: category.googleCategoryId,
      count: productsPerCategory
    });
    
    allProducts.push(...products);
  }
  
  // Step 3: Create items in database
  // ... existing creation logic
});
```

### Record User Feedback

```typescript
// When user gives feedback on a product
await productCacheService.recordFeedback(productId, isPositive);

// Positive feedback: quality_score += 0.1
// Negative feedback: quality_score -= 0.1
```

### Get Cache Statistics

```typescript
const stats = await productCacheService.getCacheStats();

console.log(`Total products: ${stats.totalProducts}`);
console.log(`By business type:`, stats.byBusinessType);
console.log(`Top products:`, stats.topProducts);
```

## How It Works

### First Request (Cold Start)

```
Request: pharmacy + "Over-the-Counter Medications" + 10 products
  ↓
Cache: Empty (0 products)
  ↓
AI: Generate 10 products ($0.04)
  ↓
Cache: Save 10 products
  ↓
Response: 10 products (5 seconds)
```

### Second Request (Warm Cache)

```
Request: pharmacy + "Over-the-Counter Medications" + 10 products
  ↓
Cache: 10 products found
  ↓
Response: 10 products (0.5 seconds, $0.00)
```

### Third Request (Partial Cache)

```
Request: pharmacy + "Vitamins & Supplements" + 10 products
  ↓
Cache: 0 products found (new category)
  ↓
AI: Generate 10 products ($0.04)
  ↓
Cache: Save 10 products
  ↓
Response: 10 products (5 seconds)
```

## Cost Analysis

### Scenario: 1000 Tenants

**Pure AI (No Cache):**
- 1000 tenants × 50 products × $0.004 = **$200**
- Time: 5 seconds per tenant

**With Organic Cache:**
- First tenant: $0.20 (cold start)
- Remaining 999: $0.00 (cache hits)
- **Total: $0.20 (99.9% savings)**
- Time: 0.5 seconds per tenant (10x faster)

## Configuration

### OpenAI Model Selection

```typescript
// In ProductCacheService.ts

// Option 1: GPT-4 Turbo (best quality, higher cost)
model: 'gpt-4-turbo-preview'  // $0.004 per product

// Option 2: GPT-3.5 Turbo (good quality, lower cost)
model: 'gpt-3.5-turbo'  // $0.0005 per product

// Option 3: GPT-4o (balanced)
model: 'gpt-4o'  // $0.002 per product
```

### Cache Behavior

```typescript
// Minimum quality score to use cached products
WHERE quality_score >= 0.0  // Default: neutral or positive

// Product selection priority
ORDER BY 
  usage_count DESC,     // Most used first
  quality_score DESC,   // Then highest rated
  created_at DESC       // Then most recent
```

## Monitoring

### Database Queries

```sql
-- Total products in cache
SELECT COUNT(*) FROM quick_start_product_cache;

-- Products by business type
SELECT business_type, COUNT(*) 
FROM quick_start_product_cache 
GROUP BY business_type;

-- Most used products
SELECT product_name, usage_count, quality_score
FROM quick_start_product_cache
ORDER BY usage_count DESC
LIMIT 10;

-- Cache hit rate (requires logging)
SELECT 
  SUM(CASE WHEN source = 'cache' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as hit_rate
FROM product_generation_logs;
```

### Logging

```typescript
// Add to your logging system
console.log('[ProductCache] Cache HIT: 10/10 products');
console.log('[ProductCache] Cache MISS: 0/10 products, generating with AI');
console.log('[ProductCache] Cache PARTIAL: 7/10 products, generating 3 with AI');
```

## Error Handling

### AI Failure

```typescript
try {
  products = await generateWithAI(...);
} catch (error) {
  console.error('AI generation failed:', error);
  // Fallback to generic products
  products = getFallbackProducts(...);
}
```

### Database Failure

```typescript
try {
  await saveToCache(...);
} catch (error) {
  console.error('Cache save failed:', error);
  // Continue anyway - products still returned to user
}
```

## Testing

### Unit Tests

```typescript
describe('ProductCacheService', () => {
  it('should return cached products when available', async () => {
    const products = await productCacheService.getProductsForScenario({
      businessType: 'pharmacy',
      categoryName: 'Test Category',
      count: 5
    });
    
    expect(products).toHaveLength(5);
    expect(products[0]).toHaveProperty('name');
    expect(products[0]).toHaveProperty('price');
  });
  
  it('should generate with AI on cache miss', async () => {
    // Mock empty cache
    // Mock OpenAI response
    // Verify AI was called
    // Verify products were saved to cache
  });
});
```

### Integration Tests

```bash
# Test full quick-start flow
curl -X POST http://localhost:4000/api/quick-start \
  -H "Content-Type: application/json" \
  -d '{
    "businessType": "pharmacy",
    "productCount": 50
  }'
```

## Maintenance

### Clean Up Low-Quality Products

```sql
-- Remove products with negative quality scores
DELETE FROM quick_start_product_cache
WHERE quality_score < -0.5;
```

### Reset Usage Counts

```sql
-- Reset usage counts (e.g., after major changes)
UPDATE quick_start_product_cache
SET usage_count = 0;
```

### Export Cache

```sql
-- Export for backup or analysis
COPY quick_start_product_cache TO '/tmp/product_cache.csv' CSV HEADER;
```

## Troubleshooting

### Issue: AI Not Generating Products

**Check:**
1. Is `OPENAI_API_KEY` set?
2. Is OpenAI package installed?
3. Check API quota/limits
4. Check error logs

**Solution:**
```bash
# Verify env var
echo $OPENAI_API_KEY

# Reinstall package
npm install openai

# Check logs
tail -f logs/api.log | grep ProductCache
```

### Issue: Cache Not Saving

**Check:**
1. Database connection
2. Table exists
3. Unique constraint violations
4. Permissions

**Solution:**
```sql
-- Verify table exists
SELECT * FROM quick_start_product_cache LIMIT 1;

-- Check for constraint violations
SELECT business_type, category_name, product_name, COUNT(*)
FROM quick_start_product_cache
GROUP BY business_type, category_name, product_name
HAVING COUNT(*) > 1;
```

### Issue: Poor Quality Products

**Check:**
1. AI prompt quality
2. Temperature setting
3. Model selection
4. User feedback

**Solution:**
```typescript
// Adjust prompt for better results
const prompt = `Generate REALISTIC products...
- Use REAL brand names
- Use ACCURATE prices
- Include size/quantity
- Vary the selection`;

// Lower temperature for more consistent results
temperature: 0.7  // Instead of 0.8
```

## Next Steps

1. **Install Dependencies:** `npm install openai`
2. **Add API Key:** Set `OPENAI_API_KEY` in environment
3. **Run Migration:** Apply database schema
4. **Test Service:** Try generating products
5. **Integrate:** Update quick-start endpoint
6. **Monitor:** Watch cache growth and hit rate
7. **Optimize:** Adjust based on usage patterns

## Support

- **Documentation:** `/docs/PRODUCT_CACHE_ARCHITECTURE.md`
- **Service Code:** `/apps/api/src/services/ProductCacheService.ts`
- **Migration:** `/apps/api/prisma/migrations/add_quick_start_product_cache.sql`

**The cache will grow organically with use - no manual seeding required! 🌱**
