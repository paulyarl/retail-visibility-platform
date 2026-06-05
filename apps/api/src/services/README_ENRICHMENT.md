# Barcode Enrichment Service

Comprehensive barcode enrichment service with multiple external API providers, caching, rate limiting, and fallback strategies.

---

## Features

### ✅ Multi-Provider Support
- **UPC Database** - Primary provider for general products
- **Open Food Facts** - Specialized for food/grocery items
- **Fallback** - Graceful degradation when APIs fail

### ✅ Caching Layer
- **In-Memory Cache** - 24-hour TTL
- **LRU Eviction** - Max 10,000 entries
- **Cache Hit Tracking** - Logged for analytics

### ✅ Rate Limiting
- **Per-Provider Limits** - 500 requests/hour per provider
- **Automatic Throttling** - Prevents API quota exhaustion
- **Sliding Window** - 1-hour reset period

### ✅ Fallback Strategies
1. Check cache first (fastest)
2. Try UPC Database API
3. Try Open Food Facts API
4. Return minimal fallback data

---

## Configuration

### Environment Variables

```bash
# UPC Database API (optional but recommended)
UPC_DATABASE_API_KEY=your_api_key_here

# Feature flag to enable/disable enrichment
FF_SCAN_ENRICHMENT=true
```

### API Keys

#### UPC Database
- Sign up: https://upcdatabase.org/api
- Free tier: 100 requests/day
- Paid tier: Unlimited requests

#### Open Food Facts
- No API key required
- Free and open source
- Rate limit: Be respectful

---

## Usage

### Basic Enrichment

```typescript
import { barcodeEnrichmentService } from './services/BarcodeEnrichmentService';

// Enrich a barcode
const result = await barcodeEnrichmentService.enrich('012345678905', 'tenant-id');

console.log(result);
// {
//   name: 'Product Name',
//   description: 'Product description',
//   brand: 'Brand Name',
//   categoryPath: ['Category', 'Subcategory'],
//   priceCents: 1999,
//   metadata: { ... },
//   source: 'upc_database' | 'open_food_facts' | 'cache' | 'fallback'
// }
```

### Cache Management

```typescript
// Get cache stats
const stats = barcodeEnrichmentService.getCacheStats();
// { size: 1234, maxSize: 10000, ttlMs: 86400000 }

// Clear specific barcode
barcodeEnrichmentService.clearCache('012345678905');

// Clear all cache
barcodeEnrichmentService.clearCache();
```

### Rate Limit Monitoring

```typescript
// Get rate limit stats
const limits = barcodeEnrichmentService.getRateLimitStats();
// {
//   upc_database: { count: 45, remaining: 455, resetAt: '2025-11-04T01:00:00Z' },
//   open_food_facts: { count: 12, remaining: 488, resetAt: '2025-11-04T01:00:00Z' }
// }
```

---

## API Endpoints

### Admin Endpoints

#### GET /api/admin/enrichment/cache-stats
Get cache statistics

**Response:**
```json
{
  "success": true,
  "stats": {
    "size": 1234,
    "maxSize": 10000,
    "ttlMs": 86400000
  }
}
```

#### GET /api/admin/enrichment/rate-limits
Get rate limit status for all providers

**Response:**
```json
{
  "success": true,
  "stats": {
    "upc_database": {
      "count": 45,
      "remaining": 455,
      "resetAt": "2025-11-04T01:00:00.000Z"
    },
    "open_food_facts": {
      "count": 12,
      "remaining": 488,
      "resetAt": "2025-11-04T01:00:00.000Z"
    }
  }
}
```

#### POST /api/admin/enrichment/clear-cache
Clear cache for a specific barcode or all cache

**Request:**
```json
{
  "barcode": "012345678905"  // Optional, omit to clear all
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared for 012345678905"
}
```

---

## Data Flow

```
┌─────────────┐
│   Scan      │
│  Barcode    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Check     │
│   Cache     │──Yes──► Return cached data
└──────┬──────┘
       │ No
       ▼
┌─────────────┐
│ UPC Database│
│     API     │──Success──► Cache & Return
└──────┬──────┘
       │ Fail
       ▼
┌─────────────┐
│ Open Food   │
│   Facts     │──Success──► Cache & Return
└──────┬──────┘
       │ Fail
       ▼
┌─────────────┐
│  Fallback   │
│    Data     │──────────► Return minimal data
└─────────────┘
```

---

## Performance

### Latency Targets
- **Cache Hit**: <5ms
- **UPC Database**: <500ms
- **Open Food Facts**: <500ms
- **Fallback**: <10ms

### Cache Hit Rate
- **Target**: >80%
- **Actual**: Monitored via `barcodeLookupLog` table

### Rate Limit Usage
- **Target**: <400 requests/hour per provider
- **Actual**: Monitored via admin endpoints

---

## Database Logging

All enrichment attempts are logged to `barcodeLookupLog` table:

```sql
CREATE TABLE barcode_lookup_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  barcode TEXT NOT NULL,
  provider TEXT,
  status TEXT DEFAULT 'success',
  response JSON,
  latency_ms INTEGER,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Query Examples

```sql
-- Get cache hit rate
SELECT 
  provider,
  COUNT(*) as total,
  AVG(latency_ms) as avg_latency_ms
FROM barcode_lookup_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;

-- Get most looked up barcodes
SELECT 
  barcode,
  COUNT(*) as lookup_count
FROM barcode_lookup_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY barcode
ORDER BY lookup_count DESC
LIMIT 10;

-- Get error rate by provider
SELECT 
  provider,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / COUNT(*), 2) as error_rate
FROM barcode_lookup_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;
```

---

## Troubleshooting

### Issue: High cache miss rate

**Symptoms**: Most lookups hitting external APIs  
**Cause**: Cache TTL too short or cache size too small  
**Solution**: Increase `CACHE_TTL_MS` or max cache size

### Issue: Rate limit exceeded

**Symptoms**: Fallback data returned frequently  
**Cause**: Too many unique barcodes scanned  
**Solution**: 
- Increase rate limits
- Upgrade API plan
- Implement Redis cache for persistence

### Issue: Slow enrichment

**Symptoms**: Scan operations taking >2 seconds  
**Cause**: External API latency  
**Solution**:
- Check API status
- Implement timeout (currently 5s)
- Consider async enrichment

---

## Future Enhancements

### Redis Cache Layer
Replace in-memory cache with Redis for:
- Persistence across restarts
- Shared cache across instances
- Better eviction policies

```typescript
// Example Redis integration
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

private async getFromCache(barcode: string) {
  const cached = await redis.get(`barcode:${barcode}`);
  return cached ? JSON.parse(cached) : null;
}

private async saveToCache(barcode: string, data: any) {
  await redis.setex(`barcode:${barcode}`, 86400, JSON.stringify(data));
}
```

### Additional Providers
- Amazon Product Advertising API
- Google Shopping API
- Barcode Lookup API
- Custom tenant-specific APIs

### Machine Learning
- Category prediction from product name
- Price estimation based on similar products
- Brand extraction from text

---

## Testing

### Unit Tests

```typescript
describe('BarcodeEnrichmentService', () => {
  it('should return cached data on second lookup', async () => {
    const service = new BarcodeEnrichmentService();
    
    // First lookup (cache miss)
    const result1 = await service.enrich('123456', 'tenant-1');
    expect(result1.source).not.toBe('cache');
    
    // Second lookup (cache hit)
    const result2 = await service.enrich('123456', 'tenant-1');
    expect(result2.source).toBe('cache');
  });

  it('should respect rate limits', async () => {
    const service = new BarcodeEnrichmentService();
    
    // Exhaust rate limit
    for (let i = 0; i < 501; i++) {
      await service.enrich(`barcode-${i}`, 'tenant-1');
    }
    
    // Next lookup should use fallback
    const result = await service.enrich('new-barcode', 'tenant-1');
    expect(result.source).toBe('fallback');
  });
});
```

---

**Last Updated**: November 4, 2025  
**Version**: 1.0.0  
**Status**: Production Ready
